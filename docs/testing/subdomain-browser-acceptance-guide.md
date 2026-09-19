# VeraDoc Subdomain Browser Acceptance Guide

Status: Required handoff for the remaining subdomain-transition browser gates

Audience: Browser-capable QA agents, release operators, and reviewers

Production domains: `veradoc.pe`, `app.veradoc.pe`, `notario.veradoc.pe`, `admin.veradoc.pe`, and `demo.veradoc.pe`

Last updated: 2026-09-15

## 1. Purpose

Use this guide to collect the real-browser evidence still required by `SUBDOMAIN_TRANSITION_AGENT_GUIDE.md`. The routing code, automated tests, and anonymous production smoke checks already provide useful evidence, but they do not prove authenticated cookie behavior or complete role workflows in a browser.

This guide does not authorize changes to code, Vercel, DNS, Supabase, OAuth, payments, signing providers, messaging providers, production accounts, or production data. Obtain explicit authorization before changing any external state not already represented by dedicated test fixtures.

The migration remains **partial** until every applicable completion gate in the normative transition guide has passed.

Record browser runs in `docs/testing/subdomain-browser-acceptance-report.md`. Keep the execution guide reusable; put environment-specific results and reconciliations in the report.

## 2. Release baseline to confirm

The expected production release at the time this guide was written is:

- Git commit: `2fd1a82042650b9c267113bb121f45dedef5f503`
- Vercel production deployment: `dpl_52hALsJfRggB56ejjwcMRagH8VQZ`
- Host routing mode: `enforce`
- Default Supabase Site URL: `https://app.veradoc.pe`
- Exact application and notary callback URLs are configured.
- Admin uses a TOTP AAL2 MFA gate.
- MercadoPago is configured for production. Treat payment submission as unsafe unless a different test environment is explicitly confirmed to use sandbox credentials.
- No repository-owned browser test runner or synthetic production credentials were available when this guide was written.

Do not assume this release is still current. Record the release actually tested. If it cannot be identified, mark release identity `BLOCKED`; do not invent it.

## 3. Public URL contract

| Surface | Canonical origin | Expected public paths |
| --- | --- | --- |
| Marketing | `https://veradoc.pe` | `/`, `/precios`, `/como-funciona`, legal and evidence pages |
| Customer app | `https://app.veradoc.pe` | `/agente`, `/arrendador`, `/arrendatario`, `/firma/{token}`, approved `/auth/**` |
| Notary | `https://notario.veradoc.pe` | `/`, `/perfil`, `/paquetes/{id}`, `/historial`, `/ganancias`, approved `/auth/**` |
| Admin | `https://admin.veradoc.pe` | `/`, approved `/auth/**` |
| Demo | `https://demo.veradoc.pe` | `/`, `/registro`, role dashboards, `/notario`, `/firma/{token}` |

Internal paths such as `/notario/paquetes/...`, `/admin`, and `/demo/...` must not remain visible on their canonical subdomains after navigation settles.

## 4. Safety rules

The browser agent MUST follow all of these rules:

1. Run anonymous, read-only checks without waiting for credentials.
2. Treat production as read-only unless the user explicitly authorizes dedicated production test accounts and data for a named test.
3. Never create or use real leases, real identities, real DNI values, real signatures, real notarial acts, or real payment instruments.
4. Never submit a payment, refund, production FirmEasy signature, real notification, notarial certification, or tax action unless the environment is provider-safe and the user has explicitly authorized that test class.
5. Use only synthetic files and identities. Put `SYNTHETIC TEST — NOT A REAL CONTRACT` visibly in uploaded documents.
6. Do not alter deployments, environment variables, DNS, Supabase settings, provider settings, database rows, or users unless separately authorized.
7. Never paste or record passwords, TOTP seeds, OTP values, cookies, authorization headers, auth codes, invitation tokens, signing tokens, full token-bearing URLs, or personal data in chat, screenshots, logs, HAR files, or the final report.
8. Receive secrets through an approved secure mechanism. If none exists, ask the user to log in interactively and report only that the browser profile is ready.
9. Do not copy cookies between hosts. A copied cookie does not prove real host-scoped browser behavior.
10. Use a clean browser context for each role and another clean context for anonymous checks. Do not reuse a context across roles.
11. Stop immediately if a test appears capable of charging money, contacting a real person, signing with a production provider, certifying a real document, or changing non-test data.
12. A check is `PASS` only with observable evidence. Otherwise use `FAIL`, `BLOCKED`, or `NOT RUN`.
13. Do not use `PASS*` or hide a caveat inside a passing result. Split the satisfied and unsatisfied claims into separate rows.

## 5. One-question-at-a-time protocol

Do not send the user a questionnaire. Continue safe work until one answer is truly required, then ask exactly one concise question and wait.

For every question:

1. State the single missing fact or authorization.
2. Explain in one sentence which test it unlocks.
3. Ask for the answer in a safe form.
4. Do not ask the next question until the user answers.
5. Record a sanitized answer in the report's decision ledger.

Use this question order, skipping questions already answered or not applicable:

### Q1 — Target environment

Ask:

> Should the authenticated and workflow tests run in a provider-safe staging environment or against dedicated synthetic data in production?

If staging is selected and its origins are not known, the next question asks for its five base URLs. If production is selected, do not infer authorization to create accounts or invoke providers.

### Q2 — Provider-safety declaration

Ask for confirmation that the chosen environment safely stubs or sandboxes one provider class at a time. Start with the provider needed by the next test, not all providers in one question.

Example:

> Is MercadoPago sandboxed for this environment, with no possibility of a real charge or refund?

Repeat separately, only when needed, for FirmEasy/signing, email, WhatsApp/SMS, storage, notarial sealing, and tax issuance.

### Q3 — Credential delivery

Ask for one role at a time, beginning with the active realtor. Do not ask the user to paste a password into chat.

Example:

> Can you provision the active synthetic realtor account through the secure credential mechanism available to this browser agent, or log that account into a fresh browser profile for me?

Continue later with landlord, renter, notary, and admin only when their phase begins.

### Q4 — Account-state fixtures

Ask for one missing state at a time: pending approval, rejected, suspended, missing role metadata, expired-but-refreshable session, or invalid session. A fixture may be an already-prepared browser profile or a safely provisioned synthetic account.

### Q5 — Workflow fixtures

Ask for one artifact at a time as the workflow reaches it:

- A synthetic packet assigned to the active realtor.
- Fresh landlord and renter signing links.
- An old apex signing link that remains valid.
- Expired and consumed signing links.
- A synthetic packet assigned to the active exclusive notary.
- A demo token and a production-shaped synthetic token for separation tests.
- Access to a safe email/OTP sink.
- A synthetic upload file if the agent cannot create one locally.

Never include an artifact's raw token in the report.

### Q6 — Mutation authorization

Even in a safe environment, ask before the first state-changing phase:

> Do you authorize the browser agent to mutate only the named synthetic accounts, packets, uploads, and provider-sandbox records required by the next workflow phase?

List the next phase, but do not bundle destructive or unrelated permissions into this question.

### Q7 — Telemetry access

Ask which approved, read-only telemetry surface may be used and how access will be provided. Never request broad production secrets.

### Q8 — Rollback proof

Ask whether rollback should be exercised in a production-like environment or documented/read-only only. Never toggle production routing or promote a deployment without explicit authorization naming that operation and release window.

## 6. Required fixture manifest

Complete this manifest without secrets. Use opaque labels such as `realtor-active-A`, not emails or user IDs.

### Environment

| Field | Value |
| --- | --- |
| Environment name | |
| Release/commit | |
| Marketing origin | |
| App origin | |
| Notary origin | |
| Admin origin | |
| Demo origin | |
| Production-like? | |
| Named test-data owner | |
| Named rollback operator | |

### Provider safety

| Provider class | Mode | Evidence/owner | Allowed actions |
| --- | --- | --- | --- |
| MercadoPago | unknown/sandbox/stub/production | | |
| FirmEasy/signing | unknown/sandbox/stub/production | | |
| Email | unknown/safe sink/production | | |
| WhatsApp/SMS | unknown/safe sink/production | | |
| Storage | unknown/test namespace/production | | |
| Notarial sealing | unknown/stub/production | | |
| Tax issuance | unknown/stub/production | | |

An `unknown` or `production` row blocks the corresponding side-effecting test unless narrowly authorized.

### Accounts

| Fixture label | Role/status | Canonical host | Clean browser profile | Ready? |
| --- | --- | --- | --- | --- |
| | active realtor | app | | |
| | active landlord | app | | |
| | active renter | app | | |
| | active notary | notary | | |
| | active admin with test MFA | admin | | |
| | pending realtor | app | | |
| | rejected realtor | app | | |
| | suspended account | role host | | |
| | missing-role account | role host | | |

### Workflow artifacts

| Fixture label | Type/state | Safe environment | Ready? |
| --- | --- | --- | --- |
| | synthetic packet | | |
| | fresh landlord link | | |
| | fresh renter link | | |
| | valid legacy apex signing link | | |
| | expired signing link | | |
| | consumed signing link | | |
| | notary-assigned packet | | |
| | demo token | | |
| | synthetic upload PDF | | |

## 7. Evidence standard

For every case record:

- Test ID and status: `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`.
- UTC timestamp.
- Environment and release identity.
- Browser name/version, viewport, and clean-profile label.
- Starting origin/path template and final origin/path template.
- Visible result.
- Relevant HTTP status, redirect chain, and request method from browser network tools.
- Cookie attributes with values redacted.
- Sanitized screenshot or trace reference when useful.
- Console/network error summary.
- Side effects observed or explicitly not invoked.

Sanitize token paths as `/firma/[token]`. Remove query strings containing credentials. Do not upload an unsanitized HAR or trace.

Use this row format:

| ID | Status | Profile | Start | Final | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| EXAMPLE-01 | PASS | anonymous-A | `veradoc.pe/firma/[token]` | `app.veradoc.pe/firma/[token]` | One 307; query key preserved, value redacted | No loop |

## 8. Phase A — Safe anonymous and routing checks

These checks are read-only and may run against production.

### A1. Marketing and canonicalization

- `A-MKT-01`: Open `https://veradoc.pe/` and at least `/precios`, `/como-funciona`, `/privacidad`, and `/terminos`. Expect successful marketing pages.
- `A-MKT-02`: Open `https://www.veradoc.pe/` with a harmless query. Expect one temporary canonical redirect to `https://veradoc.pe/` with the query preserved and no loop.
- `A-MKT-03a`: Inspect canonical metadata. No canonical value may identify an internal path or a nonmarketing origin.
- `A-MKT-03b`: Confirm each tested marketing page declares the approved public canonical URL. If no canonical tag is present, record `FAIL` unless the documented SEO policy explicitly approves omission.
- `A-MKT-04`: Confirm marketing is not marked `noindex` unless a separate SEO policy says otherwise.

### A2. Surface isolation

Use placeholder paths only; do not use a real token.

- `A-ISO-01`: Apex `/agente`, `/arrendador`, `/arrendatario`, and `/firma/browser-test-placeholder` must redirect to `app.veradoc.pe`, not render on apex.
- `A-ISO-02`: Apex `/notario` and a nested notary path must redirect to clean paths on `notario.veradoc.pe`.
- `A-ISO-03`: Apex `/admin` must redirect to `admin.veradoc.pe/`.
- `A-ISO-04`: Apex `/demo` and a nested demo path must redirect to clean paths on `demo.veradoc.pe`.
- `A-ISO-05`: App must not successfully render admin, notary, or demo route trees.
- `A-ISO-06`: Notary must not successfully render customer, admin, or demo route trees.
- `A-ISO-07`: Admin must not act as an alternate host for customer, notary, marketing, or demo pages.
- `A-ISO-08`: Demo must not act as an alternate host for production app, notary, or admin pages.

Record whether a wrong-surface GET is rejected or canonically redirected. Both may be acceptable only where the implemented policy documents that behavior; it must never render the wrong surface.

### A3. Clean public routes and browser navigation

- `A-CLEAN-01`: Open notary `/`, `/perfil`, `/historial`, and `/ganancias` anonymously. Auth redirects may occur, but `/notario` must not remain visible.
- `A-CLEAN-02`: Open notary `/notario` and `/notario/perfil`. GET must clean the redundant prefix without looping.
- `A-CLEAN-03`: Open admin `/admin`. GET must clean the redundant prefix to `/` or reject it; it must not expose a parallel admin tree.
- `A-CLEAN-04`: Open demo `/demo`, `/demo/agente`, and `/demo/firma/browser-test-placeholder`. GET must clean the redundant prefix.
- `A-CLEAN-05`: On a rewritten demo page, refresh directly and use visible client-side links. Expect the same clean public URL.
- `A-CLEAN-06`: Observe prefetch/RSC requests during client navigation. They must not loop, expose another surface, or fail because of double prefixes.

### A4. Headers and indexing

- `A-HDR-01`: App, notary, admin, and demo page responses include `X-Robots-Tag: noindex, nofollow` or equivalent page metadata.
- `A-HDR-02`: Token-bearing and privileged surfaces use `Referrer-Policy: no-referrer` where implemented.
- `A-HDR-03`: Admin and notary deny framing with `frame-ancestors 'none'` or equivalent.
- `A-HDR-04`: Confirm HSTS and `X-Content-Type-Options: nosniff` on the main document response for all production hosts. Do not infer absence from a browser summary panel; inspect the document response headers directly.
- `A-HDR-05`: Confirm ordinary HTML page responses do not emit wildcard `Access-Control-Allow-Origin: *`. The absence of `Access-Control-Allow-Credentials` reduces exposure but does not justify a global wildcard header on pages. Document narrowly scoped endpoint-specific CORS separately.

### A5. Safe mutation-routing observation

Do not submit a production mutation. If the browser agent can issue a harmless request to a known non-mutating placeholder endpoint, verify that wrong-host POST/PUT/PATCH/DELETE receives a failure and no cross-host redirect. Otherwise mark browser evidence `NOT RUN` and reference the existing automated routing tests; do not fabricate a mutation target.

## 9. Phase B — Authentication and host-only sessions

Prerequisites: one clean context per role, securely delivered credentials or user-preauthenticated profiles, and authorization to use the synthetic accounts.

### B1. Anonymous protection

- `B-AUTH-01`: Anonymous app dashboard paths redirect to app login with a safe `next` destination.
- `B-AUTH-02`: Anonymous notary clean paths redirect to notary login.
- `B-AUTH-03`: Anonymous admin root redirects to admin login.
- `B-AUTH-04`: Demo exposes no production login or callback flow.

### B2. Correct-role login and logout

For each active role:

- Log in only on the role's canonical origin.
- Confirm the final dashboard origin and clean public path.
- Refresh the page directly.
- Navigate through at least two same-surface client links.
- Log out and confirm protected data disappears.
- Use Back and refresh; protected data must not reappear.

Test IDs: `B-ROLE-REALTOR`, `B-ROLE-LANDLORD`, `B-ROLE-RENTER`, `B-ROLE-NOTARY`, and `B-ROLE-ADMIN`.

### B3. Host-only cookie proof

For each authenticated real surface:

1. Inspect browser cookie metadata without recording values.
2. Supabase auth cookies must be host-only for the current hostname. The `Domain` attribute must be absent; `.veradoc.pe` is a failure.
3. Auth cookies should be `Secure` and `HttpOnly` as applicable.
4. Navigate to every other VeraDoc subdomain in the same browser context.
5. The other subdomain must not falsely appear authenticated.
6. Confirm no auth cookie is sent to `demo.veradoc.pe`.

Test IDs: `B-COOKIE-APP`, `B-COOKIE-NOTARY`, `B-COOKIE-ADMIN`, and `B-COOKIE-DEMO`.

### B4. Wrong-role login

Attempt each synthetic role on a noncanonical auth surface only when the UI permits it. The expected initial policy is to remove any just-created wrong-host session and direct the user to reauthenticate on the correct origin. It is a failure if the wrong surface renders protected data or if a session silently crosses origins.

At minimum test:

- Realtor credentials on notary and admin.
- Notary credentials on app and admin.
- Admin credentials on app and notary.
- Landlord/renter credentials on admin and notary.

### B5. Account-state matrix

On the account's canonical surface, verify both navigation and absence of protected data:

| State | Expected behavior |
| --- | --- |
| Pending approval | Holding page; no dashboard data or mutations |
| Rejected | Rejected page; no dashboard data or mutations |
| Suspended | Access denied/signed out; no protected data |
| Missing role metadata | Safe holding/error path; no protected data |
| Expired but refreshable | Session refresh succeeds on the same host and cookies remain host-only |
| Invalid session | Signed out or login; no protected data |

Use one test ID per state: `B-STATE-*`.

## 10. Phase C — Customer app workflow

Run the state-changing cases only in a provider-safe environment with named synthetic fixtures and explicit mutation authorization.

### C1. Realtor

- `C-REALTOR-01`: Login and load `/agente`.
- `C-REALTOR-02`: Open packet list, packet detail, and profile using same-origin client navigation and direct refresh.
- `C-REALTOR-03`: Create a synthetic packet using fake parties and the approved test province/data.
- `C-REALTOR-04`: Upload a clearly synthetic PDF, refresh, download it, and verify the correct file without exposing its storage URL.
- `C-REALTOR-05`: Copy landlord and renter links. Both must use `https://app.veradoc.pe/firma/...` or the chosen environment's app origin.
- `C-REALTOR-06`: Confirm any sandbox payment success/failure/pending return stays on the app origin. Skip if MercadoPago is not proven sandboxed.
- `C-REALTOR-07`: Confirm no provider message reaches a real destination.

### C2. Landlord and renter signing

Use separate clean browser profiles for the two parties. For both fresh signing links, exercise every supported state:

1. Entry.
2. OTP verification through the safe sink.
3. Account creation.
4. Consent.
5. Identity capture using synthetic inputs.
6. Document review.
7. Signature submission through a stub/sandbox provider only.
8. Completion.
9. Resulting role dashboard.

At each step verify:

- The origin stays on `app`.
- Direct refresh resumes safely.
- Back/forward does not repeat a mutation.
- Query data is preserved only where intended.
- The other party cannot access this party's protected packet state.
- Mobile viewport `390 x 844` remains usable from entry through completion.

Test IDs: `C-SIGN-LANDLORD-*` and `C-SIGN-RENTER-*`.

### C3. Link compatibility and token states

- `C-LINK-01`: A still-valid legacy `https://veradoc.pe/firma/...` link performs one temporary redirect to app and completes safely.
- `C-LINK-02`: An expired token produces a safe expired state and no account/session creation.
- `C-LINK-03`: A consumed token cannot repeat signing or account creation.
- `C-LINK-04`: A replayed completion/sign request is rejected or idempotent according to the workflow contract.
- `C-LINK-05`: Token-bearing URLs and query strings do not appear in console logs, analytics payloads, or referrers. Report only sanitized templates.

### C4. OAuth, confirmation, and recovery callbacks

Test supported customer authentication callbacks independently from the notary workflow.

- `C-AUTH-01`: Realtor OAuth returns to the app origin, creates only the intended session, and applies safe `next` handling.
- `C-AUTH-02`: Realtor email confirmation returns to the app origin and preserves the expected approval state.
- `C-AUTH-03`: Password recovery returns to the app origin and never reflects a code or credential-bearing query in evidence.
- `C-AUTH-04`: A callback containing the retired `invitation` parameter returns a generic failure before code exchange and sets no cookie.

## 11. Phase D — Notary workflow

Prerequisites: active exclusive notary, assigned synthetic packet, provider-safe certification path, explicit mutation authorization, and audit visibility.

- `D-NOTARY-01`: Password login lands on `notario` `/`, never public `/notario`.
- `D-NOTARY-02`: Exercise queue/root, packet detail, profile, history, and earnings. All browser-visible paths remain clean.
- `D-NOTARY-03`: Direct refresh and client navigation work on packet detail.
- `D-NOTARY-04`: Certify only the assigned synthetic packet through a stub/sandbox provider. Verify authorization and audit evidence.
- `D-NOTARY-05`: A notary cannot view or mutate a packet assigned to another notary.
- `D-NOTARY-06`: Customer and admin paths never render protected data on the notary host.

## 12. Phase E — Admin workflow and MFA

Prerequisites: dedicated synthetic admin, secure TOTP access, permitted harmless test action, audit-log access, and explicit mutation authorization.

- `E-ADMIN-01`: Password login requires the approved MFA step before protected admin data is visible.
- `E-ADMIN-02`: A session at AAL1 cannot load admin content or invoke an admin mutation.
- `E-ADMIN-03`: A valid TOTP reaches AAL2 and admin `/` without a redundant `/admin` path.
- `E-ADMIN-04`: Logout clears access; another host remains unauthenticated.
- `E-ADMIN-05`: Wrong-role, pending, rejected, and suspended accounts cannot enter admin.
- `E-ADMIN-06`: Run only the pre-approved harmless privileged action against a synthetic target and confirm a corresponding audit event.
- `E-ADMIN-07`: Attempt the same action without the required role/MFA using a synthetic target. It must fail without state change.
- `E-ADMIN-08`: Admin pages and actions are unavailable from app, notary, demo, and apex.

Do not reset a real developer's MFA or test destructive admin functionality.

## 13. Phase F — Demo isolation

Use a new anonymous profile with Network and Storage tools open.

- `F-DEMO-01`: A persistent, unmistakable demo label is visible on demo home, dashboards, notary pages, and signing pages.
- `F-DEMO-02`: Navigate through registration, realtor, landlord, renter, notary, packet, and signing demonstrations. Browser-visible URLs use clean demo paths.
- `F-DEMO-03`: Refresh and client navigation preserve only synthetic demo state.
- `F-DEMO-04`: No Supabase auth cookie or parent-domain auth cookie is received by demo.
- `F-DEMO-05`: No interaction calls production mutation actions, business tables, evidence storage, MercadoPago, FirmEasy, messaging, notarial sealing, or tax issuance. Inspect network destinations and methods; redact identifiers.
- `F-DEMO-06`: A production-shaped synthetic signing token fails on demo and cannot enter a production action.
- `F-DEMO-07`: A demo token fails on the production app signing route.
- `F-DEMO-08`: Demo is `noindex, nofollow` and does not leak token/document values to analytics or referrers.

Any real side effect is a release-blocking failure. Stop testing that flow immediately and report it without repeating the action.

## 14. Phase G — Browser-specific navigation and negative security

### G1. Navigation behavior

Across app, notary, admin, and demo:

- Direct refresh internally rewritten pages.
- Use visible `<Link>` navigation.
- Exercise browser Back/Forward.
- Observe RSC/prefetch requests.
- Preserve harmless redirect query parameters.
- Confirm no redirect loop and no internal-prefix leakage.
- Upload/download only the synthetic file in a safe environment.

### G2. Negative mutation matrix

For each privileged mutation that the safe environment exposes, verify:

- No cookie.
- Cookie/session on a different host, without copying it.
- Wrong role.
- Suspended account.
- User assigned to another packet.
- Wrong workflow state.
- Demo origin.
- Unapproved browser `Origin` where safely reproducible.
- Replayed token/action.

Browser tooling usually cannot safely forge `Host` headers or provider webhooks. Mark those cases `NOT RUN` and reference automated/integration evidence instead of bypassing browser protections or replaying a production webhook.

## 15. Phase H — Telemetry and rollback proof

### H1. Telemetry

With approved read-only access, review a time window containing the test run. Record aggregate counts only. Verify there is no material:

- Unknown-host traffic caused by the test.
- Redirect loop.
- Auth callback failure by surface.
- Signing-entry or completion regression.
- Wrong-host mutation redirect.
- Demo production-action acceptance.

Logs must use sanitized path families such as `/firma/[token]`. If telemetry contains raw tokens, cookies, full sensitive query strings, or personal data, stop collecting it and report a security failure without reproducing the value.

### H2. Rollback

The required rollback proof is:

1. A named operator can set host routing to `off` using the approved Vercel procedure.
2. The last known-good deployment can be promoted or redeployed.
3. All domains remain attached during rollback.
4. Typed origin configuration remains unless it caused the incident.
5. Signing, auth callback, webhook, and cron health can be checked afterward.
6. Enforcement can be restored after proof.

Exercise this only in a production-like environment and only with explicit authorization. Otherwise record a read-only tabletop review as evidence and mark the exercise itself `BLOCKED`.

## 16. Stop conditions and incident severity

Stop the affected phase and notify the user immediately if any of these occurs:

- A real charge/refund, message, signature, certification, tax action, or non-test record change is possible or observed.
- A cookie has `Domain=.veradoc.pe` or reaches demo.
- Protected data renders for an anonymous, wrong-role, inactive, or cross-host session.
- A wrong-host mutation redirects across hosts.
- A raw token, auth code, cookie, password, or personal datum appears in logs or evidence.
- Admin content appears before MFA AAL2.
- Demo reaches any production mutation/provider path.
- Redirect loops prevent recovery.

Classify these as release-blocking `FAIL`, not `BLOCKED`.

## 17. Final report format

Return a Markdown report with these sections:

1. Executive result: `PASS`, `FAIL`, or `PARTIAL/BLOCKED`.
2. Environment and release manifest.
3. Sanitized decision/question ledger.
4. Provider-safety matrix.
5. Account and fixture coverage by opaque label.
6. Results table for every test ID in this guide.
7. Browser cookie evidence by host, values redacted.
8. Workflow evidence for app, notary, admin, and demo.
9. Telemetry result.
10. Rollback result.
11. Release-blocking failures.
12. Blocked/not-run cases and the exact next input needed for each.
13. A direct mapping to the 15 completion conditions in section 22 of `SUBDOMAIN_TRANSITION_AGENT_GUIDE.md`.

Do not declare the migration complete if any applicable required case is `FAIL`, `BLOCKED`, or `NOT RUN`.

## 18. Copyable browser-agent prompt

```text
You are the browser QA agent for VeraDoc's subdomain transition.

Read these repository files completely before testing:
1. AGENTS.md
2. SUBDOMAIN_TRANSITION_AGENT_GUIDE.md
3. docs/testing/subdomain-browser-acceptance-guide.md

Use docs/testing/subdomain-browser-acceptance-guide.md as your execution contract. Test with a real browser and collect sanitized evidence. Begin immediately with its safe anonymous/read-only phase. Do not change code, deployments, DNS, Vercel, Supabase, provider configuration, accounts, or data unless I separately and explicitly authorize the exact change.

After the safe phase, continue as far as the available environment, credentials, and fixtures allow. When you are blocked, ask me exactly ONE concise question at a time, then stop and wait for my answer. Do not send a questionnaire or bundle several approvals into one message. Explain in one sentence which next test the answer unlocks. Skip questions already answered by repository or environment evidence.

Never ask me to paste passwords, cookies, OTPs, TOTP seeds, auth codes, signing tokens, or personal data into chat. Ask me to use the secure credential mechanism available to you or to log into a fresh browser profile interactively. Never reveal those values in screenshots, traces, logs, URLs, or your final report.

Production is read-only by default. MercadoPago is known to be configured for production, so do not submit payments or refunds. Do not trigger real FirmEasy signing, email, WhatsApp/SMS, notarial sealing, tax issuance, or production-data mutations unless you first establish a provider-safe environment and receive explicit authorization for the named synthetic fixtures and actions. Stop immediately if a real side effect may occur.

Use separate clean browser profiles for anonymous, realtor, landlord, renter, notary, and admin testing. Prove that auth cookies are host-only by inspecting cookie attributes with values redacted and by natural cross-host navigation; never copy cookies between hosts. Admin must not expose protected data before TOTP AAL2. Demo must receive no production auth cookie and cause no production side effects.

For every test, record PASS, FAIL, BLOCKED, or NOT RUN with timestamp, environment/release, browser/profile, sanitized start and final URLs, redirect/status evidence, visible result, and a redacted screenshot or trace reference where useful. A test is PASS only when you observed evidence. Sanitize token paths as /firma/[token], and omit sensitive query values.

At the end, return a Markdown report in the exact format required by section 17 of the browser acceptance guide. Map the evidence to all 15 completion conditions in section 22 of the normative transition guide. If anything applicable is unverified, call the migration partial and state the single next input needed for each remaining blocker.

Start now with the safe anonymous/read-only phase. Your first later blocking question should follow the one-question-at-a-time protocol in section 5.
```
