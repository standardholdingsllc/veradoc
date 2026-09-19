# P-001: Initial PDF Upload RLS Remediation Plan

Status: **Implemented locally — database rollout and browser acceptance pending**

Scope: Application code, database migration design, integration coverage, deployment, and browser acceptance for the initial realtor PDF upload.

This document describes the implementation and its gated production rollout. Its
presence alone does not apply database, Storage, or deployment changes.

## Objective

Make the first PDF upload reliable and safe without weakening the existing Storage ownership policy.

The completed flow must prove that:

- an active realtor can upload a valid synthetic PDF;
- the uploaded object belongs to the packet owner;
- lifecycle and document-integrity fields cannot be changed directly by an authenticated client;
- a lost response or partial failure can be retried safely;
- cleanup cannot race packet finalization;
- packet, document, signer, and audit records are finalized atomically;
- no orphaned packet or Storage object remains after failed or abandoned creation.

## Current defect

The current flow generates a packet ID and uploads to `packets/{packetId}/lease_original.pdf` before inserting the corresponding `lease_packets` row. The Storage policy calls `user_owns_packet(packet_id)`, so the initial upload is rejected because ownership does not yet exist.

Relevant current surfaces:

- Upload action: [`lib/actions/agente-actions.ts`](/C:/VeraDoc/lib/actions/agente-actions.ts:51)
- Packet creation action: [`lib/actions/agente-actions.ts`](/C:/VeraDoc/lib/actions/agente-actions.ts:107)
- Wizard sequencing: [`components/agente/wizard-client.tsx`](/C:/VeraDoc/components/agente/wizard-client.tsx:302)
- Packet ownership policy: [`00002_production_schema.sql`](/C:/VeraDoc/supabase/migrations/00002_production_schema.sql:459)
- Storage ownership policy: [`00003_storage_buckets.sql`](/C:/VeraDoc/supabase/migrations/00003_storage_buckets.sql:143)
- Production evidence: [`subdomain-browser-acceptance-report.md`](/C:/VeraDoc/docs/testing/subdomain-browser-acceptance-report.md:1544)

## Design decision

Use an **owned upload reservation**:

1. Reserve the packet under the authenticated realtor before touching Storage.
2. Upload through the authenticated client so the existing Storage RLS policy authorizes it.
3. Mark the reservation uploaded through an RPC.
4. Finalize packet business data, signers, document metadata, and audit records through one transactional RPC.
5. Use a privileged cleanup worker for Storage deletion and a cleanup RPC for reservation deletion.

Do not add a broad service-role upload path and do not weaken the existing `documents` Storage INSERT policy.

## Target lifecycle

Keep the existing business `lease_packets.status` values. Add a separate server-owned provisioning state:

| `creation_state` | Meaning | Visible as a normal packet? |
| --- | --- | --- |
| `uploading` | Owned reservation exists; object upload may be in progress | No |
| `uploaded` | Canonical object exists and hash is verified | No |
| `cleanup_pending` | Cleanup is irreversible; worker ownership may change, but finalization is forbidden | No |
| `finalized` | Packet metadata, signers, document row, and audit records exist | Yes |

Existing production packets must default to `finalized`.

Add an expiration timestamp for non-finalized reservations. The TTL must be configurable and must not be client-controlled.

## Required database design

The compatibility migration must add:

- `creation_state`, with a constrained value set and default `finalized`;
- `upload_reservation_expires_at`;
- cleanup claim fields and a claim lease expiration;
- an index supporting expired non-finalized reservation lookup;
- a reservation RPC;
- an upload-state transition RPC;
- a transactional finalization RPC;
- a cleanup claim RPC;
- a cleanup completion RPC.

### Mutation protection

RLS alone is not sufficient because the current authenticated update policy permits owners to update any draft-packet column. The hardening migration must revoke direct authenticated mutations:

- revoke authenticated `INSERT` and `UPDATE` on `lease_packets`;
- revoke authenticated `INSERT` and `UPDATE` on `packet_documents`;
- revoke authenticated `INSERT` on `packet_signers`, because signer creation is
  part of transactional finalization and must not be possible on a reservation;
- retain authenticated `SELECT` according to existing RLS policies;
- grant RPC execution only to the intended caller role;
- ensure the cleanup RPC is callable only by the privileged cleanup worker role.

The RPCs must explicitly verify `auth.uid()`, active realtor status, ownership, state, expiry, and canonical packet/object identity. Lifecycle and integrity fields must not be accepted as freely writable RPC parameters.

Authenticated mutating RPCs must be `SECURITY DEFINER`, owned by a non-login
database owner, use an empty fixed `search_path`, fully qualify every referenced
object, and revoke execution from `PUBLIC`. Only the minimum intended roles may
execute each function.

Audit all existing callers before revoking grants. Service-role workflows may continue to write through their existing server-only paths.

## Application flow

### Reservation and upload

Update the wizard and upload action so each upload attempt has one stable client-generated UUID. The server must:

1. authenticate the caller;
2. require an active realtor;
3. validate the PDF and calculate its SHA-256 hash;
4. call the reservation RPC with the stable packet ID and hash;
5. derive `packets/{packetId}/lease_original.pdf` server-side;
6. upload with `upsert: false` through the authenticated Supabase client;
7. call the upload-state RPC only after the object is verified;
8. return canonical server values.

The client must not select or override `storage_path`, `document_hash`, owner, lifecycle state, or expiry.

### Retry and conflict handling

The upload action must classify Storage results:

| Situation | Required behavior |
| --- | --- |
| Reservation absent | Create it if the caller is an active realtor |
| Same owner, `uploading`, object absent | Attempt the upload |
| Same owner, `uploading`, object present | Verify object hash; mark uploaded if it matches |
| Same owner, `uploaded`, matching hash/object | Return idempotent success |
| Same owner, different hash | Return permanent conflict; never overwrite |
| Different owner | Return generic conflict; do not reveal ownership |
| Finalized packet | Reject upload reuse |
| Storage “already exists” response | Read the canonical object and verify its hash before deciding success or conflict |
| Ambiguous transient Storage failure | Leave the reservation retryable; do not create a second packet ID |

Object verification must use the exact server-derived path and recompute the hash. Do not treat an object-exists error as success without verification.

### Finalization

Change `createLeasePacket` from a direct multi-table insert sequence into a finalization call:

1. Validate form input in the application layer.
2. Load the reservation through an ownership-checked RPC.
3. Verify it is `uploaded`, unexpired, and associated with the expected hash.
4. Perform coverage and duplicate checks.
5. Call the transactional finalization RPC.

The finalization RPC must lock the packet row and atomically:

- re-check ownership and lifecycle state;
- update property and lease fields;
- insert signers;
- insert exactly one `lease_original` document using the canonical path/hash;
- insert the packet creation and hash audit events;
- set `creation_state = finalized`;
- clear the reservation expiry and cleanup claim fields.

Repeated finalization of the same valid reservation must return an idempotent success without duplicate signers, documents, or audit events.

## Cleanup design

The authenticated realtor client has no safe Storage DELETE policy or packet DELETE grant and must not perform cleanup.

### Immediate failure

On an upload failure, the application may request cleanup, but cleanup authority remains server-side. The authoritative cleanup path is:

1. privileged worker atomically changes the reservation to `cleanup_pending` and claims it;
2. worker deletes the exact object through the Storage API;
3. worker calls the cleanup completion RPC;
4. cleanup RPC locks and deletes the reservation only if the claim still matches and the packet remains `cleanup_pending`.

If immediate cleanup is implemented as a best-effort server-side compensation, it must use the same exact-path and ownership checks and must not rely on the realtor client.

### Scheduled cleanup

The cleanup worker must:

- claim expired `uploading` and `uploaded` reservations with `FOR UPDATE SKIP LOCKED`;
- irreversibly transition selected reservations to `cleanup_pending` in the same transaction as the first claim;
- set a claim lease before releasing the database lock;
- delete only the canonical object path;
- complete deletion through the cleanup RPC;
- retry expired worker claims safely;
- refuse cleanup when dependent business records exist.

Finalization must accept only `uploaded` reservations and therefore always refuse
`cleanup_pending`, even after a worker lease expires. Claim leases govern which
cleanup worker may complete the work; they never restore finalization
eligibility. This prevents a stale worker from deleting an object after packet
finalization.

## Rollout sequence

Because application deployment and database grants are not atomic, use staged rollout.

### Phase 0 — Inventory and fixtures

- Identify every application caller that inserts or updates `lease_packets` and `packet_documents`.
- Confirm service-role workflows do not depend on authenticated table mutation grants.
- Prepare isolated synthetic realtor fixtures and synthetic PDFs.
- Define the reservation TTL and cleanup worker schedule.

### Phase 1 — Compatibility migration

- Add lifecycle and cleanup columns.
- Add indexes and RPCs.
- Leave existing authenticated mutation grants in place temporarily.
- Regenerate database types.

### Phase 2 — Application deployment

- Deploy reservation-first upload behavior.
- Deploy stable packet-ID retry handling.
- Deploy transactional finalization calls.
- Deploy dashboard filtering for non-finalized reservations.
- Deploy cleanup worker invocation and observability.

### Phase 3 — Hardening migration

- Revoke direct authenticated `INSERT`/`UPDATE` privileges.
- Verify RPC grants.
- Confirm direct table mutations fail with authenticated credentials.
- Confirm service-role and RPC workflows still operate.

### Phase 4 — Controlled acceptance

- Run integration tests against the controlled database and Storage environment.
- Run two independent authenticated browser contexts.
- Verify packet/object/document ownership and cleanup.
- Stop immediately if any real provider or non-synthetic side effect is possible.

## Test plan

### Unit tests

- canonical path derivation;
- UUID and path validation;
- hash conflict classification;
- lifecycle transition validation;
- non-sensitive conflict responses;
- cleanup claim expiry handling.

### Database/RPC integration tests

- active realtor reservation succeeds;
- inactive or wrong-role reservation fails;
- owner cannot directly update lifecycle, hash, or expiry fields;
- owner cannot directly insert packet documents;
- owner cannot directly insert signers on a reservation;
- wrong owner cannot observe or mutate a reservation;
- finalization is atomic;
- repeated finalization is idempotent;
- cleanup claim blocks finalization;
- cleanup completion requires the correct claim token;
- cleanup is safe to retry;
- expired reservations are removed only when dependency checks pass.

### Storage integration tests

- first upload succeeds after reservation;
- object upload succeeds but state transition fails;
- retry finds and verifies the existing matching object;
- mismatched object hash fails without overwrite;
- transient upload failure remains retryable;
- cleanup removes the exact object through privileged Storage access.

### Browser acceptance

Using two clean authenticated active-realtor contexts:

1. open `/agente/nuevo-paquete`;
2. upload a clearly synthetic PDF;
3. verify the UI reaches `Cargado`;
4. complete property, lease, and signer steps;
5. finalize the packet;
6. verify the realtor dashboard shows one finalized draft packet;
7. verify the packet document row, canonical Storage object, hash, owner, and audit events;
8. repeat with a second context and independently generated PDF;
9. exercise a controlled failed upload and verify no orphan remains;
10. exercise a repeated request with the same packet UUID and verify no duplicate records.

## Acceptance gates

P-001 can be closed only when all of the following are true:

- two clean production-like authenticated contexts successfully upload valid synthetic PDFs;
- no Storage RLS error occurs;
- direct authenticated lifecycle/integrity mutations are denied;
- retries with the same UUID/hash are idempotent;
- different hashes are rejected without overwrite;
- finalization is atomic and produces exactly one document record;
- cleanup is privileged, claimed, race-safe, and verified;
- no packet, document, signer, audit, or Storage orphan remains after failure tests;
- sanitized browser and database evidence is recorded;
- no real payment, signing, messaging, certification, or other provider side effect is triggered.

Closing P-001 unlocks the customer wizard and packet creation. It does not close P-002 or P-003, so signing/OTP and payment acceptance must remain separately gated.

## Explicit non-goals

- Do not apply the commercial payment migration.
- Do not enable production payment submission.
- Do not invoke real WhatsApp/OTP delivery.
- Do not invoke real FirmEasy signing.
- Do not perform notarial certification.
- Do not weaken Storage RLS or expose a general service-role upload endpoint.
- Do not execute any database, code, Storage, or deployment change as part of preparing this plan.
