# FirmEasy Staging Integration Plan

**Created:** 2026-08-02
**Purpose:** Step-by-step implementation guide for connecting VeraDoc's signing flow to the FirmEasy staging environment. A coding agent should be able to follow this document task-by-task.

---

## Staging Environment Facts

| Property | Value |
|---|---|
| Portal URL | `https://staging.firmeasy.legal` |
| Account name | VeraDoc SACS |
| Account email | `jonah@veradoc.pe` |
| Account phone | `+51 900000001` |
| Organization ID | `#27` ("Organización de VeraDoc SACS") |
| Document credits | 5 (staging allocation) |
| Staging API base URL | `https://staging.firmeasy.legal/api/v1` (confirm — see Task 1) |
| Documentation | `https://docs.firmeasy.legal/` (intermittently accessible) |
| Signing types available | Firma Electrónica (electronic) and Firma Digital Acreditada (accredited digital with certificates) |

### FirmEasy Platform Observations (from staging portal)

- **Firma Electrónica** ("Mis Documentos" section) is what VeraDoc needs — advanced electronic signatures with OTP verification and legal validity under Law 27269.
- **Firma Digital Acreditada** is a higher-security option using RENIEC-linked digital certificates — not needed for lease signing MVP.
- **Certificate management** UI exists at `/configuracion/certificados` with cloud and certified remote signing options.
- **Organization preferences** include QR code display on signed documents (currently enabled) and logo display during signing.
- **Plan features confirm** all plans include: OTP verification via Correo, SMS, **and WhatsApp**; Evidencia Certificada; Reportes en Tiempo Real.
- **API plans** are listed separately from Web plans. Api Start: S/ 1,212/year for 1,440 docs, $0.25/extra doc. Confirm which plan this staging account is on.

### v2 API Discovery (Critical)

FirmEasy's public-facing marketing and API landing page (`firmeasy.legal/firmeasy-api/inicio`) prominently advertise a **v2 API** that uses an **envelope ("sobre") model**:

- `POST /v2/envelope/send` — send an envelope containing up to 10 documents
- `POST /v2/sign` — individual signing endpoint
- Pricing: per envelope (not per document), rejected envelopes not billed
- 32 endpoints documented
- KYC biométrico support

**Our current codebase** uses v1-style endpoints (`POST /documents`, `GET /documents/{token}`, etc.). The v1 API may still be fully supported — the staging account works and shows documents. **Task 1 below validates this.**

---

## Current Codebase State

### What's Already Built (and should work with real credentials)

| Component | File(s) | Status |
|---|---|---|
| HTTP client with JWT auth | `lib/services/firmeasy/client.ts` | Complete — auth caching, request/timeout handling, error parsing |
| Type definitions (v1) | `lib/services/firmeasy/types.ts` | Complete — based on docs.firmeasy.legal |
| Document creation at link-send | `lib/actions/agente-actions.ts` (L419–493) | Complete — downloads PDF from Supabase, base64-encodes, creates multi-signer doc |
| HMAC webhook verification | `lib/services/firmeasy/hmac.ts` | Complete — **header name assumed** (`x-firmeasy-signature`), must confirm |
| WhatsApp phone normalization | `lib/services/firmeasy/normalize.ts` | Complete |
| Webhook route (idempotent) | `app/api/webhooks/firmeasy/route.ts` | Complete — HMAC verify, SHA-256 dedup, `document_signed` + `signer_rejected` handlers |
| Signed PDF download + storage | Webhook route (L196–206) | Complete — via `assembleSignedDocument()` |
| Signature records + evidence | Webhook route (L227–292) | Complete — upsert with tracking data |
| Signer status advancement | Webhook route (L294–341) | Complete — `identity_verified` → `signed` → `complete` |
| Packet status transition | Webhook route (L371–385) | Complete — to `all_signed` |
| Email notifications | Webhook route (L352–404) | Complete — signer completion + realtor all-signed |
| DB-level webhook log helpers | `lib/services/firmeasy/db-helpers.ts` | Complete — insert, find, claim-retry, mark processed/failed |
| Webhook retry RPC | `supabase/migrations/00015_firmeasy_webhook_retry_rpc.sql` | Complete |
| DB columns for FirmEasy | `supabase/migrations/00014_firmeasy_integration.sql` | Complete |
| Signing page redirect | `app/(signing)/firma/[token]/firmar/page.tsx` | Complete — redirects to `firmeasy_signer_link` |
| Completion page polling | `app/(signing)/firma/[token]/completado/page.tsx` | Complete — polls until webhook advances status |
| Status poll action | `lib/actions/firmeasy-status-poll.ts` | Complete |
| Env validation | `lib/env/server.ts` (L80–116) | Complete — sandbox/production modes, startup fail-fast |
| Singleton factory | `lib/services/firmeasy/index.ts` | Complete |
| Vitest tests | `__tests__/services/firmeasy/*.test.ts`, `__tests__/webhooks/*.test.ts` | Complete — auth, HMAC, normalization, webhook route |

### What's Assumed / Needs Validation

1. **Auth endpoint**: Code assumes `POST /auth/{integrationToken}/login` → `{ access, token_type, expires_in }`. Validate this returns a JWT.
2. **Document creation endpoint**: Code assumes `POST /documents` with `document_pdf_base64`, `signers[]`, `external_id`, etc. Validate request/response shape.
3. **Document lookup endpoint**: Code assumes `GET /documents/{token}?include[]=signers&include[]=tracking`. Validate `signed_file` URL is returned.
4. **Webhook HMAC header**: Code assumes header name is `x-firmeasy-signature` and verification is `HMAC-SHA256(raw_body, secret)`. **Must confirm during onboarding.**
5. **Webhook payload shape**: Code assumes `{ event, document_token, signer_token, signer_external_id, data }`. Validate.
6. **Webhook events**: Code handles `document_signed` (all signers complete) and `signer_rejected`. Confirm these are the event names FirmEasy sends.
7. **Signer `external_id` round-trip**: Code sends `packet_signers.id` as `external_id` on each signer and expects it back in webhook payload as `signer_external_id` and in `GET /documents` response signers. **Critical for matching.**
8. **Signed PDF URL**: Code calls `getSignedPdf(doc.signed_file)` with Bearer auth. Confirm the signed PDF download flow.

---

## Implementation Tasks

### Task 0: Obtain Staging API Credentials

**Owner:** Manual (not codeable — requires FirmEasy dashboard or support contact)

1. Locate the **integration token** (`FIRMEASY_USER_INTEGRATION_TOKEN`) in the FirmEasy staging dashboard. Check:
   - User profile menu → "Mi Organización" or similar API settings page
   - Any email from FirmEasy with onboarding credentials
   - Contact FirmEasy support to request the API integration token for the staging account
2. Record the credentials needed for `.env.local`:
   ```
   FIRMEASY_API_BASE_URL=https://staging.firmeasy.legal/api/v1
   FIRMEASY_USER_INTEGRATION_TOKEN=<from FirmEasy>
   FIRMEASY_EMAIL=jonah@veradoc.pe
   FIRMEASY_PASSWORD=<staging password>
   FIRMEASY_WEBHOOK_SECRET=<from webhook registration>
   FIRMEASY_MODE=sandbox
   FIRMEASY_ALLOW_DEV_STUB=false
   ```
3. Register the staging webhook in the FirmEasy dashboard or via API (see Task 3).

**Prerequisite for:** All subsequent tasks.

---

### Task 1: Validate API Base URL and Auth

**Goal:** Confirm the v1 API still works on staging, or determine if migration to v2 is needed.

**Files to modify:** Possibly `lib/services/firmeasy/client.ts`, `lib/services/firmeasy/types.ts`

1. With credentials from Task 0, attempt authentication:
   ```bash
   curl -X POST "https://staging.firmeasy.legal/api/v1/auth/{INTEGRATION_TOKEN}/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"jonah@veradoc.pe","password":"<password>"}'
   ```
   - If this returns `{ "access": "...", "token_type": "bearer", "expires_in": ... }`, the v1 auth works.
   - If 404 or error, try `https://staging.firmeasy.legal/api/v2/auth/...` and other URL patterns.

2. If v1 works, record the confirmed base URL and move to Task 2.

3. If v1 does NOT work (404/deprecated):
   - Test v2 endpoints: `POST /v2/envelope/send` etc.
   - Update `FirmEasyClient` to use v2 endpoint patterns.
   - Update `CreateDocumentParams` → `CreateEnvelopeParams` (the v2 envelope wraps documents).
   - Update all callers. The envelope model groups multiple documents but VeraDoc uses one document per packet, so the mapping should be 1:1 — one envelope with one document.

4. **Decision gate:** If the API version changes, this affects every subsequent task. Document the confirmed base URL in `.env.local` and proceed.

---

### Task 2: Validate Document Creation Flow

**Goal:** Create a real test document via the API and confirm the request/response contract.

**Files to modify:** `lib/services/firmeasy/types.ts` (if response shape differs), `lib/actions/agente-actions.ts` (if params need adjustment)

1. Using the JWT from Task 1, create a test document:
   ```bash
   curl -X POST "https://staging.firmeasy.legal/api/v1/documents" \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Contrato VeraDoc.pdf",
       "document_pdf_base64": "<base64 of a small test PDF>",
       "external_id": "test-veradoc-001",
       "send_automatic_invitations": false,
       "disable_signer_notifications": true,
       "disable_owner_notifications": true,
       "is_rejection_allowed": true,
       "signature_deadline": "2026-08-09T00:00:00Z",
       "signers": [
         {
           "name": "Test Arrendador",
           "email": "test-landlord@veradoc.pe",
           "country_code": "51",
           "phone": "900000002",
           "external_id": "signer-landlord-001",
           "standard_flow": ["otp_email"],
           "redirect_link": "https://veradoc.pe/firma/test/completado"
         },
         {
           "name": "Test Arrendatario",
           "email": "test-renter@veradoc.pe",
           "country_code": "51",
           "phone": "900000003",
           "external_id": "signer-renter-001",
           "standard_flow": ["otp_email"],
           "redirect_link": "https://veradoc.pe/firma/test/completado"
         }
       ]
     }'
   ```

2. **Record the response** and compare against `FirmEasyDocumentResponse`:
   - Does it have `token`, `status`, `name`, `external_id`, `signers[]`?
   - Does each signer have `token`, `link`, `status`, `external_id`?
   - Are there any additional fields we don't capture?

3. **Validate the signer link format**: Open one of the returned signer `link` URLs in a browser. Confirm it loads the FirmEasy signing interface.

4. **Update types if needed**: If the response has additional useful fields (e.g., `envelope_id`, `created_at`), add them to `FirmEasyDocumentResponse`.

5. **Verify `external_id` round-trip**: Call `GET /documents/{token}?include[]=signers` and confirm each signer's `external_id` matches what was sent. This is critical — our webhook handler uses it to match FirmEasy signers to `packet_signers` rows.

6. **Verify in staging portal**: Check that the created document appears at `https://staging.firmeasy.legal/electronica/documentos`. It should consume 1 of the 5 credits.

7. **Fix any discrepancies** in `CreateDocumentParams`, `CreateDocumentSignerParams`, or `FirmEasyDocumentResponse`.

---

### Task 3: Register Webhook and Validate HMAC Contract

**Goal:** Set up webhook delivery and confirm the signature verification mechanism.

**Files to modify:** `lib/services/firmeasy/hmac.ts` (if header name or algo differs)

1. **Expose a public webhook URL** for staging. Options:
   - Deploy VeraDoc to a staging Vercel environment and use `https://staging.veradoc.pe/api/webhooks/firmeasy`
   - Use a tunnel (ngrok, Cloudflare Tunnel) to expose localhost: `https://<tunnel>/api/webhooks/firmeasy`
   - Temporarily use a webhook debugging tool (webhook.site, RequestBin) to inspect raw payloads first

2. **Register the webhook** — try the API first, fall back to dashboard:
   ```bash
   curl -X POST "https://staging.firmeasy.legal/api/v1/webhooks" \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "target_url": "https://<your-staging-url>/api/webhooks/firmeasy",
       "event": "document_signed"
     }'
   ```
   - Record the response, especially `secret_key` — this becomes `FIRMEASY_WEBHOOK_SECRET`.
   - Register a second webhook for `signer_rejected` if events require separate registrations, or confirm if one registration covers all events.

3. **Confirm the HMAC contract** by inspecting a real webhook delivery:
   - Check which HTTP header carries the signature (our code assumes `x-firmeasy-signature`)
   - Check the signature format (our code assumes hex-encoded `HMAC-SHA256(raw_body, secret)`)
   - If the header name or algorithm differs, update `FIRMEASY_SIGNATURE_HEADER` and `verifyFirmEasyWebhookSignature` in `lib/services/firmeasy/hmac.ts`

4. **Update the HMAC test** in `__tests__/services/firmeasy/hmac.test.ts` if the header name changes.

---

### Task 4: End-to-End Signing Flow Test (Staging)

**Goal:** Run one complete packet through the signing flow using the staging API.

**Prerequisite:** Tasks 0–3 complete, webhook registered, VeraDoc running with staging credentials.

**No files to modify** — this is a validation test of the existing code.

#### 4.1: Create a packet and send signing links

1. Log into VeraDoc as a realtor (use seed data or create a test realtor).
2. Create a lease packet via the wizard with a test PDF.
3. Complete the mock payment step (or bypass with `CULQI_USE_MOCK=true`).
4. Click "Enviar enlaces" — this triggers `sendSigningLinksAction`.
5. **Verify** in the VeraDoc database:
   - `lease_packets.firmeasy_document_token` is populated
   - `lease_packets.firmeasy_document_status` is populated
   - Each `packet_signers` row has `firmeasy_signer_token` and `firmeasy_signer_link`
6. **Verify** in the FirmEasy staging portal that the document appears.

#### 4.2: Complete the signer flow

1. Open the VeraDoc signing link for the first signer (`/firma/{token}`).
2. Complete steps: account creation → consent → identity → review.
3. At step 6 (Firmar), confirm the redirect to the FirmEasy signer link.
4. On the FirmEasy signing page:
   - Complete OTP verification (email OTP will be sent to the test email).
   - Sign the document via the FirmEasy UI.
   - Confirm redirect back to `/firma/{token}/completado`.
5. Repeat for the second signer.

#### 4.3: Verify webhook processing

After both signers sign:
1. FirmEasy should send `document_signed` webhook to the registered URL.
2. **Verify** in the database:
   - `firmeasy_webhook_log` has a `processed` row for the event
   - `packet_documents` has a `signed_pdf` row
   - `signature_records` has rows for each signer with certificate/tracking data
   - `signer_evidence` has `firmeasy_signature` rows
   - Both `packet_signers` are at status `complete`
   - `lease_packets.status` is `all_signed`
3. **Verify** the signed PDF is downloadable from Supabase Storage.
4. **Verify** email notifications were sent (check Resend dashboard or logs).

#### 4.4: Document any failures

Record every discrepancy for fixes in Task 5. Common issues to watch for:
- Webhook not delivered (check FirmEasy webhook logs in their dashboard)
- HMAC verification failure (header name or algo mismatch)
- Signer `external_id` not matching (breaks the signer-to-row lookup)
- Signed PDF download fails (auth or URL format issue)
- Tracking data shape doesn't match `FirmEasyTrackingEntry`
- Missing fields in webhook payload vs. `FirmEasyWebhookPayload` type

---

### Task 5: Fix Discrepancies Found in Task 4

**Goal:** Patch all code mismatches discovered during the end-to-end test.

**Likely files to modify (based on known assumptions):**

| File | Potential Fix |
|---|---|
| `lib/services/firmeasy/hmac.ts` | Update `FIRMEASY_SIGNATURE_HEADER` if header name differs |
| `lib/services/firmeasy/types.ts` | Add/remove/rename fields to match actual API responses |
| `lib/services/firmeasy/client.ts` | Adjust endpoint paths, query params, or auth flow |
| `lib/actions/agente-actions.ts` | Adjust `createDocument` params (e.g., add `placements`, change `standard_flow`) |
| `app/api/webhooks/firmeasy/route.ts` | Adjust payload field names, tracking data extraction |
| `__tests__/**/*.test.ts` | Update mocks to match actual shapes |

---

### Task 6: Decide and Implement Signer Verification Mode

**Goal:** Choose between `otp_email`, `otp_whatsapp`, or `otp_sms` for signer identity verification at the FirmEasy level.

**Files to modify:** `lib/actions/agente-actions.ts` (L456), possibly types

**Context:** The current code sends `standard_flow: ["otp_email"]` for each signer. FirmEasy supports:
- `otp_email` — OTP sent to signer's email
- `otp_whatsapp` — OTP sent to signer's WhatsApp (natural for Peruvian users)
- `otp_sms` — OTP sent via SMS
- `holographic_signature` — drawn signature

**Additionally**, FirmEasy has `advanced_flow` options: `selfie`, `identity_document_verification` (`doc_identidad`), `live_video_authentication`.

**Decision to make:**
1. **Which `standard_flow`?** `otp_whatsapp` is most natural for Peru but requires the signer's WhatsApp number to be correct in FirmEasy. VeraDoc already collects WhatsApp numbers. Recommendation: switch to `["otp_whatsapp"]`.

2. **Should VeraDoc keep its own OTP/account gate?** VeraDoc currently runs its own account creation + consent + identity upload flow BEFORE redirecting to FirmEasy. With FirmEasy running WhatsApp OTP, the signer verifies identity twice. Options:
   - **Keep both** (belt-and-suspenders — VeraDoc verifies access, FirmEasy verifies signing intent). Recommended for MVP.
   - **Remove VeraDoc OTP** and rely solely on FirmEasy verification. Riskier — removes VeraDoc's own access control layer.

3. **Should FirmEasy `advanced_flow` be enabled?** For lease signing, `selfie` or `doc_identidad` via FirmEasy could replace or supplement VeraDoc's own DNI/selfie upload. For MVP, keep VeraDoc's own identity collection and don't enable FirmEasy advanced flow — FirmEasy's identity verification may be a future upgrade.

**Implementation** (after decision):

```typescript
// In lib/actions/agente-actions.ts, change line ~456:
standard_flow: ["otp_whatsapp" as const],
// instead of:
standard_flow: ["otp_email" as const],
```

---

### Task 7: Add Signature Field Placements

**Goal:** Configure where signatures appear on the signed PDF.

**Files to modify:** `lib/actions/agente-actions.ts`, `lib/services/firmeasy/types.ts`

**Context:** The current code creates FirmEasy documents without any signature placement coordinates. FirmEasy may use defaults (e.g., append a signature page), but for a professional lease document, explicit placement is better.

1. **Determine placement strategy.** Options:
   - **Fixed positions** — all lease PDFs have signatures on the last page at known coordinates. Simple but requires consistent PDF layout.
   - **Append signature page** — let FirmEasy append its own signature page. Least intrusive.
   - **Per-signer placement** — put landlord signature in one area, renter in another.

2. **Test with and without placements** during Task 4 to see FirmEasy's default behavior.

3. **If explicit placement is needed**, add `placements` to the signer params:
   ```typescript
   placements: [{
     type: "signature",
     page_number: -1, // last page
     relative_position_left: 0.1,
     relative_position_bottom: 0.15,
     relative_size_width: 0.35,
     relative_size_height: 0.08,
   }]
   ```

4. **If FirmEasy's default signature page is acceptable**, skip this task for MVP.

---

### Task 8: Handle Signer Rejection Properly

**Goal:** When a signer rejects on FirmEasy, properly update VeraDoc state.

**Files to modify:** `app/api/webhooks/firmeasy/route.ts`, `lib/domain/packet-machine.ts`, possibly `components/agente/packet-detail-client.tsx`

**Current behavior:** `handleSignerRejected` updates `firmeasy_signer_status` to `"rejected"`, writes an audit log, and emails the realtor. But it does NOT:
- Transition the signer's VeraDoc status
- Transition the packet status
- Show the rejection in the realtor dashboard with a clear action path

**Implementation:**

1. Add a `rejected` status to the signer state machine (or use an existing terminal status).

2. In `handleSignerRejected`, after updating `firmeasy_signer_status`:
   ```typescript
   // Advance signer to a rejected/terminal state
   await admin
     .from("packet_signers")
     .update({ status: "rejected" } as never)
     .eq("id", signerExternalId);
   ```

3. Decide on packet-level impact:
   - **Option A:** Packet stays in `signing` status — realtor can re-send links to a replacement signer or cancel the packet. (Recommended for MVP.)
   - **Option B:** Packet transitions to `signer_rejected` — a new status requiring realtor action.

4. Update the rejection email to use a proper email template instead of inline HTML:
   - Create `lib/services/email-templates/signer-rejected.ts`
   - Follow the existing template pattern from `lib/services/email-templates/`

5. Surface the rejection in the realtor's packet detail UI with a clear indicator and suggested next steps.

---

### Task 9: Wire Completion Pipeline (Auto Evidence Report)

**Goal:** When FirmEasy webhook advances packet to `all_signed`, automatically generate the evidence report and advance to `evidence_report_generated`.

**Files to modify:** `app/api/webhooks/firmeasy/route.ts`, `lib/actions/agente-actions.ts` or new action

**Context:** Currently, after the webhook sets `all_signed`, the evidence report must be manually triggered by the realtor clicking "Generar informe". `enqueueEvidenceReport` in `lib/jobs/enqueue.ts` is a `console.log` placeholder.

**MVP Implementation (synchronous, no job queue):**

1. At the end of `handleDocumentSigned`, after transitioning to `all_signed`:
   ```typescript
   // Auto-generate evidence report
   try {
     const { generateEvidenceReport } = await import("@/lib/pdf/generate-evidence-report");
     await generateEvidenceReport(packet.id);

     // Advance packet to evidence_report_generated
     await admin.rpc("transition_packet_status", {
       p_packet_id: packet.id,
       p_new_status: "evidence_report_generated",
       p_actor_id: packet.created_by,
       p_action: "evidence_report_auto_generated",
       p_metadata: { system_source: "firmeasy_webhook" },
     });
   } catch (err) {
     // Log but don't fail the webhook — evidence report can be generated manually
     console.error("[FirmEasy Webhook] Auto evidence report failed:", err);
   }
   ```

2. Verify `evidence_report_generated` is a valid status in `packet-machine.ts`. If not, add it as a valid transition from `all_signed`.

3. Update `submitToNotaryAction` status gate: currently validates `packet.status === "all_signed"`. Change to accept both `all_signed` and `evidence_report_generated`.

---

### Task 10: Map FirmEasy Evidence to Notary Review UI

**Goal:** Surface FirmEasy certificate/tracking data in the notary's evidence review panel.

**Files to modify:** `components/notary/evidence-review-client.tsx`, `lib/actions/notary.ts` (or wherever evidence data is fetched)

**Context:** FirmEasy tracking entries contain certificate chain data (`certificate_subject`, `certificate_issuer`, `certificate_serial`, `certificate_valid_from/to`, `chain_validation`, `revocation_status`, `timestamp_authority`, `verification_url`) that the notary needs to see for certification decisions.

1. **Fetch signature records** for the packet's signers from `signature_records` table.

2. **Display per-signer** in the evidence review:
   - Provider: FirmEasy
   - Certificate subject / issuer / serial
   - Certificate validity period
   - Chain validation result
   - Revocation status (OCSP/CRL)
   - Timestamp authority
   - Verification URL (link to FirmEasy's QR validation page)
   - Signed-at timestamp

3. **Add to evidence report PDF**: Update `lib/pdf/evidence-report-template.tsx` to include the FirmEasy certificate data in the signature validation section. The data comes from `signature_records` via `evidence-data-collector.ts`.

4. **Wire the verification URL** as a clickable link in the notary UI — the notary can independently verify the signature through FirmEasy's validation page.

---

### Task 11: Update Tests for Staging Contract

**Goal:** Ensure Vitest tests reflect the actual FirmEasy API contract.

**Files to modify:** `__tests__/services/firmeasy/*.test.ts`, `__tests__/webhooks/*.test.ts`

1. Update mock responses in `client.test.ts` to match the actual response shape from Task 2.
2. Update webhook test payloads in `firmeasy-route.test.ts` to match actual payloads from Task 4.
3. Update HMAC test header name if it changed in Task 3.
4. Add a test for `handleSignerRejected` with the actual rejection payload shape.
5. Add a test for the auto evidence report generation in the webhook handler (Task 9).

---

### Task 12: Production Cutover Checklist

**Not a coding task** — this is the acceptance criteria list to verify before switching from staging to production.

- [ ] All 5 staging document credits used on successful end-to-end tests
- [ ] HMAC webhook verification confirmed working (no bypasses)
- [ ] Signer `external_id` round-trip verified
- [ ] Signed PDF download and storage verified
- [ ] Certificate/tracking data populated in `signature_records`
- [ ] Signer status advancement works: `identity_verified` → `signed` → `complete`
- [ ] Packet status advancement works: `signing` → `all_signed` (→ `evidence_report_generated`)
- [ ] Signer rejection handled gracefully
- [ ] Email notifications sent on completion and rejection
- [ ] Evidence report includes FirmEasy certificate data
- [ ] Notary evidence review shows FirmEasy data
- [ ] Notary can certify a FirmEasy-signed packet
- [ ] Certified document PDF generated successfully
- [ ] Registry entry created
- [ ] Dev stub signing disabled when `FIRMEASY_ALLOW_DEV_STUB=false`
- [ ] `FIRMEASY_MODE=production` enforces all required env vars

---

## Task Dependencies

```
Task 0 (credentials)
  └─► Task 1 (validate API URL + auth)
       └─► Task 2 (validate document creation)
            ├─► Task 3 (register webhook + validate HMAC)
            │    └─► Task 4 (end-to-end test)
            │         └─► Task 5 (fix discrepancies)
            │              ├─► Task 6 (signer verification mode)
            │              ├─► Task 7 (signature placements)
            │              ├─► Task 8 (signer rejection handling)
            │              ├─► Task 9 (auto evidence report)
            │              ├─► Task 10 (notary evidence mapping)
            │              └─► Task 11 (update tests)
            └─► Task 7 (can test placements during Task 2)

Task 12 (production checklist) — after all above
```

Tasks 6–11 are independent of each other and can be worked in parallel after Task 5.

---

## Roadmap Section Cross-Reference

| This Plan Task | MVP_GAP_ROADMAP Section |
|---|---|
| Tasks 0–1 | 8.1 — Account, credentials, legal validation |
| Tasks 2–5 | 8.1 — Validate request/response mapping against Postman collection |
| Task 3 | 8.1 — Confirm webhook signature contract |
| Task 4 | 8.4 — Full sandbox packet end-to-end |
| Task 6 | 8.2 / 7.1 — Signer verification mode (`otp_email` vs `otp_whatsapp`) |
| Task 7 | (not explicitly in roadmap — discovered gap) |
| Task 8 | (partial in roadmap — rejection handling improvement) |
| Task 9 | 7.2 / 13.1 — Auto evidence report + status advancement |
| Task 10 | 8.3 / 9.1 — Provider evidence completeness |
| Task 11 | 27.1–27.2 — Test coverage |
| Task 12 | 8.4 — Production cutover acceptance |

### Roadmap Items NOT Covered by This Plan

These are mentioned in Section 8 of the roadmap but are out of scope for this integration plan:

- **8.1 — INDECOPI accreditation verification**: Legal/business task, not engineering.
- **8.1 — Law 27269 compliance for lease signing**: Legal review, not engineering.
- **8.2 — Remove VeraDoc's OTP/account gate**: Deferred — keeping both layers for MVP (see Task 6).
- **8.3 — Retryable webhook processing via async job queue**: Deferred — requires Section 14 infrastructure. Current synchronous + retry-via-500 approach works for MVP.
- **20.7 — FirmEasy/Law 27269 compliance verification**: Legal/business task.

---

## Environment Variables Summary

After completing Tasks 0–3, the `.env.local` should contain:

```env
# FirmEasy staging credentials
FIRMEASY_API_BASE_URL=https://staging.firmeasy.legal/api/v1
FIRMEASY_USER_INTEGRATION_TOKEN=<from FirmEasy>
FIRMEASY_EMAIL=jonah@veradoc.pe
FIRMEASY_PASSWORD=<staging account password>
FIRMEASY_WEBHOOK_SECRET=<from webhook registration response>
FIRMEASY_MODE=sandbox
FIRMEASY_ALLOW_DEV_STUB=false
```

---

## Risk Log

| Risk | Impact | Mitigation |
|---|---|---|
| v1 API is deprecated; staging only supports v2 | High — client rewrite needed | Task 1 validates this immediately. v2 envelope model is a superset; migration is 1 envelope = 1 document for VeraDoc's use case. |
| HMAC header name or algorithm wrong | Medium — webhooks fail silently | Task 3 validates with real webhook. Use webhook.site first to inspect raw headers. |
| `external_id` not round-tripped on signers | High — can't match FirmEasy signers to DB rows | Task 2 explicitly tests this. Fallback: match by email instead. |
| Staging credits (5 docs) exhausted before testing complete | Medium — blocks further testing | Be efficient: 1 doc for Task 2 validation, 2 docs for Task 4 e2e tests, 2 reserve. Request more credits from FirmEasy if needed. |
| FirmEasy webhook delivery unreliable on staging | Medium — can't complete e2e test | Use FirmEasy dashboard to check webhook delivery logs. Implement manual webhook replay for testing. |
| OTP emails/WhatsApp not delivered to test addresses | Medium — can't complete signer flow | Use real email addresses for testing. Check FirmEasy's staging behavior — they may not send real OTPs in sandbox. |
