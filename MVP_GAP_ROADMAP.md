# VeraDoc MVP Gap Roadmap

**Last updated:** 2026-07-10
**Purpose:** Enumerate every component, integration, and task required to move from the current state to a deployable MVP where a real estate agent in Peru can create a lease packet, signers can complete the signing flow, the notary can review and certify, and all parties receive the final document.

---

## Current State Summary

| Layer | Status | Details |
|---|---|---|
| Marketing site | Built | Homepage, cómo funciona, evidencia, posicionamiento legal |
| Demo prototype | Built | Full end-to-end flows under `/demo` using Zustand + mock adapter |
| Auth framework | Built | Login, realtor signup, notary invite, signer account creation, proxy route guards |
| SQL schema | Built | 15 sequential migration files: auth/onboarding, production tables, storage buckets, production RPCs/triggers, signing security, signer status reconciliation, party audit log RLS, notary dashboard, renewals, complaints, brand asset bucket, Culqi payments, FirmEasy integration, and FirmEasy webhook retry support. Seed data for all roles |
| Supabase adapter | Mostly built | `supabase-adapter.ts` implements all adapter interfaces; `database.types.ts` regenerated with current RPCs; `getAll()` methods use pagination; adapter factory exists. Remaining: migrate legacy demo services off direct mock-adapter imports |
| Admin dashboard (`/admin`) | Mostly built | Tabbed UI: realtor approval queue with optional rejection reason, notary invitations (create/resend/revoke/expired display), coverage management (add/edit/toggle with normalized matching), platform metrics, user management (paginated search/filter/suspend/reactivate). Remaining: durable admin audit logging |
| Realtor dashboard (`/agente`) | Mostly built | Dashboard shell with sidebar + realtor notification badge, summary cards including pending payments, filterable packet table with signer progress, 6-step creation wizard (Supabase-backed), Culqi Checkout Custom integration with mock fallback, packet detail with timeline/signers/payment/submit-to-notary/document downloads (all types), evidence report PDF generation via `@react-pdf/renderer`, profile settings with password change. Remaining: Culqi live cutover/refunds/reconciliation, duplicate-check UI polish, packet detail automation/reminders, invoice PDF download |
| Signing link delivery | Built | Token generation (crypto.randomBytes + SHA-256 hash), 7-day expiry, email (Resend) + WhatsApp (Meta) delivery with audit logging. Email delivery fully configured with verified domain. Remaining: rate limiting on live token resolution path, real WhatsApp provider configuration |
| Signer flow (`/firma/[token]`) | Mostly built | Production route steps exist with functional UI and server actions: landing/resume, account creation, consent, identity upload, lease review, FirmEasy redirect-based signing, and webhook-driven completion. Status reconciliation mapping layer built. Remaining: FirmEasy credentialed sandbox/live validation, WhatsApp OTP signer validation if required, and auto evidence report on completion |
| Notary dashboard (`/notario`) | Mostly built | Queue (5 tabs), evidence review (10/12 sections), interactive checklist with timestamps, 4-decision panel with server actions, certified document PDF generation, registry entry creation, earnings view with monthly breakdown, profile settings. Email notifications wired into all decision actions. Remaining: evidence report summary section, async job queue, payout configuration |
| Party dashboards (`/arrendador`, `/arrendatario`) | Built for MVP | Contract list with status badges including expired display, contract detail with inline PDF viewing/document download/evidence report download/evidence summary/timeline, landlord renewal flow, profile settings with password change. |
| Document pipeline | Mostly built | PDF upload with hardening (magic bytes `%PDF-` header, `%%EOF` trailer, `pdf-lib` structural parse, SHA-256 hash audit trail), evidence report PDF generation, certified document PDF generation, FirmEasy signed PDF retrieval/storage via webhook, signed-URL downloads for all document types with audit logging, and a unified in-app PDF viewer across signer/notary/party/realtor flows. Remaining: evidence report completeness and auto-generation |
| Env validation schemas | Built | Zod schemas in `lib/env/server.ts` and `lib/env/public.ts`, imported at startup via instrumentation for fail-fast validation; `.env.example` documents required and optional variables |
| External integrations | Partially live | **Email (Resend): LIVE** — verified domain `info.veradoc.pe`, 11 transactional templates, all lifecycle events wired. WhatsApp (Meta Cloud API): service module exists, dev stub. Payments: Culqi Checkout Custom, charge creation, 3DS handling, mock fallback, and webhook receipt are implemented; live cutover/refunds remain. FirmEasy client, document creation, signer links, HMAC webhook route, signed PDF retrieval, and tests are implemented; credentialed provider validation remains. Invoicing is still simulated |

---

## 1. Supabase Production Data Layer

**Status:** Done for MVP.

**What's done:** Production Supabase migrations are sequential and conflict-free in the repository. `database.types.ts` has been regenerated with current RPCs and corrected relationships. Adapter interfaces are unified around the async `server-types.ts` contract with `PaginationOptions` and `PaginatedResult`, and `getAll()` methods use `.range()` pagination with exact counts. `lib/adapters/factory.ts` and `lib/adapters/index.ts` provide environment-independent adapter access. Env validation is wired through startup instrumentation, Supabase clients consume validated env exports, `.env.example` documents required variables, and `.github/workflows/check-types.yml` verifies generated types stay aligned with migrations.

**Remaining non-blocking cleanup:**

1.1. **Legacy demo adapter refactor**
   - Migrate legacy demo services (`packet-service.ts`, `signer-service.ts`, `notary-service.ts`, `evidence-service.ts`, `registry-service.ts`) away from direct sync mock-adapter imports
   - Decide whether demo mode should use the async adapter factory or keep a separate demo-only factory wrapper

1.2. **README local development notes**
   - Document local Supabase setup, migration reset workflow, required env vars, and type regeneration workflow in README

---

## 2. Admin Dashboard (`/admin`)

**What's done:** Full tabbed UI (Resumen, Agentes, Invitaciones, Cobertura, Usuarios) behind `requireApproved("admin")`. Realtor approval queue with all 10 fields, approve/reject with confirmation dialogs, and optional rejection reason stored in auth metadata. Notary invitation management: create form (email/province/department), token generation via DB default, `inviteUserByEmail`, list with resend/revoke, and display-derived expired status. Platform metrics: active users by role, packets by status, 30-day certifications, payment totals by status. Notary coverage: add/edit/toggle with normalized province matching. User management: server-side pagination, search/filtering, suspend/reactivate with confirmation. Server-side coverage validation at `createLeasePacket` and `submitToNotary` time.

**What remains:**

2.1. **Admin audit logging**
   - Add durable audit logging for `suspendUser`, `reactivateUser`, `approveRealtor`, `rejectRealtor`, invitation revoke/resend, and coverage add/edit/toggle
   - Add a general admin audit table or event model; `packet_audit_log` is packet-scoped and not suitable for global admin operations

2.2. **Optional durability improvements**
   - Move realtor rejection reason from auth metadata into a queryable profile/admin-audit field if it needs reporting, review history, or compliance retention
   - If expired invitations must be persisted as `expired`, add scheduled cleanup or an explicit server-side transition; current behavior is display-derived

---

## 3. Realtor Dashboard (`/agente`)

**What's done:**

- Production `DashboardShell` with `ProductionSidebarNav` behind `requireApproved("realtor")`: logout, profile display, notification bell/badge, and links to `/agente`, `/agente/nuevo-paquete`, `/agente/perfil`.
- Realtor layout passes a notification count for packets needing attention (`all_signed`, `needs_correction`).
- Dashboard home has 6 summary cards, including pending payments, plus a filterable packet table (status/date/search) with explicit signer progress (`signed/total`) fetched from Supabase.
- 6-step creation wizard: PDF upload to Storage with SHA-256 hash + magic bytes / EOF / pdf-lib validation, lease terms, signers, review, Culqi Checkout Custom payment with mock fallback, and send links — all via server actions creating `lease_packets`, `packet_signers`, `packet_documents`, and `payments` rows.
- Province coverage validation is client-side.
- Packet detail has timeline from `packet_audit_log`, signer progress cards, payment card, submit-to-notary action, document download for all types (`lease_original`, `signed_pdf`, `evidence_report`, `certified_lease`) with audit logging.
- Evidence report PDF generation uses `@react-pdf/renderer` with data from `evidence-data-collector.ts` and is currently manual when `status === "all_signed"`.
- 30-second polling exists for non-terminal packets.
- Profile settings support view/update name, phone, company, RUC + password change.

**What remains:**

3.1. **Creation wizard: payment polish and live cutover**
   - Culqi Checkout Custom, card/Yape method configuration, 3DS handling, server-side charge creation, mock fallback, idempotent payment attempt claiming, and signing-link payment gating are implemented
   - Complete live Culqi cutover with matching production keys, production webhook registration, controlled live transaction/refund smoke test, and mock transport disabled in production
   - Decide whether the current `draft` → `signing` status path after payment/link delivery is sufficient, or whether to add explicit `awaiting_payment` → `ready_to_send` intermediate states
   - Surface duplicate registry check results in the wizard UI (steps 2–4) before the user reaches payment — currently only checked server-side at `createLeasePacket` time (step 5), surfaced as an error toast

3.2. **Packet detail automation and live updates**
   - Auto-trigger evidence report generation when all signers complete (currently manual "Generar informe" button; `lib/jobs/enqueue.ts` is a `console.log` placeholder)
   - Advance packet status to `evidence_report_generated` after evidence report is generated (currently `generateEvidenceReportAction` only writes audit event and revalidates)
   - Replace 30-second polling with Supabase Realtime subscriptions (or keep polling as MVP fallback)
   - Wire `handleSendReminder` to a real server action (currently stub — toast only)

3.3. **Factura (invoice) PDF download**
   - Factura card exists but download button is disabled ("próximamente") — wire to real invoice PDF once invoice generation is implemented (see Section 11)

---

## 4. Document Handling Pipeline

**What's done:** PDF upload to Supabase Storage `documents` bucket at `packets/{id}/lease_original.pdf` with server-side validation (magic bytes `%PDF-` header, `%%EOF` trailer, `pdf-lib` structural parse, MIME type check, 50 MB limit). SHA-256 hash calculation via `computeSha256()`, stored in `lease_packets.document_hash` and `packet_documents.file_hash`, with `document_hash_recorded` audit trail entry. Evidence report PDF generation via `@react-pdf/renderer` with data from `evidence-data-collector.ts`, uploaded to `packets/{id}/evidence_report.pdf` with `packet_documents` row. Certified document PDF generation via `@react-pdf/renderer` with certification text, checklist summary, observations, hash table, triggered from `certifyAction`, uploaded to `packets/{id}/certified_lease.pdf` with `document_hash_recorded` audit entry (`stage: "final_certified"`). FirmEasy `document_signed` webhook retrieves and stores the signed PDF as `signed_pdf`. Signed-URL downloads for all document types (`lease_original`, `signed_pdf`, `evidence_report`, `certified_lease`) with `document_downloaded` audit logging. A unified PDF viewer now renders signed documents across signer, realtor, notary, and party flows with in-browser fallback download support.

**What remains:**

4.1. **Evidence report completeness**
   - Add realtor verification data to the evidence report (currently missing from `evidence-data-collector.ts`)
   - Replace stub property authority evidence text (`"Verificación pendiente de integración SUNARP"`) with real data when available
   - Auto-trigger evidence report generation when all signers complete (currently manual; see Section 3.2)

4.2. **Optional signed-PDF assembly fallback**
   - Keep `assembleSignedDocument()` and `mergeSignedPdfs()` available only as a fallback if FirmEasy does not return a complete multi-signer PDF in production validation

---

## 5. Payment Integration (Culqi)

Culqi payment code is implemented with a non-production mock fallback. The realtor must pay the VeraDoc fee before sending signing links — no completed payment, no links, no signing.

**Provider:** [Culqi](https://culqi.com)
**Documentation:** https://docs.culqi.com/es/documentacion
**API Reference:** https://apidocs.culqi.com/ (REST API v2.0)
**Checkout documentation:** https://docs.culqi.com/es/documentacion/checkout/checkout-custom

**Current documentation decision:** Use **Culqi Checkout Custom**, not Checkout v4. Culqi's Checkout v4 documentation says that version will be unavailable soon and directs merchants to Checkout Custom. The roadmap must not use the community React/Next.js example as the source of truth; implement against Culqi's official Checkout Custom and REST API documentation.

**Culqi capabilities relevant to VeraDoc:**
- PEN (Peruvian Sol) native currency support
- Credit/debit card processing (Visa, Mastercard, Amex, Diners) with 3D Secure authentication
- **Yape** integration using a phone number and the six-digit approval code generated in the Yape app
- **Billeteras móviles** QR payments (Yape, Plin, others) via Orders API
- **PagoEfectivo** for cash-based payments at agents/bodegas
- Client-side tokenization through Culqi-hosted Checkout Custom
- Webhooks for async event notification (charge success/failure, refund, order status)
- Devoluciones API for refund operations
- Separate integration and production environments selected by `test` or `live` API keys
- Test cards, 3DS test cases, and a documented Yape test identity

**Integration architecture (two-step tokenization model):**
1. **Frontend:** Load `https://js.culqi.com/checkout-js`, instantiate `CulqiCheckout(publicKey, config)`, and open the hosted checkout. Culqi captures the card or Yape data and exposes the generated token to the registered callback. Sensitive payment credentials do not pass through VeraDoc.
2. **Backend:** Send only the token ID to VeraDoc. VeraDoc creates a charge with `POST https://api.culqi.com/v2/charges`, using the private key on the server.
3. **Persistence:** VeraDoc records the attempt before contacting Culqi, then atomically records success/failure and advances the packet only after a successful verified charge.
4. **Reconciliation:** Webhooks and explicit API lookups reconcile provider state without duplicating a payment or packet transition.

**What's done:** Culqi Checkout Custom is wired into the packet creation wizard through a client-only wrapper that loads `https://js.culqi.com/checkout-js`, enables card and Yape, pre-fills the authenticated realtor email, and sends only the returned token ID to server actions. Server-side payment processing uses authoritative pricing from `pricing_config`, idempotent payment attempt claiming, `createCharge()`, 3DS continuation, safe provider error mapping, mock transport for non-production, payment confirmation notification, and a completed-payment gate before signing links. `payments` now supports intermediate/failed states, Culqi provider metadata, idempotency, token hashing, and webhook receipt tracking. `app/api/webhooks/culqi/route.ts` receives charge webhooks, deduplicates payloads, re-fetches the charge before mutation, and calls the payment success RPC. Culqi env validation and `.env.example` entries are in place.

**What remains:**

5.1. **Production account and live cutover**
   - Continue Culqi production-commerce approval and obtain matching `pk_live_xxx` / `sk_live_xxx` keys
   - Register production webhooks in CulqiPanel once the live commerce is enabled
   - Run a controlled low-value real transaction and refund, verify CulqiPanel/database/audit consistency, and disable mock payments in production
   - Never use production keys during automated tests or sales demos

5.2. **Refund handling via Culqi Devoluciones API**
   - Refund rules defined per packet state (see Section 26.3)
   - Implement refund server action accessible to admins:
      - `POST https://api.culqi.com/v2/refunds` with `{ amount, charge_id, reason }`
   - Verify the refundable amount against Culqi and local refund history before submitting
   - Track requested amount, reason, actor, Culqi refund ID, and provider status in structured data plus the audit log
   - Reconcile refund results through the API/webhook path; do not mark a payment refunded merely because the request was submitted
   - Confirm timing, commissions, and expired-card handling with the production commercial agreement/CulqiPanel before publishing customer-facing policy

5.3. **Admin reconciliation and payment operations**
   - Add an admin reconciliation action that fetches a Culqi charge by ID and repairs VeraDoc state only when the Culqi response, packet, amount, currency, and realtor metadata all agree
   - Add support/admin visibility for charge status, payment errors, webhook history, and manual exception handling (see Section 17.4 and 17.6)
   - Route retryable webhook processing through the async job queue in Section 14 when that infrastructure exists

5.4. **Status model and wizard polish**
   - Decide whether to keep the current `draft` → `signing` path after payment/link delivery or add explicit `awaiting_payment` → `ready_to_send` intermediate states
   - Surface duplicate registry check results in the wizard UI before payment instead of only returning an error from `createLeasePacket`
   - Keep PagoEfectivo, mobile-wallet QR Orders API, and order-status webhooks post-MVP

---

## 6. Signing Link Generation and Delivery

**What's done:** Token generation via `crypto.randomBytes(32)` with SHA-256 hash stored in `signing_tokens.token_hash`, 7-day expiration, all signer metadata (email, WhatsApp, DNI, name, role). Link format `${getBaseUrl()}/firma/${rawToken}` (defaults to `https://veradoc.pe`); raw token never stored in DB. Delivery via `signing-link-delivery.ts` orchestrating email (Resend) + WhatsApp (Meta Cloud API template `signing_link_invite`), both delivering the same link, with `signing_link_delivered` audit event including per-channel status. Hash-only token lookup via `lookup_signing_context` RPC (service_role only, `SELECT` revoked on `signing_tokens`). Expired tokens return friendly "Este enlace de firma ha expirado" message via `SigningTokenError`. The checked-in SQL now includes `account_created` tokens in `lookup_signing_context`, matching the production route layout's expectation for steps after account creation.

**What remains:**

6.1. **Rate-limit token lookups on the live path**
   - `enforceTokenLookupRateLimit` exists in `lib/security/rate-limit.ts` (in-memory, 10 attempts/60s) but is only used in `openLinkAction`, which is dead code — `resolveSigningContext` (used by layout.tsx) has no rate limiting
   - Consider IP-based rate limiting on the layout resolution path, or middleware-level protection

6.2. **Deployment verification: token lifecycle after account creation**
   - The checked-in migration for `lookup_signing_context` already includes `account_created`, so the repository no longer reflects the original blocker
   - Before launch, verify the deployed Supabase function matches the checked-in migration so steps 4–8 continue resolving the token correctly in production

6.3. **Re-send token management**
   - Re-sending signing links creates new tokens without revoking old ones — previous tokens remain valid until expiry
   - Add token revocation on re-send, or document the intentional multi-token design

6.4. **Delivery reliability**
   - Delivery is fire-and-forget (`.catch(console.error)`) — failures don't surface to the realtor
   - Both channels degrade silently without env vars (`EMAIL_API_KEY`, `WHATSAPP_API_TOKEN`) — no retry or idempotency
   - WhatsApp template `signing_link_invite` must be approved in Meta Business Manager before production use
   - Wire delivery through async job queue (see Section 14) for retry support

---

## 7. Signer Flow — Production (`/firma/[token]`)

**What's done:** Full production route group at `app/(signing)/firma/[token]/` with the core signer steps.

- **Layout:** Mobile-first layout (VeraDoc header, `max-w-md`, no sidebar), token resolution via `resolveSigningContext()` in layout wrapping children in `SigningContextProvider`.
- **Step 1 (Landing):** Token validation, expiration check, packet summary (property, realtor, role), resume logic via `getResumeRoute()`.
- **Step 2 (Account):** `createSignerAccount` server action, pre-filled email + password UI, status -> `account_created`, `signInWithPassword`.
- **Step 3 (Consent):** Consent text display from `lib/legal/consent-text.ts`, records timestamp/IP/user-agent, `signer_evidence` with type `consent_record`, status -> `consent_given`.
- **Step 4 (Identity):** DNI front/back + selfie upload to `evidence` bucket at `signers/{id}/{type}.{ext}`, `signer_evidence` row per upload, no automated KYC, status -> `identity_verified`.
- **Step 5 (Review):** PDF via the unified in-browser viewer with signed URL resolution, checkbox acknowledgment, `lease_reviewed` audit event.
- **Step 6 (Signature):** FirmEasy signer-link lookup redirects to the provider when configured; development stub is only allowed when explicitly enabled.
- **Step 7 (Completion):** Confirmation screen waits for webhook-driven completion, polls signer status when returning from FirmEasy, checks all signers, updates packet to `all_signed`, dashboard link by role.
- **Status reconciliation:** Mapping layers in `lib/adapters/status-maps.ts` and `lib/domain/status-mapping.ts`, `advance_signer_status` RPC enforces correct transition order.

**What remains:**

7.1. **Step 6 — FirmEasy validation and signer verification**
   - FirmEasy signer link creation, redirect, webhook callback, `signature_records` creation, signed PDF retrieval, and post-signature hash storage are implemented
   - Validate the end-to-end provider flow with real FirmEasy sandbox/staging credentials and the official Postman collection
   - Switch signer verification from the current FirmEasy `otp_email` flow to `otp_whatsapp` if WhatsApp OTP remains a launch requirement
   - Confirm whether VeraDoc's own pre-signing OTP/account gate should remain as an identity/access layer or be removed once FirmEasy WhatsApp OTP is active

7.2. **Step 7 — Completion pipeline**
   - `enqueueEvidenceReport` in `lib/jobs/enqueue.ts` is a synchronous placeholder and is not wired into the FirmEasy webhook completion path
   - Wire automatic evidence report generation when all signers are complete (or enqueue via async job queue — see Section 14)
   - Advance packet status from `all_signed` to `evidence_report_generated` (currently stops at `all_signed`)

7.3. **Deployment verification: post-account token resolution**
   - The checked-in SQL and route code are aligned on allowing `account_created` tokens during the remaining signing steps
   - Before launch, verify the deployed RPC still matches the checked-in migration; if production diverges, the fallback would be switching post-account steps to auth-session-based context resolution (see Section 6.2)

7.4. **Consent text legal review**
   - Current consent text in `lib/legal/consent-text.ts` is a placeholder (marked `TODO Section 20`) — must be reviewed and approved by legal counsel before signer flow goes live (see Section 20)

---

## 8. IOFE-Compliant Digital Signature Integration (FirmEasy)

The demo simulates the entire signing flow. Production uses **[FirmEasy](https://firmeasy.legal/)** (by Girasol.Pe) — a Peruvian digital signature platform authorized as an Entidad de Registro under Law 27269, accredited by INDECOPI, and aligned with ISO 27001 security standards. FirmEasy provides legally binding Firma Avanzada (advanced electronic signatures) with full legal validity in Peru, connected to RENIEC and SUNAT for identity validation.

**Provider:** FirmEasy (firmeasy.legal)
**Documentation:** https://docs.firmeasy.legal/
**Postman Collection:** Available from FirmEasy for API testing

**FirmEasy API capabilities relevant to VeraDoc:**
- REST API with JWT authentication
- Document management organized in folders (CRUD)
- Multi-signer document signing flows
- Timestamping (sellado de tiempo) for temporal integrity
- PDF lifecycle management (creation, signing, custody, retrieval)
- Webhooks: `document_signed` (all signers complete) and `signer_rejected` (a signer refuses)
- RENIEC/SUNAT validation integration
- WhatsApp OTP signer validation via FirmEasy's standard `otp_whatsapp` flow
- QR validation for signed documents
- DNIe/NFC-based qualified signing support

**What's done:** `lib/services/firmeasy` implements JWT authentication, document creation, document lookup, signed PDF retrieval, webhook registration/listing helpers, HMAC verification, and WhatsApp normalization. `sendSigningLinksAction` creates the FirmEasy document when configured, stores the document token and signer links, and sends VeraDoc signing links without FirmEasy automatic notifications. `/firma/[token]/firmar` redirects to the stored FirmEasy signer link, and `/firma/[token]/completado` waits for webhook-driven status updates. `app/api/webhooks/firmeasy/route.ts` handles `document_signed` and `signer_rejected`, validates HMAC, logs/deduplicates deliveries, retrieves the signed PDF, stores `signed_pdf`, upserts `signature_records`, writes `firmeasy_signature` evidence, advances signer statuses, and advances the packet to `all_signed`. FirmEasy migrations, env validation, database types, and Vitest coverage are in place.

**What remains:**

8.1. **Account, credentials, and legal validation**
   - Contract FirmEasy API plan and obtain sandbox/staging/live credentials
   - Validate the checked-in request/response mapping against FirmEasy's current Postman collection
   - Verify INDECOPI accreditation status and confirm Law 27269 compliance for lease signing use case
   - Confirm the final webhook signature header/body contract during onboarding

8.2. **Signer verification mode**
   - Switch from the current `otp_email` standard flow to FirmEasy `otp_whatsapp` if that remains the MVP requirement
   - Confirm whether VeraDoc should keep or remove its own OTP/account gate once FirmEasy WhatsApp OTP is active
   - Ensure the signer does not receive duplicate signing requests from VeraDoc and FirmEasy

8.3. **Provider evidence completeness**
   - Confirm which certificate-chain, timestamp, revocation, QR verification, and PDF-integrity fields FirmEasy returns in the selected plan
   - Map any additional FirmEasy evidence fields into the notary review UI and evidence report
   - Wire retryable webhook processing through the async job queue in Section 14 when available

8.4. **Production cutover acceptance**
   - Run a full sandbox packet through all signers, webhook processing, signed PDF storage, notary evidence review, and certification
   - Run a controlled live smoke test before allowing real users into the signer flow
   - Disable development stub signing outside approved local/CI environments

---

## 9. Notary Dashboard (`/notario`)

**What's done:** Dashboard shell with `ProductionSidebarNav` (Cola, Historial, Ganancias, Perfil) behind `requireApproved("notary")`, with notification badge counting unstarted assignments. Packet queue: 5-tab view (Pendientes, En revisión, Certificados, Requieren corrección, Rechazados) fetching from `notary_assignments` joined with `lease_packets`, showing packet code, address, realtor, signer count, submitted date, duplicate-registry warning icon. Historial page reuses same client in history mode. Packet evidence review at `/notario/paquetes/[packetId]` with 10 of 12 evidence sections implemented: inline lease document viewer, document hash timeline, signer identity evidence (signed URL links), signature validation panels, consent records, session/audit logs, property address metadata, realtor verification data, duplicate registry check, system flags (duplicate-overlap only). All data from production tables via `getPacketEvidenceReview()`. Images via signed URLs from `evidence` bucket (300s TTL). Interactive checklist panel with 13 items, per-item timestamps via `toggleChecklistItemAction()`, stored in `notary_review_checklists.checklist_data`, decision panel gated on `allChecked`. 4-decision panel with server actions: certify (creates `notary_certifications` row, generates certified document PDF, creates `registry_entries` row), certify with observations, return for correction, reject. Each updates `notary_assignments.decision`/`decided_at`, `lease_packets.status`, and writes audit log via `transition_packet_status` RPC. `startReviewAction` sets `under_review` + `review_started_at`. Earnings view: monthly breakdown of certified packets (both types), cumulative payout at hardcoded S/ 15.00/packet, with footnote that `certified_with_observations` counts. Profile: view accreditation, province, department, DNI, email (read-only); edit name, phone; password change.

**What remains:**

9.1. **Evidence review gaps**
   - Add evidence report summary section (section 12 of the evidence-review spec — currently missing)
   - Signer identity evidence shows signed URL links but no inline image preview/thumbnails
   - Property authority evidence shows address fields only — no SUNARP/authority data
   - System flags only reflect duplicate-overlap — add richer anomaly flags matching demo's `systemFlags` array

9.2. **Checklist audit completeness**
   - The checked-in notary action now reloads checklist state from `notary_review_checklists` before certification, so the original empty-checklist blocker is no longer reflected in the repository
   - Remaining gap: add `checklist_item_checked` audit events (see Section 16)

9.3. **Decision panel post-decision workflows**
   - Certified document generation and registry entry creation are synchronous — wire through async job queue (see Section 14) for reliability
   - Decision notification emails are wired; route them through async delivery with retry once the job queue exists
   - `correctionScope` is collected in the return-for-correction dialog UI but never sent to the server action
   - `complete_notary_decision` RPC exists in migration `00007` but is unused — notary actions duplicate the logic in TypeScript; consolidate to avoid double registry inserts

9.4. **Queue refinements**
   - Add priority flags to the packet queue (no priority field exists in schema or UI)
   - Fix duplicate-registry check date range in `getNotaryQueue()` — currently passes `start: null, end: null` defaulting to `1970-01-01` / `2099-12-31` instead of each packet's actual lease dates
   - Fix `check_duplicate_lease` RPC authorization when called via `createAdminClient()` (service_role has no `auth.uid()`, causing the RPC's authorization check to fail)

9.5. **Payout rate configuration**
   - Replace hardcoded `PAYOUT_RATE_PEN = 15` with contracted per-notary rate from database or configuration (see Section 26.4)
   - Add admin payout confirmation workflow (see Section 18.3)

---

## 10. Landlord and Renter Dashboards (`/arrendador`, `/arrendatario`)

**Status:** Done for MVP.

**What's done:** Both roles have layout shell with `PartySidebarNav` (Panel, Contratos, Perfil) behind `requireApproved()`. Dashboard home: contract list from `packet_signers` joined with `lease_packets` via `getPartyContracts()`, summary cards (total, pending signatures, certified), expired/certified status display via `StatusBadge`, and landlord renewal-eligible count. Contract detail at `/contratos/[packetId]`: role-verified access, document selection (best of `certified_lease` → `signed_pdf` → `lease_original`), inline PDF viewing plus download via signed URL with audit logging, evidence report download when available, evidence summary for own signing session (identity count, consent timestamp, signature status), status timeline from `packet_audit_log`, and landlord renewal action that creates a linked draft packet. Profile settings: view/edit name and phone, read-only email and DNI, password change via `changePasswordAction`.

---

## 11. Factura / Electronic Invoice Generation

Peruvian tax law requires electronic invoicing (factura electrónica / boleta) for commercial transactions.

11.1. **Select a factura provider or SUNAT integration path**
   - Options: Nubefact, Efact, Bizlinks, direct SUNAT UBL integration
   - The provider must generate XML (UBL 2.1) and PDF representations
   - Must support: factura (B2B with RUC) and boleta de venta (B2C with DNI)

11.2. **Create an invoice service module (`lib/services/invoice-service.ts`)**
   - `generateInvoice(paymentId: string, buyerData: BuyerData): Promise<Invoice>`
   - `getInvoicePdf(invoiceId: string): Promise<Buffer>`
   - Buyer data: realtor's company name, RUC, address (from profile)
   - Seller data: VeraDoc's company information (RUC, razón social, dirección fiscal)

11.3. **Invoice generation trigger**
   - Generate the factura after the packet is certified (not at payment time, in case of refund)
   - Revenue is recognized at certification time (see Section 26.2)
   - Store invoice reference in the `payments` table or a new `invoices` table
   - Store generated PDF in Supabase Storage

11.4. **Invoice access in realtor dashboard**
   - Download button in the packet detail view and a dedicated invoices section
   - Display: invoice number, issue date, amount, download link

---

## 12. Email Notification System

**Status:** Done for MVP.

**What's done:**

Full transactional email system using Resend, production-verified and delivering to inboxes.

**Infrastructure:**
- Provider: **Resend** (`resend` npm package v6.16+)
- Verified sending domain: `info.veradoc.pe` (SPF ✓, DKIM ✓, region `sa-east-1`)
- Sender address: `VeraDoc <notificaciones@info.veradoc.pe>`
- Supabase Auth custom SMTP enabled in the Supabase dashboard using Resend (`smtp.resend.com:465`) with sender `VeraDoc <notificaciones@info.veradoc.pe>`
- API key env var: `EMAIL_API_KEY` (validated via Zod in `lib/env/server.ts`, optional for graceful degradation)
- Transport: `lib/services/email-service.ts` — singleton `Resend` client, `sendEmail()` for single sends, `sendBatchEmails()` for multi-recipient (e.g. certification notifications)
- Dispatch: `lib/services/notifications.ts` — typed, non-blocking notification functions per lifecycle event (fire-and-forget via `void`, failures logged but never block the action)

**Design system (`lib/services/email-templates/layout.ts`):**
- Typography: Source Serif 4 (headings), Source Sans 3 (body) — matching the site's font pairing, with web-safe fallbacks
- Colors: warm parchment background `#f6f0e4`, foreground `#2b241d`, surface `#fbf7ef`, primary dark brown `#3c2a1d`, accent `#a75634`, muted `#6d6256`, border `#d9c9b4`
- Layout: centered, max-width 560px, 8px border-radius white card with `#d9c9b4` border on warm parchment background
- Logo: VeraDoc email logo hosted in Supabase Storage (`brand-assets/veradoc-email-logo.png`)
- Helper utilities: `emailHeading()`, `emailParagraph()`, `emailButton()`, `emailTable()`, `emailInfoBox()` (neutral/warning/error), `emailDivider()`, `emailSmall()`
- Preheader text support for inbox previews
- Concise, minimal copy — no unnecessary disclaimers

**Supabase Auth templates deployed (4):**

All Supabase Auth emails use the same VeraDoc branding from `lib/services/email-templates/layout.ts`: warm parchment background (`#f6f0e4`), white card with `#d9c9b4` border, Supabase Storage logo, Source Serif 4 headings, Source Sans 3 body text, dark brown CTA button (`#3c2a1d`), Spanish copy, and footer `VERADOC S.A.C.S. · RUC 20616178548 · Lima, Perú`.

| Template | Subject | Button |
|---|---|---|
| Invite user | Te han invitado a VeraDoc | Aceptar invitacion |
| Magic link | Tu enlace de acceso a VeraDoc | Iniciar sesion |
| Reset password | Restablecer tu contrasena de VeraDoc | Restablecer contrasena |
| Confirm sign up | Confirma tu correo en VeraDoc | Confirmar correo |

**Supabase Auth template files:**
- `supabase/config.toml` references the four local template files
- `supabase/templates/*.html` contains the branded HTML templates
- `scripts/deploy-email-templates.sh` configures Resend SMTP and deploys the templates for CI/CD reuse

**Legal compliance (Ley N° 28493 — Perú):**
- Footer: "VERADOC S.A.C.S. · RUC 20616178548 · Lima, Perú" + link to veradoc.pe
- Transactional emails exempt from opt-out per the law; no unsubscribe link required

**Templates implemented (11):**

| # | Template | Recipient | Trigger |
|---|---|---|---|
| 1 | Solicitud recibida | Realtor | Signup (`signupRealtor`, `completeGoogleSignup`) |
| 2 | Cuenta aprobada | Realtor | Admin approves (`approveRealtor`) |
| 3 | Solicitud no aprobada | Realtor | Admin rejects (`rejectRealtor`) |
| 4 | Invitación a firmar | Signer | Realtor sends signing links |
| 5 | Firma completada | Signer | Signer completes (`completeSigningAction`) |
| 6 | Todos los firmantes completaron | Realtor | All signers done (`completeSigningAction`) |
| 7 | Nuevo paquete para revisión | Notary | Realtor submits (`submitToNotaryAction`) |
| 8 | Contrato certificado | All parties (batch) | Notary certifies (`certifyAction`) |
| 9 | Paquete devuelto para corrección | Realtor | Notary returns (`returnForCorrectionAction`) |
| 10 | Paquete rechazado | Realtor | Notary rejects (`rejectAction`) |
| 11 | Pago confirmado | Realtor | Payment processed (ready for Culqi integration) |

**Integration points:**
- `lib/auth/actions.ts` — `signupRealtor`, `completeGoogleSignup` → signup confirmation; `approveRealtor` → approved; `rejectRealtor` → rejected
- `lib/actions/signing.ts` — `completeSigningAction` → signer completion + all signers complete (to realtor)
- `lib/actions/agente-actions.ts` — `submitToNotaryAction` → packet submitted (to notary)
- `lib/actions/notary.ts` — `certifyAction` → certified (batch to all parties); `returnForCorrectionAction` → needs correction; `rejectAction` → rejected

**What remains (non-blocking):**

12.1. **Async delivery with retry**
   - Emails are currently sent synchronously (fire-and-forget via `void`) — route through async job queue when Section 14 is implemented for retry/dead-letter support

---

## 13. Evidence Report Generation

**What's done:** `lib/services/evidence-data-collector.ts` queries all relevant production tables (`signer_evidence`, `signature_records`, `packet_audit_log`, `packet_documents`, duplicate check via `check_duplicate_lease` RPC). `lib/pdf/generate-evidence-report.ts` renders via `@react-pdf/renderer`, uploads to Storage, creates `packet_documents` row. `lib/pdf/evidence-report-template.tsx` includes sections for: packet metadata, hash timeline, signer identity summaries, consent records, signature validation, property metadata, duplicate check, system flags, session logs, notary summary. Manual trigger via `generateEvidenceReportAction` from realtor packet detail.

**What remains:**

13.1. **Auto-trigger evidence report**
   - Wire automatic generation when all signers reach `complete` status via the async job queue (see Section 14) — currently manual-only
   - Advance packet status to `evidence_report_generated` after report creation (currently status is not updated)

13.2. **Evidence report data completeness**
   - Add realtor verification data (DNI, license, company, RUC) — currently missing from `evidence-data-collector.ts`
   - Replace stub property authority evidence text (`"Verificación pendiente de integración SUNARP"`) with real SUNARP data when available
   - Certificate chain / signature sections should be expanded once FirmEasy sandbox/live validation confirms the final provider evidence fields

---

## 14. Async Job Infrastructure

Without a job system, every server action that touches email, WhatsApp signing-link delivery, PDF generation, or payment webhooks becomes a synchronous blocking call that can time out, leave state inconsistent, or silently drop work. This section defines the infrastructure that Sections 4, 5, 6, 7, 10, 12, 13, and 14 depend on for reliability.

14.1. **Select a job queue approach**
   - **Option A — Supabase pg_net + Edge Functions:** Use `pg_net` to HTTP-call Edge Functions from database triggers or pg_cron. Low infrastructure overhead, native to Supabase.
   - **Option B — Supabase Queues (pgmq):** Supabase's built-in queue primitive. Messages are Postgres rows, consumers are Edge Functions or cron-invoked workers.
   - **Option C — External queue (Inngest, Trigger.dev, QStash):** Managed job queue with dashboard, retry policies, and dead-letter support out of the box. More setup but better visibility.
   - Recommendation for MVP: Option B (Supabase Queues) or Option C (Inngest/Trigger.dev) depending on team familiarity. Option A is viable but has less visibility into failures.

14.2. **Job types to implement**

   | Job | Trigger | Consumer |
   |---|---|---|
   | `email.send` | Any lifecycle event requiring notification | Email service (Section 12) |
   | `whatsapp.send_signing_link` | Realtor sends signing links | WhatsApp delivery path (Section 6) |
   | `culqi.process_webhook` | Inbound Culqi webhook (`charge.*`, `refund.*`) | Culqi service (Section 5) |
   | `evidence.generate_report` | All signers complete | Evidence service (Section 13) + PDF generation (Section 4) |
   | `document.generate_certified_pdf` | Notary certifies | PDF generation (Section 4) |
   | `invoice.generate` | Packet certified | Invoice service (Section 11) |
   | `registry.create_entry` | Packet certified | Registry service |
   | `firmeasy.process_webhook` | Inbound FirmEasy webhook (`document_signed`, `signer_rejected`) | FirmEasy service (Section 8) |
   | `signing_token.cleanup_stuck` | Cron (every 5 minutes) | Token reconciliation |

14.3. **Retry policy**
   - Default: 3 retries with exponential backoff (5s, 30s, 180s)
   - Email sends: 5 retries (transient provider failures are common)
   - Culqi webhooks: idempotent, retried by Culqi; our consumer must be idempotent (verify charge status via API before updating)
   - PDF generation: 2 retries (if it fails twice, the data may be bad)
   - FirmEasy callbacks: 3 retries with longer backoff (30s, 120s, 600s) — provider may have transient outages

14.4. **Dead-letter handling**
   - Jobs that exhaust all retries are moved to a dead-letter table/queue
   - Dead-letter entries record: job type, payload, failure reason, all attempt timestamps, last error
   - Admin dashboard (Section 17) surfaces dead-letter counts as an alert
   - Operational playbook: which dead-letter types require manual intervention vs. safe to re-enqueue

14.5. **Stuck-token cleanup job**
   - Runs every 5 minutes via pg_cron or scheduled Edge Function
   - Resets `signing_tokens` in `claiming` status for >5 minutes back to the previous resumable status
   - Logs each reset in the audit trail

14.6. **Job observability**
   - Every job execution logs: job ID, type, start time, end time, success/failure, retry count
   - Expose job metrics in the admin dashboard: queue depth, processing latency, failure rate
   - Alert on queue backup (>50 pending jobs) or high failure rate (>10% in 15-minute window)

---

## 15. Notary Assignment and Routing

**What's done:** `submitToNotaryAction` in `lib/actions/agente-actions.ts` queries `notary_coverage` for an active notary covering the packet's province, auto-assigns the first match, creates `notary_assignments` row, updates `lease_packets.status` via `transition_packet_status`, writes audit event, and revalidates. Error returned if no coverage. Realtor sees assignment status and notary info in packet detail. Notary sees assignments in their queue.

**What remains:**

15.1. **Multi-notary routing**
   - Currently picks the first covering notary via `.limit(1).single()` — add round-robin or load-balance by current queue size when multiple notaries cover the same province

15.2. **Status gate alignment**
   - `submitToNotaryAction` validates packet status is `all_signed`, not `evidence_report_generated` as the roadmap specifies — align the status gate once evidence report auto-generation is wired (see Section 7.2)

15.3. **Notification**
   - Assigned-notary notification email is wired; move it to the async job queue once Section 14 exists

---

## 16. Audit Logging

**What's done:** The `packet_audit_log` table exists with `actor_id`, `ip_address` (inet), and `metadata` (jsonb). Production code writes to it extensively: `document_hash_recorded` (upload and certified), `signing_links_sent`, `signing_link_delivered`, `lease_reviewed`, `document_downloaded`, plus all status transitions via `transition_packet_status` RPC (which auto-inserts audit rows for `packet_created`, `submitted_to_notary`, `packet_certified`, `packet_rejected`, `packet_returned`, etc.). Signer evidence events (consent, identity, and signature) are recorded in `signer_evidence`, not `packet_audit_log`. IP address captured from `x-forwarded-for` / `x-real-ip` headers in consent and review actions.

**What remains:**

16.1. **Create a centralized audit service**
   - `logEvent(packetId, actorId, action, metadata?, ipAddress?)` function to standardize audit writes across all server actions — currently audit inserts are scattered inline with different patterns (some via adapter `insertAuditEvent`, some via direct admin client insert, some via RPC)

16.2. **Missing audit events**
   - `checklist_item_checked` — notary checks a checklist item (not logged, only stored in `notary_review_checklists`)
   - Admin actions: `suspendUser`, `reactivateUser`, `approveRealtor`, `rejectRealtor` — no admin audit trail exists (see Section 2.2)
   - `evidence_report_generated` — currently only written as metadata, not as a formal audit event with status

16.3. **IP address coverage**
   - Not all server actions capture IP — extend IP extraction to all audit-producing actions (currently only in consent and review steps)

---

## 17. Support and Admin Operations

Production systems need operational tooling beyond the approval queue and metrics in Section 2. When a signer reports a broken link, a payment webhook silently fails, or a notary encounters a stuck packet, support staff need the ability to diagnose and resolve without direct database access.

17.1. **Packet search and lookup**
   - Search by: packet ID, signer email, signer DNI, Culqi charge ID, document hash
   - Results show: packet status, all signers with status, payment status, notary assignment, timestamps
   - Accessible to admin role only

17.2. **Signing link operations**
   - Resend signing link (re-deliver via email and/or WhatsApp without generating a new token)
   - Expire a signing token manually (e.g., signer reports link compromised)
   - Reissue a new token for the same signer (invalidate old, generate new, deliver)
   - View token status history: created, account created, expired, etc.

17.3. **Delivery log viewer**
   - View all email and WhatsApp delivery attempts for a given packet or signer
   - Show: message type, recipient, provider message ID, delivery status (sent/delivered/failed/bounced), timestamp
   - Filter by delivery status to find failures

17.4. **Payment exception handling (Culqi)**
   - View payment details: amount, Culqi charge ID (`chr_live_xxx`), status, webhook history
   - Query Culqi API (`GET /v2/charges/{id}`) to verify charge status when webhook is suspected to have failed
   - Manually mark a payment as completed (for cases where the Culqi webhook failed but the charge succeeded — verify via Culqi API or CulqiPanel)
   - Manually mark a payment for refund review
   - All manual overrides logged in the audit trail with admin actor ID

17.5. **Stuck signer state resolution**
   - View the signer's current status, last status change timestamp, and expected next step
   - Manually advance or reset a signer's status (e.g., signer stuck in `claiming` due to a race condition)
   - Reset requires confirmation and records the override in the audit log
   - Guard rails: only allow transitions that the state machine defines or one-step regressions

17.6. **Webhook history viewer**
   - View raw inbound webhooks from Culqi (payment/refund events), WhatsApp provider, and FirmEasy signature provider
   - Show: timestamp, provider, HTTP status, request body (PII redacted), processing result
   - Re-process a failed webhook (re-enqueue the job)

17.7. **Audit bundle export**
   - Export a complete audit bundle for a single packet as a downloadable ZIP or PDF
   - Includes: full audit log, all signer evidence metadata, signature records, payment records, notary decision, delivery logs, document hash history
   - Used for legal/support review, dispute resolution, or regulatory inquiry
   - Accessible to admin role only

---

## 18. Post-Certification Workflow

**What's done:** Registry entry creation is synchronous in `certifyAction` — inserts `registry_entries` row with property address/unit, landlord DNI, renter DNI, lease dates, certification date. Certified document PDF is generated synchronously and uploaded to storage. Notary earnings view counts monthly certifications (both `certified` and `certified_with_observations`) with hardcoded payout rate.

**What remains:**

18.1. **Certified document distribution**
   - After notary certification, automatically notify all parties (realtor, landlord(s), renter(s)) via email (enqueued through job queue — see Section 14)
   - Each notification includes a link to their dashboard where they can download the document

18.2. **Async post-certification pipeline**
   - Registry entry creation and certified document generation are synchronous — move to async job queue for reliability (see Section 14)

18.3. **Notary payout tracking**
   - Replace hardcoded `PAYOUT_RATE_PEN = 15` with contracted per-notary rate
   - Add admin payout confirmation workflow (review and approve monthly payout reports before disbursement)
   - Implement payout method integration (bank transfer or manual disbursement — see Section 26.4)

---

## 19. Real-Time Status Updates

**What's done:** 30-second polling via `setInterval` + `router.refresh()` on non-terminal packets in realtor packet detail (`packet-detail-client.tsx`). Notary notification badge counts unstarted assignments on layout load. Realtor notification badge counts packets needing attention (`all_signed`, `needs_correction`) on layout load.

**What remains:**

19.1. **Supabase Realtime subscriptions (upgrade from polling)**
   - Subscribe to `packet_signers` changes for the current packet (realtor view)
   - Subscribe to `lease_packets` status changes (all dashboards)
   - Subscribe to `notary_assignments` changes (notary queue)
   - Or keep 30-second polling as MVP fallback — current UX is functional if not instantaneous

---

## 20. Legal and Compliance (Launch Blocker)

This section is designated a **launch blocker**, not a polish item. The signing flow collects DNI photos, biometric selfies, and consent for notarial submission. If the consent text is legally deficient or the data-handling practices violate Ley 29733, every packet signed before a fix is legally questionable. Legal review must be completed before the signer flow goes live.

20.1. **Terms of Service and Privacy Policy**
   - Legal review of ToS for the Peruvian market
   - Privacy policy compliant with Peruvian data protection law (Ley N° 29733 — Ley de Protección de Datos Personales)
   - Both must be published and linked from the platform before any real user data is collected

20.2. **Consent text for the signing flow**
   - Must be reviewed and approved by legal counsel before the signer flow launches
   - Must explicitly state: what data is collected (DNI, selfie, WhatsApp number, IP, device info), how it is stored (encrypted at rest in Supabase Storage), who receives it (the assigned notary, the creating realtor, VeraDoc platform), how long it is retained, and the user's rights under Ley 29733
   - Separate consents: data processing consent and notarial submission consent
   - Consent acceptance must record: timestamp, full consent text version hash, IP address, user-agent

20.3. **Data retention policy**
   - Define retention duration for each data type:
     - Lease packets and certified documents: minimum retention per Peruvian notarial record-keeping requirements
     - Signer identity evidence (DNI photos, selfies): retain for the duration of the lease + a defined post-expiration period, then delete or anonymize
     - Audit logs: retain indefinitely (or per legal requirement)
     - Account data: retain while account is active; delete or anonymize on user request within 30 days
   - Implement soft-delete or archival for expired leases
   - Scheduled job to identify and process retention-expired data

20.4. **User data export and deletion**
   - Provide a mechanism for users to request export of their personal data (Ley 29733 right of access)
   - Provide a mechanism for users to request deletion/anonymization of their data (right of deletion)
   - Admin tooling to process export and deletion requests (see Section 17)
   - Deletion must cascade: remove from Storage, anonymize in database tables, log the deletion event

20.5. **PII access controls**
   - DNI photos and selfie evidence are accessible only to: the signer themselves, the creating realtor, the assigned notary, and admins
   - Storage signed URL expiration: 5 minutes for evidence images (prevents sharing of persistent links)
   - RLS policies already enforce this at the database level; verify the same enforcement exists at the Storage level
   - Admin access to PII-bearing data is logged in the audit trail

20.6. **Notary contract template**
   - Legal agreement between VeraDoc and contracted notaries
   - Define: payout terms, certification obligations, liability, data access scope, confidentiality

20.7. **FirmEasy / Law 27269 compliance verification**
   - Confirm FirmEasy's current INDECOPI accreditation as Entidad de Registro under Law 27269
   - Document the certificate chain validation process (FirmEasy provides timestamping + RENIEC-linked identity)
   - Ensure the notarial evidence report format meets Peruvian notarial law requirements
   - Verify FirmEasy's Firma Avanzada qualifies for the specific use case (lease contract signing between parties)

20.8. **Incident response plan**
   - Define roles and procedures for data breach notification (Ley 29733 requires notification to the Autoridad Nacional de Protección de Datos Personales)
   - Define response procedures for: compromised signing tokens, leaked DNI evidence, unauthorized admin access, provider security incidents
   - Document escalation path and communication templates

---

## 21. Security Hardening

21.1. **Input validation**
   - All server actions already use Zod schemas — extend this to all new endpoints
   - Validate DNI format (8 digits for Peruvian DNI)
   - Validate phone format (+51 9-digit mobile numbers)
   - Validate RUC format (11 digits)
   - Sanitize all user-provided text before storage

21.2. **Rate limiting**
   - Login attempts: max 5 per minute per email
   - Signing-link sends: rate-limit resend attempts per packet/signer/channel
   - Signup: max 3 per hour per IP
   - API routes: general rate limiting via middleware or Vercel's built-in rate limiting

21.3. **CSRF and webhook security**
   - Server actions in Next.js have built-in CSRF protection
   - Validate webhook authenticity: Culqi webhooks should be verified by re-fetching the charge/refund object from the API; FirmEasy uses shared secret; WhatsApp uses HMAC signature
   - Use HMAC verification on all inbound webhooks where supported

21.4. **Content Security Policy**
   - Configure CSP headers to prevent XSS
   - Allow only trusted domains for scripts, styles, fonts, and image sources

21.5. **Data encryption**
   - DNI images are PII — consider client-side encryption before upload (post-MVP)
   - At minimum: Supabase Storage encrypts at rest
   - Signing tokens are already hashed before storage

---

## 22. Observability and Alerting

Generic error tracking (Sentry) catches exceptions but does not catch state-machine desynchronization, silent webhook failures, or business logic that completes partially. This section defines domain-specific monitoring that detects the production failure modes that actually hurt.

22.1. **Error tracking**
   - Install Sentry (or similar) for unhandled exception tracking
   - Configure source maps for production stack traces
   - Set up Supabase dashboard alerts for database health (connection pool exhaustion, high query latency)
   - Set up uptime monitoring for the production URL

22.2. **Domain-event anomaly alerts**
   These are the high-value alerts that catch business-logic failures Sentry will miss:

   | Alert | Condition | Severity |
   |---|---|---|
   | Payment orphan | Culqi charge `outcome.type === "venta_exitosa"` but `lease_packets.status` not advanced past `awaiting_payment` within 5 minutes | Critical |
   | Evidence generation failure | All signers `complete` but no `evidence_report_generated` event within 10 minutes | Critical |
   | Certified document failure | `packet_certified` audit event but no `certified_lease` document in storage within 10 minutes | Critical |
   | Invoice generation failure | Packet certified but no invoice generated within 30 minutes | High |
   | FirmEasy callback failure rate | >10% of signing session callbacks fail in a 1-hour window | High |
   | Signing link delivery failure | Signing link email or WhatsApp send fails (any single failure) | Medium |
   | Stuck signer | Signer in a non-terminal status with no status change for >48 hours | Medium |
   | Dead-letter queue backup | >5 jobs in dead-letter queue | Medium |
   | Queue processing latency | Average job processing latency >60 seconds over 15-minute window | Medium |
   | Token cleanup residuals | >10 tokens reset from `claiming` in a single cleanup run (indicates a systemic race condition) | Medium |

22.3. **Implementation approach**
   - Alerts can be implemented as:
     - Supabase pg_cron jobs that query for anomalous state and call a webhook (Slack, PagerDuty, email)
     - Supabase Edge Functions on a schedule that run the anomaly queries
     - If using Inngest/Trigger.dev for jobs (Section 14), their built-in alerting covers queue-level metrics
   - Critical alerts should page (Slack + email at minimum); Medium alerts should notify (Slack channel)

22.4. **Admin dashboard health panel**
   - Surface current alert status in the admin dashboard (Section 22.4)
   - Show: active critical/high alerts, dead-letter queue count, job queue depth, last successful runs for each job type

---

## 23. Pricing Page (`/precios`)

The route exists with metadata and positioning copy, but it still lacks actual pricing presentation and conversion UI.

23.1. **Design pricing tiers (business decision)**
   - Define: MVP pricing model (per-packet, monthly subscription, or hybrid)
   - Define the fee amount (business decision — see Section 26)
   - Define what the fee includes (signing, notarization, storage, factura)

23.2. **Build pricing UI**
   - Pricing cards with features comparison
   - CTA: "Crear cuenta" linking to `/auth/signup`
   - FAQ section addressing common questions about pricing and payment methods

---

## 24. Contact Page (`/contacto`)

Referenced in navigation but never created.

24.1. **Build contact page**
   - Contact form: name, email, company, message, category (general, support, partnership, notary inquiry)
   - VeraDoc contact information: email, phone, address
   - Server action or API route to receive form submissions
   - Store inquiries in a database table or forward via email

---

## 25. Mobile Responsiveness and UX Polish

25.1. **Signer flow mobile optimization**
   - The signer flow is the most critical mobile experience (landlords and renters will use phones)
   - Test and optimize all 8 steps on small screens (375px width)
   - Camera access for DNI photos and selfie must work on mobile browsers (iOS Safari, Android Chrome)
   - PDF viewer must be readable on mobile

25.2. **Dashboard responsive design**
   - Realtor and notary dashboards should work on tablets (768px+)
   - Mobile support for dashboards is lower priority (realtors and notaries likely use desktop)
   - Sidebar should collapse to a hamburger menu on smaller screens

25.3. **Loading states and error handling**
   - Skeleton loaders for all data-fetching pages
   - Toast notifications for success/error states (Sonner is already installed)
   - Friendly error pages for 404, 500, and unauthorized states
   - Retry mechanisms for failed operations

25.4. **Accessibility**
   - Keyboard navigation for all interactive elements
   - ARIA labels on buttons and form controls
   - Color contrast compliance (the paper aesthetic palette needs verification)
   - Screen reader support for status badges and progress indicators

---

## 26. Business Model Rules

Engineering needs concrete answers to these questions because they directly affect payment flow logic, database schema, refund processing, notary payout calculations, and invoice timing. The specific numbers are business decisions (marked **[TBD]**), but the *rules* must be defined before the corresponding code can be written.

26.1. **Who pays**
   - MVP model: the realtor pays a per-packet fee at packet creation time, before signing links are sent
   - The fee covers the full service: signing infrastructure, evidence report generation, notarial review, certified document storage, and factura
   - Landlords and renters do not pay anything
   - **[TBD]** Exact fee amount (e.g., S/ 49.90, S/ 79.90, S/ 99.90)
   - **[TBD]** Whether volume discounts or agency billing (monthly invoicing for high-volume agencies) are MVP or post-MVP

26.2. **When revenue is recognized**
   - Payment is collected at packet creation (before signing begins)
   - Revenue is recognized at certification time (when the notary certifies the packet)
   - This is the point at which the factura is generated (see Section 11.3)
   - If the packet is never certified (abandoned, rejected), the payment is held and subject to the refund rules below

26.3. **Refund rules by packet state**

   | Packet state at refund request | Refund? | Notes |
   |---|---|---|
   | `draft` / `awaiting_payment` | N/A | No payment has been collected |
   | `ready_to_send` (paid, links not yet sent) | Full refund | No work has been performed |
   | `sent_to_signers` / `partially_signed` | Partial or full refund | **[TBD]** — depends on whether provider costs (WhatsApp, signing) have been incurred |
   | `all_signed` / `evidence_report_generated` | No automatic refund | Significant platform work completed; manual review required |
   | `pending_notary` / `under_review` | No refund | Notary has been engaged |
   | `certified` / `certified_with_observations` | No refund | Service fully delivered |
   | `rejected` | **[TBD]** | Notary rejected the packet; business decision whether realtor gets a credit, partial refund, or nothing |
   | `needs_correction` | No refund | Packet can still be corrected and resubmitted |

   - All refunds are admin-initiated (no self-service refund for MVP)
   - Refund processing through Culqi Devoluciones API (`POST /v2/refunds`): supports partial and full refunds
   - Same-day refunds are immediate; post-day refunds take 15–30 business days to reflect in cardholder's account
   - Culqi deducts its commission from refunded amounts — net refund to customer is `amount - commission`

26.4. **Notary payout calculation**
   - Contracted per-packet rate: **[TBD]** (e.g., S/ 15.00 per certified packet)
   - Payout frequency: monthly
   - Payout is calculated from the count of packets certified during the calendar month
   - `certified_with_observations` counts toward payout (see 26.6)
   - Returned-for-correction packets that are later re-submitted and certified count once (at certification)
   - Rejected packets do not count toward payout
   - Admin confirms the monthly payout report before disbursement
   - **[TBD]** Payout method: bank transfer, manual disbursement, or integrated payout (Culqi does not provide marketplace-style payouts — notary payouts will likely be manual bank transfers or a separate payroll integration)

26.5. **Platform margin**
   - Margin = packet fee − notary payout − provider costs (Culqi processing fee, WhatsApp messaging, FirmEasy signing, Supabase storage)
   - Culqi processing fee: typically 3.99% + IGV for cards, variable for Yape (confirm current rates in CulqiPanel)
   - **[TBD]** Target margin percentage
   - Provider costs should be tracked per-packet for reporting and margin analysis

26.6. **"Certified with observations" handling**
   - Counts as a successful certification for all purposes: payout, invoice generation, document distribution, registry entry
   - The observations are included in the certified document and evidence report
   - The realtor and signers receive the same notifications as a standard certification
   - This is important to define explicitly because it affects payout logic, invoice triggers, and the notary earnings view

26.7. **Failed notarization handling**
   - **Rejected:** packet is terminal. Realtor is notified. Refund rules per 26.3 apply. No payout to notary. Realtor can create a new packet (new fee).
   - **Needs correction:** packet is returned to the realtor. Realtor can update the document or signer information and re-submit. No additional fee for re-submission. The packet retains its original payment. If the corrected packet is eventually certified, the original payment is recognized as revenue and the notary receives payout.
   - **Abandoned:** if a paid packet remains in a non-certified state for >90 days with no activity, it is auto-archived. **[TBD]** whether auto-archived packets trigger a refund credit or are forfeited.

---

## 27. Testing

Vitest is configured in the app-level toolchain with `test` and `test:watch` scripts. Current coverage is focused on FirmEasy service and webhook behavior; broader domain, action, and end-to-end coverage remains.

27.1. **Unit tests (priority targets)**
   - `packet-machine.ts` — verify all state transitions
   - `signer-machine.ts` — verify all state transitions
   - `lib/auth/schemas.ts` — verify all validation rules
   - Hash calculation functions
   - Adapter mapping functions (camelCase ↔ snake_case)

27.2. **Integration tests**
   - Server actions: test against a local Supabase instance
   - Payment webhook handler: test with mock payloads
   - Evidence report generation: test with seed data

27.3. **End-to-end tests**
   - Install Playwright
   - Critical path: realtor login → create packet → pay → verify signer receives link → signer completes flow → notary certifies
   - Auth flows: signup, login, pending approval, rejection

---

## 28. Deployment Infrastructure

28.1. **Hosting platform**
   - Vercel (natural choice for Next.js 16) or AWS Amplify
   - Configure environment variables in the deployment platform
   - Set up preview deployments for pull requests

28.2. **Domain and DNS**
   - Register and configure `veradoc.pe` domain
   - Set up SSL certificate (automatic with Vercel)
   - Configure DNS records for email delivery (SPF, DKIM, DMARC)

28.3. **Supabase project configuration**
   - Create production Supabase project
   - Run all migrations against production database
   - Configure auth settings: site URL, redirect URLs, email templates
   - Enable Supabase Storage with appropriate bucket configs
   - Set up database backups

28.4. **CI/CD pipeline**
   - Build verification on every PR
   - Lint check
   - Type check (`tsc --noEmit`)
   - Test suite
   - Auto-deploy main branch to production
   - Migration management: track which migrations have been applied

28.5. **Monitoring stack deployment**
   - Deploy Sentry project with source maps
   - Deploy anomaly-alert cron jobs / Edge Functions (Section 22)
   - Configure Slack webhook for alert delivery
   - Verify all domain-event alerts fire correctly in staging before production launch

---

## 29. Static Asset Follow-up

29.1. **Favicon and app icons**
   - `app/layout.tsx` icon references are already satisfied by `app/icon.png` and `public/brand/apple-icon.png`
   - Remaining optional cleanup: add `favicon.ico` to `public/` if browser/favicon compatibility beyond the current setup is required

29.2. **Optional Open Graph image selection**
   - Root Open Graph metadata is wired in `app/layout.tsx`
   - Optional cleanup: select a dedicated social image from `veradoc_media_kit` and add it to metadata if stronger social previews are needed

---

## Priority Order for Development

The phases below follow the actual packet lifecycle, so the team gets a testable vertical slice at each step. Each phase builds on the data and infrastructure from the previous one. Sections 4 (document pipeline basics), 6 (signing link generation), 7 (signer flow scaffold), 10 (notary dashboard core), and 11 (party dashboards) are substantially built — phases are resequenced to focus on the remaining gaps and integrations.

### Phase 1 — Foundation Fixes and Legal Clearance (Weeks 1–2)

**Engineering (critical bugs and infrastructure):**
- Section 6.2 / 7.3: Verify deployed `lookup_signing_context` matches the checked-in migration so post-account signer steps continue working in production
- Section 6.1: Wire rate limiting to `resolveSigningContext` live path
- Section 14.1: Select and scaffold the async job queue infrastructure

**Business/Legal (parallel, non-blocking for Phase 1 engineering but blocking for Phase 3+):**
- Section 20.1–20.2: Legal review of Terms of Service, Privacy Policy, and consent text — **must be approved before signer flow goes live**
- Section 20.8: Draft incident response plan
- Section 26: Finalize all **[TBD]** business model decisions (fee amount, refund rules, notary payout rate)

### Phase 2 — Culqi Payment Integration, Wizard Hardening, and Admin Polish (Weeks 3–4)
- Section 5: Culqi live cutover — complete production approval, install live keys, register production webhooks, run controlled live transaction/refund smoke test, and implement refund/admin reconciliation workflows
- Section 3.1: Wizard polish — decide payment status model and surface duplicate registry check results before payment
- Section 2: Admin remaining items (audit logging, rejection reason durability, expired invitation persistence if needed)
- Section 1.1–1.2: Legacy demo adapter cleanup and README local development notes
- Section 16: Audit logging (wire remaining events)

### Phase 3 — FirmEasy Signing and Signer Flow Completion (Weeks 5–7)
- Section 8: FirmEasy credentialed validation and production cutover
  - Contract FirmEasy API plan, obtain credentials, validate request/response mapping, and confirm webhook signature contract
  - Validate sandbox/live packet flow through signed PDF storage, notary evidence review, and certification
- Section 7.1: Finalize signer verification mode (`otp_email` vs `otp_whatsapp`) and decide whether VeraDoc's own OTP/account gate remains
- Section 7.2: Wire completion pipeline (auto evidence report + status advancement to `evidence_report_generated`)
- Section 7.4 / 20.2: Deploy approved consent text (legal must have signed off by now)

### Phase 4 — Notary Polish and Post-Certification (Weeks 8–9)
- Section 9.1: Evidence review gaps (report summary, inline images, property authority, system flags)
- Section 9.3: Decision post-workflows (async job queue, correction scope, consolidate duplicate RPC logic)
- Section 9.4: Queue refinements (priority flags, registry date range fix, RPC authorization fix)
- Section 15: Notary assignment refinements (multi-notary routing, status gate alignment)
- Section 18: Post-certification workflow (distribution emails, payout tracking with real rates)
- Section 14.2–14.4: All remaining job types and dead-letter handling

### Phase 5 — Party Dashboards, Invoicing, and Operations (Weeks 10–11)
- Section 3.3: Wire factura PDF download in realtor packet detail (depends on Section 11)
- Section 11: Factura / electronic invoice generation
- Section 17: Support and admin operations (search, resend links, payment exceptions, stuck state resolution)
- Section 22: Observability and domain-event alerting
- Section 4.1: Evidence report completeness (realtor verification data, property authority)

### Phase 6 — Hardening and Launch (Weeks 12–14)
- Section 21: Security hardening (rate limiting, CSP, input validation)
- Section 27: Testing (unit, integration, E2E critical paths)
- Section 28: Deployment infrastructure (CI/CD, monitoring stack, DNS)
- Section 19: Real-time status updates (upgrade 30s polling to Supabase Realtime, or keep polling as MVP fallback)
- Section 23: Pricing page
- Section 24: Contact page
- Section 25: Mobile responsiveness and UX polish
- Section 20.3–20.7: Remaining compliance items (data retention automation, export/deletion tooling, FirmEasy/Law 27269 compliance verification)

---

## Total Estimated Scope

| Category | Section | Remaining sub-items | Effort | Notes |
|---|---|---|---|---|
| Data layer and adapters | 1 | 2 | Small | Legacy demo adapter cleanup and README local development notes remain |
| Admin dashboard | 2 | 2 | Small | Durable admin audit logging and optional durability improvements remain |
| Realtor dashboard | 3 | 3 | Small-Medium | Culqi live cutover/payment polish, packet detail automation/reminders, and factura remain |
| Document pipeline | 4 | 2 | Small | Evidence completeness and optional signed-PDF assembly fallback remain |
| Payment integration (Culqi) | 5 | 4 | Medium | Checkout Custom, card/Yape, 3DS, mock fallback, persistence, webhook receipt, and payment gating are implemented; live cutover, refunds, reconciliation, and status/wizard polish remain |
| Signing link delivery | 6 | 4 | Small | Core done; live-path rate limiting, deployed-RPC verification, and delivery reliability remain |
| Production signer flow | 7 | 4 | Medium | Routes/steps done; FirmEasy validation, completion pipeline, deployed token-resolution verification, and consent review remain |
| FirmEasy signing | 8 | 4 | Medium (external dependency) | Client, document creation, signer links, webhook route, signed PDF storage, and tests are implemented; credentials/legal validation, signer verification mode, evidence mapping, and live cutover remain |
| Notary dashboard | 9 | 5 | Medium | Core workflow and decision emails done; evidence review polish, async jobs, queue fixes, and payout configuration remain |
| Landlord/renter dashboards | 10 | 0 | Done for MVP | Expired display, evidence report download, and landlord renewal flow are implemented |
| Factura/invoicing | 11 | 4 | Medium | Unchanged |
| Email notifications | 12 | 1 | Small | Resend transactional emails and Supabase Auth SMTP/templates are configured; async retry remains |
| Evidence report | 13 | 2 | Small-Medium | PDF generation done; auto-trigger and completeness gaps remain |
| Async job infrastructure | 14 | 6 | Medium-Large | Unchanged — `enqueue.ts` is a stub |
| Notary routing | 15 | 3 | Small | Basic routing done in `submitToNotaryAction`; multi-notary and status gate remain |
| Audit logging | 16 | 3 | Small | Many events already logged; remaining: `checklist_item_checked`, admin audit, completeness |
| Support/admin operations | 17 | 7 | Medium-Large | Unchanged |
| Post-certification | 18 | 3 | Small-Medium | Registry entry done synchronously; email distribution and payout tracking remain |
| Real-time updates | 19 | 1 | Small | 30s polling exists; Realtime upgrade remains |
| Legal/compliance | 20 | 8 | Medium (external dependency, **launch blocker**) | Unchanged |
| Security hardening | 21 | 5 | Medium | Unchanged |
| Observability/alerting | 22 | 4 | Medium | Unchanged |
| Pricing page | 23 | 2 | Small | Route exists; pricing UI and conversion content remain |
| Contact page | 24 | 1 | Small | Unchanged |
| Mobile/UX polish | 25 | 4 | Medium | Unchanged |
| Business model rules | 26 | 7 | N/A (decisions) | Unchanged |
| Testing | 27 | 3 | Medium | Vitest is configured with FirmEasy tests; broader unit, integration, and E2E coverage remain |
| Deployment | 28 | 5 | Medium | Unchanged |
| Static assets | 29 | 2 | Trivial | Core app icons and root OG metadata exist; optional favicon compatibility and dedicated OG image selection remain |

---

## External Blockers

These must be resolved before the corresponding engineering work can proceed. Items marked **(launch blocker)** must be resolved before any real user data is collected.

1. **(Launch blocker)** Legal review and approval of consent text, Terms of Service, and Privacy Policy — Ley 29733 compliance (Section 20.1–20.2)
2. **(Launch blocker)** Business model decisions: fee amount, refund rules, notary payout rate (Section 26)
3. **(Launch blocker)** Notary partner contract and at least one contracted notary (Section 20.6)
4. FirmEasy API plan contract and credential provisioning (Section 8.1) — provider selected: firmeasy.legal
5. Culqi production-commerce approval and live key provisioning (Section 5.1) — does not block mock implementation and may not block integration/test keys; it blocks real charges, production webhooks, settlement verification, and live smoke testing
6. WhatsApp `signing_link_invite` template approval if WhatsApp signing-link delivery remains in MVP (Section 6.4)
7. Factura provider selection (Section 11.1)
8. Incident response plan reviewed and approved (Section 20.8)
