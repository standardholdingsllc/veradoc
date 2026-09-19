# VeraDoc MVP Gap Roadmap

**Last updated:** 2026-09-10
**Purpose:** The remaining work required before VeraDoc can launch a production MVP for Peruvian real-estate lease packets. Completed implementation has been removed. Items that depend on external credentials, legal approval, commercial decisions, or production validation remain until they are explicitly verified.

---

## Current launch position

The repository contains the application and canonical Supabase schema changes. Core realtor, signer, payment, evidence, notary, certification, registry, electronic-comprobante, refund, notification, and payout capabilities exist.

The principal remaining engineering risk is lifecycle integrity after the final FirmEasy signature. Evidence-report generation does not persist a distinct completion state in the database, while notary submission still gates on `all_signed`. A failed automatic report generation can also leave an `all_signed` packet without a recovery path.

The other launch-critical gaps are deployed signing-RPC verification, durable rate limiting, production provider acceptance, legal/accounting sign-off, operational recovery tooling, and end-to-end deployment validation.

---

## 1. Packet Lifecycle Integrity

### 1.1. Make evidence completion authoritative

- Choose one canonical representation for evidence completion:
  - add a persisted database status such as `evidence_report_generated`; or
  - formally use the accepted `evidence_report` document as the state invariant and remove the separate domain-state expectation.
- Add retry/recovery handling for automatic evidence-report generation after a webhook failure.
- Persist the evidence-completion audit event in the same reliable workflow as document creation.

### 1.2. Align notary submission

- Require the canonical evidence-complete invariant before submission.
- Transition to `pending_notary`, assign the canonical Grover Paúl Morales Cama, Notario de Lima office, and record the assignment and audit event atomically or through a retry-safe workflow.
- Update realtor UI actions so report generation and notary submission cannot both appear valid for the same incomplete state.
- Add regression coverage for webhook retry, manual report retry, concurrent generation, and submission before/after evidence completion.

---

## 2. Signing Links, Tokens, and Public Signer Security

### 2.1. Verify deployed signing-RPC privileges

- Add deployed-role integration tests that prove allowed and denied execution for `anon`, `authenticated`, and `service_role`.
- Verify post-account signer steps continue to work through the intended server-side path after privilege tightening.

### 2.2. Durable rate limiting

- Replace the in-memory token limiter with a durable/distributed implementation.
- Cover every token-resolution path, including `resolveSigningContext`, link opening, OTP issuance/verification, and status polling.
- Add durable limits for login, signup, resend, and other public mutation endpoints.
- Key limits appropriately by token hash, account, and trusted client IP without allowing trivial bypasses.

### 2.3. Resend, revocation, and expiry

- Define resend behavior after a token or signer has progressed beyond `pending`.
- Add explicit signing-link resend and revoke server actions with ownership checks and audit events.
- Ensure a replacement token invalidates all superseded links safely.
- Schedule or otherwise guarantee recovery of expired tokens and tokens stuck in `claiming`.

### 2.4. Delivery reliability

- Move signing-link email and WhatsApp delivery into the durable outbox/job processor.
- Add idempotent delivery records, retries, terminal failure state, and manual recovery.
- Wire the realtor reminder control to a real server action instead of a success-only toast.
- Configure the production WhatsApp provider and obtain approval for the signing-link template if WhatsApp remains in MVP scope.

---

## 3. Mercado Pago Production Acceptance and Operations

### 3.1. Environment and account setup

- Obtain and configure separate test and production Mercado Pago credentials.
- Register dedicated test and production webhook URLs.
- Verify production mode disables demo payments and rejects test credentials.
- Confirm secrets and public keys are configured correctly in every deployed environment.

### 3.2. Provider acceptance

- Validate card, Yape, and 3DS success, rejection, timeout, and retry behavior using Mercado Pago test credentials.
- Validate webhook signatures, deduplication, delayed delivery, retries, and out-of-order events.
- Validate polling/reconciliation after ambiguous browser or network outcomes.
- Complete controlled production smoke tests with live credentials.

### 3.3. Refund and reconciliation policy

- Add automatic or operator-driven reconciliation for ambiguous refund outcomes before retrying.
- Verify partial and full refund behavior against Mercado Pago and resulting credit-note issuance.

### 3.4. Admin payment operations

- Add searchable payment/refund lists and payment-exception views.
- Expose the existing reconciliation action through an operator UI.
- Add webhook-event history, failure detail, and safe retry/reprocess controls.
- Show local/provider state differences and required recovery action.

### 3.5. Automated coverage

- Add focused tests for Mercado Pago request/response validation, state transitions, ownership, idempotency, webhook security/deduplication, card/Yape/3DS outcomes, reconciliation, and partial/full refunds.

---

## 4. FirmEasy Production Acceptance

### 4.1. Credentials and contract verification

- Obtain the production plan and credentials.
- Validate request/response mappings against the contracted FirmEasy API version.
- Confirm the exact production webhook signature/header contract and retry behavior.
- Ensure production startup rejects sandbox or development-stub configuration.

### 4.2. Signed-document and evidence validation

- Confirm FirmEasy returns the complete multi-signer PDF required by VeraDoc.
- Prove document assembly is unnecessary, or retain and test it as an explicit fallback.
- Validate certificate chain, certificate validity, timestamp, revocation, integrity, signer identity, provider reference, and verification URL fields.

### 4.3. Legal and end-to-end acceptance

- Validate the complete sandbox and live flow through signature, signed-PDF storage, evidence review, and notarial certification.
- Confirm FirmEasy’s legal/accreditation fit for the intended Law 27269 workflow.

---

## 5. Evidence Report Completeness

### 5.1. Realtor evidence

- Define the realtor verification evidence required in the report.
- Persist and render the approved realtor identity, license, company, and approval data.

### 5.2. Property-authority evidence

- Decide whether manually recorded structured SUNARP evidence is sufficient for MVP.
- If automated verification is required, select and integrate a source and persist its authoritative response/reference.
- Clearly label manual, unavailable, observed, not-found, and verified results in the report and notary UI.

### 5.3. Provider evidence acceptance

- Validate that production FirmEasy payloads populate every report field currently modeled for signatures.
- Define the blocking versus warning behavior for missing certificate, timestamp, revocation, and integrity evidence.

---

## 6. Durable Jobs and Notification Coverage

### 6.1. Remaining asynchronous work

- Move evidence-report generation, signing-link delivery, FirmEasy retry/reconciliation, token cleanup, and retention cleanup into retry-safe jobs.
- Define consistent claim fencing, idempotency keys, retry/backoff, timeout, and terminal-failure rules across job types.
- Add scheduled recovery for stale `processing` and `claiming` records.

### 6.2. Notification completeness

- Inventory every critical lifecycle notification and identify paths that still send inline or fire-and-forget.
- Route all launch-critical email and WhatsApp delivery through the durable outbox.
- Confirm final certified documents are delivered or made available to every authorized party.

### 6.3. Operations and recovery

- Add an admin view for pending, processing, failed, and manual-review jobs/outbox rows.
- Add safe retry, requeue, cancel, and dead-letter recovery operations.
- Add queue age, attempt, failure-rate, and dead-letter metrics and alerts.

---

## 7. Notary Assignment and Live Status

### 7.1. Assignment routing

- Configure Grover Paúl Morales Cama, Notario de Lima, and his office as the sole MVP assignment destination. Do not build multi-notary selection, round robin, load balancing, or alternate-notary routing at this stage; any future notary must be deliberately engineered and deployed as a separate product change.
- Enforce Lima Metropolitana on the realtor side from the property address in the document to be notarized. Use a maintained postal-code lookup/allowlist as the initial low-cost, reliable validation mechanism, with a clear correction path for invalid or non-Lima postal codes.
- Perform the Lima postal-code validation server-side before payment is created or accepted and before the FirmEasy remote-signing flow is made available. A non-Lima or invalid result must block payment and signing and must never create a notary-dashboard item or reach `pending_notary`.
- Preserve the validated property address and postal code in the version-locked packet/document evidence so the submitted document cannot silently differ from the realtor's validated address.
- Confirm the office's supported Lima Metropolitana service area and operating availability before launch.
- Define the no-availability path: keep the packet unassigned or in `pending_notary`, surface an actionable operational alert, and allow a safe retry. Do not route to an alternate notary in the MVP.
- Persist the canonical office assignment, prevent accidental reassignment, and record assignment attempts, failures, blocked Lima validation, and contract-configuration changes in the audit trail.
- Send assignment and assignment-failure notifications through the durable queue/outbox.

### 7.2. Contract service levels and availability

- Model the contracted operating window as Monday-Friday, 8:00 a.m.-5:00 p.m. Lima time, excluding Lima public holidays.
- Track the Annex 2 target windows: initial review within 1 business day after complete evidence, correction review within 1 business day after resubmission, and final document emission/upload within 1 business day after final approval.
- Treat these as operational targets that must not override the notary's independent diligence or legally required additional measures.
- Add due-time calculation, queue-age visibility, breach alerts, and operational reporting for each notary target.
- Capture planned office vacation/license/unavailability with at least 10 business days' notice when possible, and capture urgent incapacity, suspension, investigation, or other material impediment within the contract's required notification window.
- For an unavailable office, hold the packet, alert the operator, and support safe retry or customer communication. Do not substitute another notary during the MVP.

### 7.3. Status delivery and additional measures

- Choose Supabase Realtime or formally retain polling as the MVP strategy.
- If polling remains, document intervals, timeout behavior, stale-state UX, and expected database/API load.
- Map the notary workflow to the contract states: Pending, In review, Observed, Requires appearance/additional measure, Rejected, Approved, Completed, and Cancelled. Add an explicit additional-measure state or a documented, auditable equivalent in the existing domain model.
- Support additional document uploads, verification, or correction requests within the remote portal without treating them as a failure of the remote MVP. If the notary requires physical appearance or another non-remote measure, surface that requirement clearly and stop the workflow until it is resolved.
- Verify realtor, signer, notary, payment, and CPE screens recover correctly after delayed webhooks or browser reconnects.

---

## 8. Admin Audit and Support Operations

### 8.1. Global admin audit trail

- Add a durable admin audit event model separate from packet-only history.
- Log realtor approval/rejection, user suspension/reactivation, Lima postal-code validation results and blocks, notary assignment/notification attempts, notary status/SLA events, contract-configuration changes, payout configuration/payment, refunds, reconciliation, and recovery actions.
- Standardize actor ID, target ID, timestamp, request ID, IP, user agent, reason, and before/after metadata.

### 8.2. Support search and recovery

- Add packet lookup by packet ID/code, signer email/DNI, realtor, payment ID, provider reference, and document hash.
- Add signing-token and delivery history with resend/revoke/expiry operations.
- Add stuck signer/packet diagnosis and controlled state-recovery tooling.
- Add audit export and webhook/outbox/job history suitable for support investigations.

---

## 9. APIsPERU Production Acceptance and Administration

### 9.1. Account and company setup

- Register the VeraDoc company in APIsPERU.
- Configure RUC, SUNAT SOL credentials, PEM certificate, logo, company token, emitter address, and approved series.
- Validate beta and production environment configuration independently.

### 9.2. Provider acceptance

- Validate factura, boleta, status polling, PDF/XML/CDR artifacts, and credit notes against APIsPERU beta.
- Complete controlled production issuance and download tests.
- Determine whether a separate `/sale/qr` integration is required or whether provider-generated PDFs satisfy the QR requirement.

### 9.3. Admin CPE operations

- Add invoice/boleta/credit-note list and search by packet, payment, realtor, date, series/number, and SUNAT status.
- Add safe manual retry/recovery for rejected and manual-review operations.
- Implement and validate comunicación de baja/void operations if required for MVP.
- Add artifact inspection and download for authorized operators.

---

## 10. Legal and Compliance

### 10.1. Launch approvals

- Obtain legal approval for the published Terms of Service and Privacy Policy under Ley 29733.
- Replace placeholder signer consent with approved, versioned text.
- Confirm which consent, identity, signature, and delivery evidence must be retained.
- Document and validate the executed contract and the MVP operating decision: Grover Paúl Morales Cama, Notario de Lima, is the sole MVP notary destination; the initial service area is Lima Metropolitana; the service window, SLA targets, escalation path, postal-code allowlist, and no-alternate policy are approved before launch.

### 10.2. Data-subject and retention operations

- Define retention periods for accounts, identity images, documents, evidence, audit events, payments, and CPE artifacts.
- Implement archival, anonymization, and deletion schedules.
- Implement ARCO request intake, identity verification, export, correction, deletion/objection handling, and audit history.
- Define legal holds and exceptions that prevent automated deletion.

### 10.3. Access and incident governance

- Review PII/document access controls and add logging for privileged admin access.
- Draft, review, approve, and rehearse the incident-response plan.
- Document breach assessment, escalation, notification, containment, and evidence-preservation procedures.

---

## 11. Security Hardening

### 11.1. Input and authentication hardening

- Tighten auth/profile field validation and adopt a consistent text-sanitization strategy.
- Apply durable rate limits to authentication, signing, resend, contact/complaint, and public API routes.
- Review account enumeration and error-message exposure across public flows.

### 11.2. Webhook and internal endpoint security

- Validate actual Mercado Pago and FirmEasy webhook contracts using provider fixtures.
- Authenticate any inbound WhatsApp webhook retained for MVP.
- Rotate and separately manage webhook, cron, service-role, and provider credentials.
- Confirm internal cron endpoints reject missing, preview, or incorrect secrets.

### 11.3. Browser and storage controls

- Add and validate a Content Security Policy and appropriate security headers.
- Confirm storage-at-rest, private-bucket, signed-URL, expiry, and backup controls.
- Assess whether identity images or other high-risk PII require additional encryption.

---

## 12. Observability and Alerting

- Configure production error tracking, source maps, release tagging, and privacy-safe logging.
- Configure uptime monitoring for the web application, webhook endpoints, and internal job processor.
- Enable relevant Supabase database, auth, storage, and resource alerts.
- Alert on signing failures, payment/refund failures, webhook retries, evidence-generation failures, stuck packets, queue age, dead letters, CPE manual review, and cron failure.
- Configure alert routing, ownership, escalation, and an operational health view.

---

## 13. Commercial and Accounting Acceptance

- Apply `20260910160000_commercial_accounting.sql` to a clean reset/staging PostgreSQL database.
- Exercise the migration's RPCs, views, policies, constraints, and commercial lifecycle jobs on staging.
- Regenerate `lib/supabase/database.types.ts` from the accepted staging schema and verify there is no schema drift.
- Reconcile real Mercado Pago processing-fee payloads with the per-packet cost and margin ledger.
- Validate APIsPERU credit-note issuance, artifacts, status handling, and refund linkage.
- Run representative payout examples against the signed exclusive notary contract with Finance, including full-price and promotional transactions.
- Treat S/199 as the MVP price point. When VeraDoc issues a realtor promo code that reduces the customer payment, apply the approved VeraDoc-funded good-faith top-up so the notary receives his agreed participation; test and document the resulting ledger and payout evidence.
- Run the report-only 90-day reminder, hold, and archival acceptance pass; enable archival mutations only after approval.
- Obtain final legal/accounting sign-off for pricing, refunds, promotions, CPE treatment, notary economics, and service-window language.
- Record evidence and results for each check before marking commercial/accounting acceptance complete.

Reference: `COMMERCIAL_ACCOUNTING_INTEGRATION_PLAN.md`.

---

## 14. Marketing, UX, and Accessibility

### 14.1. Pricing and contact

- Complete `/precios` with approved pricing cards, inclusions, comparison, FAQ, and signup CTA.
- Build `/contacto` with validated submission, abuse protection, durable storage/delivery, and support routing.

### 14.2. Lima-only and notary messaging

- Replace generic “participating notary,” “notary network,” and unnamed-office wording across marketing, sales, onboarding, terms, pricing, and transactional screens with the approved identity: Grover Paúl Morales Cama, Notario de Lima.
- State clearly that the MVP serves Lima Metropolitana only and that the property address and postal code must qualify before payment and remote signing can proceed.
- Keep the remote experience as the standard flow while explaining that the notary may request additional uploads, verification, correction, or—in exceptional cases—a physical appearance.
- Do not market or sell the MVP as available in non-Lima regions.

### 14.3. Responsive and failure-state UX

- Test the complete signer flow at 375px and on iOS Safari and Android Chrome, including camera capture, FirmEasy handoff, and PDF readability.
- Add consistent loading skeletons, error boundaries, 404/500 states, offline/stale-state messaging, and retry UX.
- Complete keyboard navigation, focus management, screen-reader labeling, contrast review, and accessibility testing.

### 14.4. Static launch assets

- Wire and validate the existing Open Graph/social-sharing image.

---

## 15. Testing Remaining for Launch

### 15.1. Unit and component coverage

- Add missing tests for packet/signer state machines, auth schemas, document-hash utilities, adapter mappings, Mercado Pago transitions, admin payment actions, and lifecycle idempotency.
- Add component tests for payment recovery, evidence completion, notary submission, signing reminders, CPE states, and operator recovery controls.

### 15.2. Supabase integration coverage

- Add deployed-role tests for all signing RPC privileges and token-state transitions.
- Cover evidence-report generation and notary-submission atomicity/idempotency.
- Cover Lima postal-code allowlisting, invalid/non-Lima blocking before payment and FirmEasy, absence of notary-dashboard creation, canonical Grover office assignment, and notification retry/failure behavior.
- Cover payment/refund/CPE RPC edge cases, webhook ordering, ambiguous provider outcomes, and recovery.
- Exercise server actions against a reset local Supabase environment and a controlled hosted test project.

### 15.3. End-to-end coverage

- Install and configure Playwright.
- Cover realtor signup/approval, packet creation, payment variants, signing, webhook completion, evidence generation, notary submission/decision, certification, CPE download, refund, and recovery paths.
- Cover notary SLA timers, correction resubmission, additional-measure/additional-upload status, office unavailability hold, and no-alternate behavior.
- Cover suspended/rejected/expired/revoked auth and token states.
- Run the critical suite against preview/staging before launch.

---

## 16. Deployment and Release Infrastructure

### 16.1. Environment provisioning

- Configure production and preview hosting projects and environment variables.
- Configure `veradoc.pe`, SSL, canonical URLs, auth redirects, and production email DNS.
- Verify Supabase auth settings, storage policies/buckets, backup schedule, point-in-time recovery or restore procedure, quotas, and alerts.
- Verify Vercel cron scheduling and secrets in preview/staging/production as appropriate.

### 16.2. CI/CD

- Expand CI beyond generated database-type drift checks to include lint, type checking, unit tests, integration tests, production build, and migration validation.
- Define deployment promotion, migration ordering, rollback/forward-fix, and failed-release procedures.
- Prevent production deployment when required provider configuration or launch invariants are missing.

### 16.3. Release verification

- Create a staging environment with provider sandbox accounts and production-like security settings.
- Run database migration, auth, storage, cron, webhook, email, payment, signing, CPE, and backup/restore smoke tests.
- Document a launch checklist, owners, go/no-go criteria, and rollback contacts.

---

## 17. Development Documentation and Demo Isolation

- Migrate legacy demo services away from direct synchronous `mock-adapter` imports, or isolate them behind an explicit demo-only boundary.
- Ensure production imports and bundles cannot fall back to mock state or provider stubs.
- Document local Supabase startup/reset, required environment variables, migration workflow, remote linking, type regeneration, unit/integration tests, cron execution, and provider sandbox setup.
- Document the canonical packet state model and the chosen evidence-completion invariant.
- Replace placeholder notary identities in seed/demo data and coverage fixtures with the canonical Grover Paúl Morales Cama office record, or isolate them explicitly to demo-only; verify production assignment uses the same canonical profile and contract contact details. The product must not expose a notary invitation or multi-notary provisioning mechanism.

---

## Launch Priority

### Phase 1 — Correctness and authorization

1. Resolve evidence-completion and notary-submission state semantics.
2. Verify deployed signing-RPC privileges and add deployed-role tests.
3. Implement durable public/signing rate limits.
4. Enforce Lima Metropolitana postal-code validation before payment and FirmEasy signing.
5. Bind MVP assignment and records to the canonical Grover Morales notary office.

### Phase 2 — External acceptance

1. Complete Mercado Pago sandbox and production acceptance.
2. Complete FirmEasy contract, evidence, legal, sandbox, and production acceptance.
3. Configure and validate APIsPERU beta and production issuance.
4. Complete commercial/accounting staging acceptance and obtain the related sign-off.
5. Obtain legal approval, consent copy, and incident-response approval; confirm the Grover Morales office's operating process, service levels, and Lima-only service terms.

### Phase 3 — Reliability and operations

1. Move remaining critical work and signing delivery into durable jobs.
2. Add admin audit, support search, failure visibility, and recovery controls.
3. Complete refund/reconciliation and CPE administration.
4. Configure monitoring, alerts, retention, ARCO, and backup/restore operations.

### Phase 4 — Launch validation

1. Complete focused unit/integration coverage and critical Playwright flows.
2. Complete pricing/contact, mobile-device, error-state, accessibility, and static-asset work.
3. Expand CI/CD and validate the staging environment.
4. Execute the launch checklist and controlled production smoke tests.

---

## External Blockers

1. **Legal approval:** Terms, Privacy Policy, signer consent, retention/ARCO approach, and incident-response plan.
2. **Accounting/legal sign-off:** gross-versus-net presentation, promo-discount/notary-top-up accounting, customer-facing no-refund/service-window language, and final statutory mappings.
3. **Notary operations:** launch-ready confirmation of Grover Paúl Morales Cama, Notario de Lima, as the sole MVP destination; Lima Metropolitana postal-code coverage; service window/SLA targets; escalation path; canonical records; and the no-alternate operating policy.
4. **FirmEasy:** production plan, credentials, webhook contract, evidence-field confirmation, and legal/accreditation acceptance.
5. **Mercado Pago:** test/production credentials, registered webhooks, sandbox acceptance, and live smoke-test authorization.
6. **APIsPERU/SUNAT:** company account, SOL credentials, PEM certificate, approved series, company token, and production acceptance.
7. **WhatsApp:** provider configuration and approved signing-link template if retained for MVP.
