# VeraDoc Subdomain Browser Acceptance Report

Overall status: **PARTIAL — the notary invitation requirement and blockers P-004/P-004A were removed from current product scope. Historical invitation evidence is retained in sections 35f and 36 as superseded audit history only. Fresh/copy/legacy signing entry, demo/production token separation, invalid ordinary callback failure routing, release identity, and authenticated browser preflight have current-deployment evidence. The customer lifecycle remains FAIL because authenticated production PDF upload is denied by storage RLS in two clean contexts. OTP delivery, payment, certification, provider callbacks, and exact-window provider/auth telemetry remain BLOCKED or PARTIAL for the precise reasons recorded below.**

Report date: 2026-09-15 (initial); 2026-09-16 (retested, remediated, deployed, investigated, fully reverified for the seven-item remediation, evidence re-captured with UTC timestamps, and production telemetry reviewed); 2026-09-17 UTC (cron-secret deployment, production acceptance retest, admin-logout closure, payout-gate verification, exact-window Supabase telemetry closure, B5 expired-session closure, notary packet-detail execution, and D-004 root-cause diagnostic); 2026-09-18 UTC (D-004 production closure, provider-workflow readiness, and authorized synthetic-production execution)

Source evidence: Browser-agent safe anonymous and authenticated reports supplied by the release owner, independent read-only HTTP and Vercel CLI verification, a production Supabase QA Auth fixture bootstrap authorized on 2026-09-15, post-remediation AAL1/AAL2 browser checks in section 8, authenticated acceptance testing on 2026-09-16 (sections 9–16), continued browser acceptance testing on 2026-09-16 (sections 10a, 10b, 9a, 16a), the seven-item retest at `2026-09-16T17:39–17:54Z`, the final D-003 browser/log verification at `2026-09-16T19:05–19:06Z` (section 22), the evidence re-capture at `2026-09-16T20:30–20:57Z`, the Vercel/Supabase telemetry correlation through `2026-09-16T21:06Z` (section 24e), the production acceptance retest against `dpl_8oGzv9X6LeSqXpFUbSsgwvuiiZMi` from `2026-09-17T03:00–03:32Z` with independent Vercel/HTTP corroboration (section 25), the isolated standalone-Chrome focused acceptance pass from `2026-09-17T05:53:09Z` through `05:56:07Z` with subsequent independent artifact, configuration, HTTP, and unit-test verification (section 26), the authenticated aggregate Supabase Logs API query executed at `2026-09-17T06:29:35.722Z`–`06:29:37.121Z` for the exact historical window (section 27), the two-context naturally expired session run plus authenticated exact-window token telemetry at `2026-09-17T18:14:13Z`–`19:14:56Z` (section 28), the two-context notary packet-detail run plus wrong-role context and exact-window telemetry at `2026-09-17T20:55:19Z`–`20:56:33Z` (section 29), and the authenticated production server/client timezone A/B diagnostic at `2026-09-17T21:58:59Z`–`21:59:18Z` (section 30). The earlier B4, B5, and B2/B3 timestamp gaps are superseded by sections 24 and 28. Cookie attributes are confirmed via sanitized browser-context cookie inspection (see sections 10b, 22, 24, 25, 26, 28, and 29).

## 1. Environment and release

| Field | Result |
| --- | --- |
| Environment | Production |
| Marketing | `https://veradoc.pe` |
| App | `https://app.veradoc.pe` |
| Notary | `https://notario.veradoc.pe` |
| Admin | `https://admin.veradoc.pe` |
| Demo | `https://demo.veradoc.pe` |
| Vercel deployment | `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU` |
| Deployment status | Ready, production |
| Current remediation source | Vercel CLI upload from the current invitation-removal working tree; no commit provenance claimed |
| Prior Vercel-reported Git metadata | `3a2203affc7ef4a2809fd69304d43e7bebb47b7c` on `codex/build-out-demo-parties` |
| Post-remediation browser/version | Headless Chrome `152.0.7977.83` |
| Latest authenticated browser timestamp | `2026-09-18T22:36:05Z` |

The Vercel CLI and read-only deployment API independently confirmed that deployment `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51` is Ready, targets production, contains commit `3a2203a`, and has all six public aliases: apex, `www`, app, notary, admin, and demo. Earlier browser evidence was collected against `dpl_52hALsJfRggB56ejjwcMRagH8VQZ`, `dpl_4jk9iEMB5n5GMbc1yj4VWsZXRRUE`, `dpl_BS7UyHNMCkoP2dsNF1vuviWpq2rw`, `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2`, and `dpl_8oGzv9X6LeSqXpFUbSsgwvuiiZMi`; sections 22, 25, and 26 record the successive production verifications.

## 2. QA Auth fixture readiness

Nine dedicated production QA Auth fixtures were created with confirmed emails, passwords, email confirmation, trusted metadata, and matching profile rows where applicable. Password authentication and expected role/status metadata were independently verified through the ordinary public Supabase Auth path.

| Fixture label | Role | Status | Readiness |
| --- | --- | --- | --- |
| `qa-active-realtor` | realtor | active | Ready |
| `qa-active-landlord` | landlord | active | Ready |
| `qa-active-renter` | renter | active | Ready |
| `qa-active-notary` | notary | active | Ready |
| `qa-active-admin` | admin | active | Password login ready; replacement TOTP factor enrolled and AAL2 verified; secret retained only in the ignored local QA handoff |
| `qa-pending-realtor` | realtor | pending approval | Ready |
| `qa-rejected-realtor` | realtor | rejected | Ready |
| `qa-suspended-realtor` | realtor | suspended | Ready |
| `qa-missing-role` | intentionally absent | intentionally absent | Ready; no profile row by design |

All fixtures carry a trusted QA label and a review date of 2026-09-22. Credentials exist only in the local Git-ignored `.env.qa-test-credentials.local.md` handoff and are not included in this report or source control.

A temporary, uniquely named Supabase secret API key was created only for the bootstrap operation, held in process memory, and revoked immediately after fixture verification. A subsequent key inventory confirmed that only the project's pre-existing keys remain.

These accounts authorize authentication testing only. They do not make production payments, signing, messaging, certification, tax, packet, upload, or admin mutations provider-safe.

## 3. Reconciliation of interim findings

### HSTS

The browser summary said HSTS was absent on marketing, notary, admin, and demo. Independent GET requests to the main document on all five hosts returned:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`A-HDR-04` is therefore `PASS` for HSTS and `nosniff`. The apparent absence was an evidence-inspection discrepancy, not a live configuration defect.

### Canonical metadata

Independent GET inspection confirmed that `/`, `/precios`, `/como-funciona`, `/privacidad`, and `/terminos` do not declare a canonical link tag.

- `A-MKT-03a`: `PASS` — no incorrect or internal canonical value is emitted.
- `A-MKT-03b`: `FAIL` — the approved public canonical URL is not explicitly declared.

This is an SEO/canonical-metadata gap, not evidence of a hostname-routing failure.

### CORS

All five sampled ordinary HTML page responses emitted:

```text
Access-Control-Allow-Origin: *
```

No credentialed wildcard behavior was reported, which limits immediate exposure. However, the normative guide says not to add permissive wildcard CORS merely because the product uses subdomains. `A-HDR-05` is therefore `FAIL` pending removal of the global page header or a documented, narrowly scoped justification.

A repository search found no application-owned `Access-Control-Allow-Origin` configuration. The header therefore needs tracing at the deployment/platform response layer before a remediation owner is assigned.

## 4. Safe anonymous results

These are interim results. Rows reported by the browser agent remain subject to the final evidence requirements in the execution guide.

| Test | Status | Result |
| --- | --- | --- |
| A-MKT-01 | PASS | Apex home and sampled marketing/legal pages render. |
| A-MKT-02 | PASS | `www` canonicalizes to apex and preserves a harmless query. |
| A-MKT-03a | PASS | No internal or nonmarketing canonical value is present. |
| A-MKT-03b | FAIL | Sampled marketing pages have no explicit canonical tag. |
| A-MKT-04 | PASS | Marketing responses are not marked `noindex`. |
| A-ISO-01 | PASS | Apex customer dashboard and signing paths redirect to app. |
| A-ISO-02 | PASS | Apex notary paths redirect to clean notary paths. |
| A-ISO-03 | PASS | Apex admin path redirects to admin. |
| A-ISO-04 | PASS | Apex demo paths redirect to clean demo paths. |
| A-ISO-05 | PASS | App does not render admin, notary, or demo trees. |
| A-ISO-06 | PASS | Notary does not render customer, admin, or demo trees. |
| A-ISO-07 | PASS | Admin does not render customer or notary trees. |
| A-ISO-08 | PASS | Demo does not render the production admin tree and exposes only demo routes. |
| A-CLEAN-01–06 | PASS | Clean URLs, direct refresh, and sampled client navigation work without redundant prefixes. |
| A-HDR-01 | PASS | App, notary, admin, and demo are `noindex, nofollow`. |
| A-HDR-02 | PASS | Privileged surfaces return `Referrer-Policy: no-referrer`. |
| A-HDR-03 | PASS | Admin and notary return `frame-ancestors 'none'`. |
| A-HDR-04 | PASS | Direct GET verification confirms HSTS and `nosniff` on all five hosts. |
| A-HDR-05 | FAIL | Ordinary HTML responses globally emit wildcard ACAO. |
| A5 | PASS | Sampled wrong-host POST returned 404 without a cross-host redirect. |
| B-AUTH-01 | PASS | Anonymous app dashboard redirects to app login with a safe `next`. |
| B-AUTH-02 | PASS | Anonymous notary paths redirect to notary login. |
| B-AUTH-03 | PASS | Anonymous admin redirects to admin login. |
| B-AUTH-04 | PASS | Demo production login and callback paths return 404. |
| F-DEMO-01 | PASS | Persistent simulated-data banner was observed on demo pages. |
| F-DEMO-02 | PASS | Sampled demo flows use clean public paths. |
| F-DEMO-04 | PASS | No cookies were observed on demo in the anonymous profile. |
| F-DEMO-08 | PASS | Demo is `noindex, nofollow`. |
| Unknown host | PASS | An unassigned test subdomain failed closed at Vercel. |

## 5. Remaining phase readiness (superseded by section 18)

See section 18 for the updated phase readiness after authenticated testing.

## 6. Completion-condition standing (superseded by section 17)

See section 17 for the updated completion-condition standing after authenticated testing.

## 7. Historical release assessment (superseded by sections 17–19 and 22)

See section 20 for the updated release assessment after authenticated testing.

## 8. Admin post-MFA crash remediation follow-up

Date: 2026-09-15

Release:

- Commit: `b4dad37` (`fix(admin): gate unapplied commercial schema`)
- Production deployment: `dpl_4jk9iEMB5n5GMbc1yj4VWsZXRRUE`
- Deployment URL: `https://veradoc-bds359p0k-jonahs-projects-27d907e3.vercel.app`
- Status: Ready; apex, `www`, app, notary, admin, and demo aliases attached

The application now uses a server-only `COMMERCIAL_ACCOUNTING_ENABLED` gate that defaults to `false`. The production environment-name inventory confirmed that the variable is absent, so the default-off path is active. While disabled:

- The admin page does not query the payout columns or `packet_financial_summary` view introduced by unapplied migration `20260910160000`.
- Payout, finance, and refund/reconciliation tabs are omitted.
- Their Server Actions independently reject after admin/MFA authorization and before any database RPC or MercadoPago access.
- The migration remains unapplied; no production schema or data was changed.

Verification completed before deployment:

- Targeted Vitest: 11 passed.
- Full Vitest: 237 passed across 23 files.
- TypeScript: passed.
- ESLint: zero errors; seven unrelated pre-existing warnings.
- Local production build: passed with inert process-local placeholders for missing local Supabase variable names.
- Vercel remote production build: passed.

Post-deployment browser evidence used new clean headless Chrome contexts and the dedicated QA admin fixture. Password authentication reached `https://admin.veradoc.pe/auth/mfa`; the two-step verification page was visible, admin content was absent, two Supabase cookies remained host-scoped to `admin.veradoc.pe`, and no browser page errors occurred.

With explicit authorization, the single stale TOTP factor on `qa-active-admin` was removed through the Supabase Auth admin MFA API. A replacement TOTP factor was enrolled, verified at AAL2, and retained only in the Git-ignored local QA credential handoff. No other Auth user, factor, database row, schema object, or provider state was changed.

The final clean-browser AAL2 run is `PASS` for the remediation target:

- Final origin/path: `https://admin.veradoc.pe/`.
- `Panel de administración` rendered.
- Core tabs `Resumen`, `Agentes`, `Invitaciones`, `Cobertura`, and `Usuarios` rendered.
- Commercial tabs `Pagos notariales`, `Finanzas`, and `Reembolsos` were absent while the schema gate remained off.
- Two Supabase Auth cookies were scoped to `admin.veradoc.pe`.
- No page exceptions or HTTP 5xx responses occurred.

The dashboard emitted a separate non-blocking console finding: an automatic React Server Component prefetch for `/auth/signup` was redirected from the admin host to `https://app.veradoc.pe/auth/signup`, then blocked by CORS because the `rsc` request header was not allowed by the preflight response. This did not prevent the admin dashboard from rendering, but it remains follow-up evidence for the broader routing/CORS work. Completion condition 9 is now verified; the overall transition remains `PARTIAL`.

## 9. Authenticated role login, dashboard, and logout (B2)

Date: 2026-09-15 (initial); 2026-09-16 (retested with UTC timestamps)

**Status: PARTIAL — 3/5 roles fully complete (landlord, renter, notary); realtor and admin have gaps.**

- **Realtor:** Second nav destination (`/agente/nuevo-paquete`) returns HTTP 500 (D-003) — the page-level navigation check FAIL. No dedicated realtor refresh row is recorded.
- **Admin:** No client navigation checks (admin tabs are not `<Link>` routes). No refresh evidence. Logout was performed via JS cookie clear, not a product UI control (UX-001) — the user-facing logout workflow remains untested.
- **Landlord, Renter, Notary:** Login, ≥2 client-nav links, refresh, logout via product UI, and post-logout back + direct denial all verified.

| Test | Status | UTC | Start → Final URL | Evidence |
| --- | --- | --- | --- | --- |
| B2-REALTOR-LOGIN | PASS | `2026-09-16T03:11:46Z` | `app.veradoc.pe/auth/login` → `app.veradoc.pe/agente` | h1 "Panel del agente inmobiliario", 2 cookies |
| B2-REALTOR-NAV (perfil) | PASS | `2026-09-16T03:12:38Z` | `/agente` → `/agente/perfil` | Perfil: "Configuración de perfil"; history.back() → `/agente`, history.forward() → `/agente/perfil` |
| B2-REALTOR-NAV (nuevo-paquete) | FAIL | `2026-09-16T03:13:44Z` | `/agente/perfil` → `/agente/nuevo-paquete` | HTTP 500 server error (D-003). URL correct; page fails to render. back/forward history works. |
| B2-REALTOR-REFRESH | PASS | `2026-09-16T04:29:29Z` | `/agente` reload → `/agente` | "Panel del agente inmobiliario", 2 cookies preserved after direct refresh |
| B2-REALTOR-LOGOUT | PASS | `2026-09-16T03:16:04Z` | `/agente` → `/auth/login` | "Iniciar sesión", 0 cookies |
| B2-REALTOR-POST-LOGOUT | PASS | `2026-09-16T03:19:25Z` | history.back() → `/auth/login?next=%2Fagente`; direct `/agente` → `/auth/login?next=%2Fagente`; direct `/agente/perfil` → `/auth/login?next=%2Fagente%2Fperfil` | 0 cookies on all |
| B2-LANDLORD-LOGIN | PASS | `2026-09-16T03:08:36Z` | `app.veradoc.pe/auth/login` → `app.veradoc.pe/arrendador` | h1 "Panel del arrendador", 2 cookies |
| B2-LANDLORD-NAV | PASS | `2026-09-16T03:20:26Z` | `/arrendador` → `/arrendador/contratos` → `/arrendador/perfil` | Contratos: "Historial de contratos"; Perfil: "Configuración de perfil". history.back() → `/arrendador/contratos`, history.forward() → `/arrendador/perfil` |
| B2-LANDLORD-REFRESH | PASS | `2026-09-16T03:21:30Z` | `/arrendador` reload preserved session; `/arrendador/contratos` reload preserved session | 2 cookies after each |
| B2-LANDLORD-LOGOUT | PASS | `2026-09-16T03:22:23Z` | `/arrendador/contratos` → `/auth/login` | "Iniciar sesión", 0 cookies |
| B2-LANDLORD-POST-LOGOUT | PASS | `2026-09-16T03:22:30Z` | history.back() → `/auth/login?next=%2Farrendador%2Fcontratos`; direct `/arrendador` → `/auth/login?next=%2Farrendador` | 0 cookies on all |
| B2-RENTER-LOGIN | PASS | `2026-09-16T03:45:08Z` | `app.veradoc.pe/auth/login` → `app.veradoc.pe/arrendatario` | h1 "Panel del arrendatario", 2 cookies |
| B2-RENTER-NAV | PASS | `2026-09-16T03:45:53Z` | `/arrendatario` → `/arrendatario/contratos` → `/arrendatario/perfil` | Contratos: "Historial de contratos"; Perfil: "Configuración de perfil". history.back() → `/arrendatario/contratos`, history.forward() → `/arrendatario/perfil` |
| B2-RENTER-REFRESH | PASS | `2026-09-16T03:46:50Z` | `/arrendatario` reload preserved session; `/arrendatario/contratos` reload preserved session | 2 cookies after each |
| B2-RENTER-LOGOUT | PASS | `2026-09-16T03:47:38Z` | `/arrendatario/contratos` → `/auth/login` | "Iniciar sesión", 0 cookies |
| B2-RENTER-POST-LOGOUT | PASS | `2026-09-16T03:47:59Z` | history.back() → `/auth/login?next=%2Farrendatario%2Fcontratos`; direct `/arrendatario` → `/auth/login?next=%2Farrendatario` | 0 cookies on all |
| B2-NOTARY-LOGIN | PASS | `2026-09-16T03:26:10Z` | `notario.veradoc.pe/auth/login` → `notario.veradoc.pe/` | h1 "Panel del notario", 2 cookies |
| B2-NOTARY-NAV | PASS | `2026-09-16T03:26:54Z` | `/` → `/historial` → `/perfil` | Historial: "Historial"; Perfil: "Configuración de perfil" |
| B2-NOTARY-GANANCIAS | FAIL | (prior) | `/ganancias` → server error (ERROR 2581687241) | Confirmed: `getNotaryEarnings` selects from unapplied migration — see D-002 |
| B2-NOTARY-REFRESH | PASS | `2026-09-16T03:27:50Z` | `/perfil` reload preserved session; `/` reload preserved session | 2 cookies after each |
| B2-NOTARY-LOGOUT | PASS | `2026-09-16T03:28:42Z` | `notario.veradoc.pe/` → `notario.veradoc.pe/auth/login` | "Iniciar sesión", 0 cookies |
| B2-NOTARY-POST-LOGOUT | PASS | `2026-09-16T03:29:26Z` | history.back() → `/auth/login`; direct `/` → `/auth/login?next=%2F`; direct `/perfil` → `/auth/login?next=%2Fperfil`; direct `/historial` → `/auth/login?next=%2Fhistorial` | 0 cookies on all |
| B2-ADMIN-LOGIN | PASS | `2026-09-16T03:27:26Z` | `admin.veradoc.pe/auth/login` → `/auth/mfa` (AAL1) → `/` (AAL2) | h1 "Panel de administración", 2 cookies |
| B2-ADMIN-NAV | N/A | `2026-09-16T04:31:10Z` | `admin.veradoc.pe/` (all tabs) | Admin tabs (Resumen, Agentes, Invitaciones, Cobertura, Usuarios) are in-page tab components, not `<Link>` routes. URL stays at `/` throughout. B2 two-client-link requirement is structurally inapplicable. All 5 tabs exercised and render correct content. |
| B2-ADMIN-REFRESH | PASS | `2026-09-16T04:31:00Z` | `admin.veradoc.pe/` reload → `admin.veradoc.pe/` | "Panel de administración" preserved, AAL2 session intact, 2 cookies, no MFA re-prompt |
| B2-ADMIN-LOGOUT | PARTIAL | (prior + `2026-09-16`) | JS cookie clear → `/auth/login?next=%2F` | 0 cookies. **Session invalidation verified, but via developer-tooling cookie clear, not a product UI control. The user-facing logout workflow is untested because no logout button exists (UX-001).** |
| B2-ADMIN-BACKBUTTON | PASS | (prior) | history.back() and direct `/` both redirect to login after cookie-clear logout |

### Finding: Admin missing logout button (UX-001)

The admin dashboard has no visible "Cerrar sesión" button. Logout was performed via Supabase client cookie clear. This is a UX gap, not a security gap — the session clears correctly when the action is triggered.

### Finding: Notary `/ganancias` server error (D-002)

`notario.veradoc.pe/ganancias` returns a server error (ERROR 2581687241). **Confirmed cause:** `getNotaryEarnings` in `lib/actions/notary.ts` unconditionally selects `notary_igv_centimos`, a column introduced by the unapplied commercial migration `20260910160000_commercial_accounting.sql`. The `COMMERCIAL_ACCOUNTING_ENABLED` gate that was applied to the admin surface needs to be extended to the notary earnings page.

### Finding: Realtor `/agente/nuevo-paquete` server error (D-003)

`app.veradoc.pe/agente/nuevo-paquete` returns a Vercel "This page couldn't load" server error for the QA realtor. This blocks the "new packet" workflow and needs investigation. Navigation and history behavior are correct (URL updates, back/forward work), but the page itself fails to render.

### Note: Renter initial FAIL was cookie cross-talk

The initial renter Contratos navigation failure (session lost → redirect to login) was caused by parallel QA sessions for different roles running on the same `app.veradoc.pe` host in the shared browser profile. When retested in an isolated single-session profile, all renter navigation (Contratos + Perfil) worked correctly with 2 cookies maintained throughout.

## 10. Host-only cookie isolation (B3) — PASS — host-scoping verified; SEC-001 recorded for missing Secure flags

**Status: PASS — host-scoping verified; SEC-001 recorded for missing Secure flags.** Nine authenticated-source cross-host destinations, two session-persistence checks (notary and admin survive cross-host visits), and one demo no-auth confirmation are now tested. Cookie attributes have been captured via sanitized browser-context cookie inspection (section 10b).

**Previously open gaps now closed:**

- **B3-NOTARY-TO-ADMIN**: Tested `2026-09-16T04:27:25Z` while notary session active — admin showed login page, 0 cookies.
- **B3-NOTARY-TO-DEMO**: Retested `2026-09-16T04:27:39Z` while notary session active — demo showed "Modo demostración", 0 cookies, no `sb-` prefixed cookies.
- **B3-NOTARY-SESSION-PERSIST**: Notary session survived visiting both admin and demo — returned to `notario.veradoc.pe/` with "Panel del notario" and 2 cookies at `2026-09-16T04:27:48Z`.
- **B3-COOKIE-ATTRS**: Confirmed via sanitized browser-context cookie inspection for all three authenticated surfaces (section 10b).

| Test | Status | UTC | Evidence |
| --- | --- | --- | --- |
| B3-APP-TO-NOTARY | PASS | (prior, no UTC) | While authenticated on app (2 JS-visible cookies), `notario.veradoc.pe/` → login, 0 JS-visible cookies |
| B3-APP-TO-ADMIN | PASS | (prior, no UTC) | While authenticated on app, `admin.veradoc.pe/` → login, 0 JS-visible cookies |
| B3-APP-TO-DEMO | PASS | (prior, no UTC) | While authenticated on app, `demo.veradoc.pe/` rendered demo home, 0 JS-visible cookies |
| B3-NOTARY-TO-APP | PASS | `2026-09-16T03:30:37Z` | While authenticated on notary (2 cookies), `app.veradoc.pe/agente` → `/auth/login?next=%2Fagente`, 0 cookies |
| B3-NOTARY-TO-ADMIN | PASS | `2026-09-16T04:27:25Z` | While authenticated on notary (2 cookies), `admin.veradoc.pe/` → `/auth/login?next=%2F`, 0 cookies |
| B3-NOTARY-TO-DEMO | PASS | `2026-09-16T04:27:39Z` | While authenticated on notary (2 cookies), `demo.veradoc.pe/` → "Modo demostración", 0 cookies, no `sb-` prefixed cookies |
| B3-NOTARY-SESSION-PERSIST | PASS | `2026-09-16T04:27:48Z` | After visiting admin and demo, returned to `notario.veradoc.pe/` → h1 "Panel del notario", 2 cookies (notary session survived cross-host nav) |
| B3-ADMIN-TO-APP | PASS | `2026-09-16T03:28:11Z` | While authenticated on admin (AAL2, 2 cookies), `app.veradoc.pe/agente` → `/auth/login?next=%2Fagente`, 0 cookies |
| B3-ADMIN-TO-NOTARY | PASS | `2026-09-16T03:28:49Z` | While authenticated on admin, `notario.veradoc.pe/` → `/auth/login?next=%2F`, 0 cookies |
| B3-ADMIN-TO-DEMO | PASS | `2026-09-16T03:29:39Z` | While authenticated on admin, `demo.veradoc.pe/` → "Modo demostración", 0 cookies |
| B3-ADMIN-SESSION-PERSIST | PASS | `2026-09-16T03:29:56Z` | After visiting app/notary/demo, returned to `admin.veradoc.pe/` → h1 "Panel de administración", 2 cookies (admin session survived cross-host nav) |
| B3-DEMO-NO-AUTH | PASS | `2026-09-16T04:31:28Z` | While admin session active on admin host, `demo.veradoc.pe/` → 0 cookies |

### 10a. Demo cookie isolation summary

Demo received zero cookies across all tested scenarios:
- Anonymous visit: 0 cookies.
- While notary session active (different host): 0 cookies, no `sb-` prefixed.
- While admin session active (different host): 0 cookies.
- No parent-domain cookie `Domain=.veradoc.pe` was observed on any surface (section 10b).

### 10b. Cookie attribute evidence (B3-COOKIE-ATTRS)

**Status: PASS (host-scoping confirmed); FINDING (Secure=false).**

Cookie attributes were confirmed via sanitized browser-context cookie inspection, which provides `domain`, `path`, `secure`, `httpOnly`, `sameSite`, and `expires` for each cookie. The two Supabase auth cookies on each authenticated surface are `HttpOnly=false`.

| Surface | UTC | Cookie count | Name prefix | Domain | Path | Secure | SameSite | HttpOnly |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `app.veradoc.pe` | `2026-09-16T04:29:21Z` | 2 | `sb-fy***` | `app.veradoc.pe` | `/` | `false` | `lax` | `false` |
| `notario.veradoc.pe` | `2026-09-16T04:27:17Z` | 2 | `sb-fy***` | `notario.veradoc.pe` | `/` | `false` | `lax` | `false` |
| `admin.veradoc.pe` | `2026-09-16T04:30:52Z` | 2 | `sb-fy***` | `admin.veradoc.pe` | `/` | `false` | `lax` | `false` |
| `demo.veradoc.pe` | `2026-09-16T04:31:28Z` | 0 | — | — | — | — | — | — |

**Key findings:**

1. **Domain is the specific host on all three authenticated surfaces** (`app.veradoc.pe`, `notario.veradoc.pe`, `admin.veradoc.pe`). No parent-domain cookie `Domain=.veradoc.pe` was present. Each cookie is scoped to its specific host. This is the required behavior per SD-INV-006. **Release-blocking check: PASS.**
2. **Secure = `false`.** The cookies are not marked `Secure`. On an HTTPS-only deployment with HSTS, the practical exposure is limited (cookies cannot be transmitted over HTTP because HSTS prevents non-HTTPS requests). However, the `Secure` flag is a defense-in-depth measure. This is recorded as a **new finding (SEC-001)** for remediation but is not release-blocking given HSTS coverage.
3. **HttpOnly = false.** Both Supabase auth cookies are confirmed `HttpOnly=false` by sanitized browser-context cookie inspection. This is the default Supabase client behavior — the `sb-*-auth-token` cookies are intentionally accessible to the Supabase JS client for session management. Not a defect; documented as expected behavior.
4. **SameSite = `lax`.** Standard browser default for modern browsers. Provides CSRF protection for non-GET cross-site requests.
5. **Demo receives zero cookies.** Confirmed via sanitized browser-context cookie inspection while other surface sessions were active.

## 11. Wrong-role login matrix (B4)

All 10 cross-surface login attempts redirected to the user's correct canonical login page with `?error=wrong-surface`.

| Account role | Wrong host attempted | Redirect destination | Status |
| --- | --- | --- | --- |
| Notary | `app.veradoc.pe` | `notario.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Notary | `admin.veradoc.pe` | `notario.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Realtor | `notario.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Realtor | `admin.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Admin | `app.veradoc.pe` | `admin.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Admin | `notario.veradoc.pe` | `admin.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Landlord | `admin.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Landlord | `notario.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Renter | `admin.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |
| Renter | `notario.veradoc.pe` | `app.veradoc.pe/auth/login?error=wrong-surface` | PASS |

## 12. Historical account-state matrix (B5) — PARTIAL (5/6; superseded by section 28)

At this checkpoint, the normative matrix contained six states and expired-but-refreshable remained untested. Section 28 subsequently closes that state and B5 overall.

| Account state | Login host | Result | Status |
| --- | --- | --- | --- |
| pending_approval | `app.veradoc.pe` | → `/auth/pending-approval` ("Cuenta pendiente de aprobación") | PASS |
| rejected | `app.veradoc.pe` | → `/auth/rejected` ("Solicitud no aprobada") | PASS |
| suspended | `app.veradoc.pe` | Remains at `/auth/login` with no dashboard access; no error message displayed | PASS (security); UX NOTE (no visible error) |
| missing role (no profile) | `app.veradoc.pe` | → `/auth/pending-approval` (treated as pending) | PASS |
| invalid session (corrupted cookie) | `app.veradoc.pe` | → `/auth/login?next=%2Fagente` (rejected, `next` preserved) | PASS |
| expired but refreshable | — | — | NOT RUN — requires controlled fixture with known expiry timing |

### Finding: Suspended account silent failure (UX)

When a suspended user logs in, the form returns to the login page without a visible error message. The user is correctly blocked from the dashboard, so there is no security gap. However, a user-facing "account suspended" message would improve UX.

## 13. Read-only dashboard evidence (C/D) — PARTIAL

**Status: PARTIAL.** Dashboard and profile pages render correctly for all roles, but two specific pages return server errors:

- **D-002 (FAIL):** Notary `/ganancias` — server error from unapplied migration column.
- **D-003 (FAIL):** Realtor `/agente/nuevo-paquete` — server render exception.

These are functional failures, not routing or isolation issues. The routing, navigation, and session behavior around them is correct.

| Surface | Page | URL | Content verified | Status | UTC |
| --- | --- | --- | --- | --- | --- |
| App (realtor) | Panel | `/agente` | "Panel del agente inmobiliario", 0 paquetes, filter controls | PASS | `2026-09-16T03:11:46Z` |
| App (realtor) | Perfil | `/agente/perfil` | "Configuración de perfil", readonly DNI/province/license fields | PASS | `2026-09-16T03:12:38Z` |
| App (realtor) | Nuevo paquete | `/agente/nuevo-paquete` | Server error (D-003) | FAIL | `2026-09-16T03:13:44Z` |
| App (landlord) | Panel | `/arrendador` | "Panel del arrendador", contracts/signing/certified stats at 0 | PASS | `2026-09-16T03:08:36Z` |
| App (landlord) | Contratos | `/arrendador/contratos` | "Historial de contratos", "Sin resultados" | PASS | `2026-09-16T03:20:26Z` |
| App (landlord) | Perfil | `/arrendador/perfil` | "Configuración de perfil", email/WhatsApp/DNI form | PASS | `2026-09-16T03:21:21Z` |
| App (renter) | Panel | `/arrendatario` | "Panel del arrendatario", contracts/signing/certified stats at 0, account info | PASS | `2026-09-16T03:45:08Z` |
| App (renter) | Contratos | `/arrendatario/contratos` | "Historial de contratos", "Sin resultados" | PASS | `2026-09-16T03:45:53Z` |
| App (renter) | Perfil | `/arrendatario/perfil` | "Configuración de perfil", name/email/WhatsApp/DNI/password fields | PASS | `2026-09-16T03:46:13Z` |
| Notary | Cola | `/` (notario host) | "Panel del notario", queue tabs, stats cards | PASS | `2026-09-16T03:26:10Z` |
| Notary | Historial | `/historial` | "Historial", tabs: Certificados/Corrección/Rechazados | PASS | `2026-09-16T03:26:54Z` |
| Notary | Ganancias | `/ganancias` | Server error (D-002) | FAIL | (prior) |
| Notary | Perfil | `/perfil` | "Configuración de perfil", notary-specific fields | PASS | `2026-09-16T03:27:36Z` |
| Admin | Panel | `/` (admin host) | "Panel de administración", tabs: Resumen/Agentes/Invitaciones/Cobertura/Usuarios | PASS | `2026-09-16T03:27:26Z` |
| Notary cross-host | `/agente` on notary | Redirect to `app.veradoc.pe/auth/login?next=%2Fagente` | PASS | `2026-09-16T03:36:10Z` |

## 14. Demo state persistence (F-DEMO-03)

| Test | Status | UTC | Evidence |
| --- | --- | --- | --- |
| F-DEMO-03a | PASS | `2026-09-16T03:38:21Z` | Demo agente dashboard at `demo.veradoc.pe/agente` renders with h1 "Panel del agente inmobiliario", banner "Modo demostración — datos simulados", 7 simulated packet links, 0 cookies |
| F-DEMO-03b | PASS | `2026-09-16T03:38:56Z` | Direct refresh preserves demo state: same h1, banner, 7 packets, 0 cookies |
| F-DEMO-03c | PASS | `2026-09-16T03:39:20Z` | Client nav to `demo.veradoc.pe/agente/paquetes/pkt-2024-005` renders packet detail h1 "PKT-2024-005" with banner, 0 cookies |
| F-DEMO-03d | PASS | `2026-09-16T03:40:59Z` | history.back() → `/agente` (h1 "Panel del agente inmobiliario"); history.forward() → `/agente/paquetes/pkt-2024-005`, 0 cookies |
| F-DEMO-03e | PASS | `2026-09-16T03:41:30Z` | Demo home at `demo.veradoc.pe/` renders h1 "Modo demostración", 0 cookies |
| F-DEMO-03f | PASS | `2026-09-16T03:41:45Z` | Demo arrendador at `demo.veradoc.pe/arrendador` renders h1 "Panel del arrendador" with demo banner, 0 cookies |
| F-DEMO-03g | PASS | `2026-09-16T03:42:18Z` | Demo arrendatario at `demo.veradoc.pe/arrendatario` renders h1 "Panel del arrendatario" with demo banner, 0 cookies |

## 15. Authenticated navigation (G) — PARTIAL

**Status: PARTIAL.** Navigation routing patterns (refresh, `<Link>`, back/forward, redirect query preservation, no loops, no prefix leakage) are verified and working. However, two `<Link>` destinations return server errors:

- **G-LINK-APP (realtor):** `/agente/nuevo-paquete` renders HTTP 500 (D-003).
- **G-LINK-NOTARY:** `/ganancias` renders server error (D-002).

Additionally: no notary packet-detail navigation evidence (no assigned packets for QA notary). Admin tab navigation and refresh evidence now captured (section 16).

| Test | Status | UTC | Evidence |
| --- | --- | --- | --- |
| G-REFRESH-APP (realtor) | PASS | `2026-09-16T03:11:46Z` | Direct reload of `/agente` preserved realtor session |
| G-REFRESH-APP (landlord) | PASS | `2026-09-16T03:21:30Z` | Direct reload of `/arrendador` and `/arrendador/contratos` both preserved session, 2 cookies |
| G-REFRESH-APP (renter) | PASS | `2026-09-16T03:46:50Z` | Direct reload of `/arrendatario` and `/arrendatario/contratos` both preserved session, 2 cookies |
| G-REFRESH-NOTARY | PASS | `2026-09-16T03:27:50Z` | Direct reload of `/perfil` and `/` on notary host preserved session, 2 cookies |
| G-LINK-APP (realtor) | PARTIAL | `2026-09-16T03:12:38Z` | Sidebar `<Link>`: Panel → Perfil (PASS) → Nuevo paquete (FAIL — HTTP 500, D-003). URL routing correct; page render fails. |
| G-LINK-APP (landlord) | PASS | `2026-09-16T03:20:26Z` | Sidebar `<Link>`: Panel → Contratos → Perfil |
| G-LINK-APP (renter) | PASS | `2026-09-16T03:45:53Z` | Sidebar `<Link>`: Panel → Contratos → Perfil |
| G-LINK-NOTARY | PARTIAL | `2026-09-16T03:26:54Z` | Sidebar `<Link>`: Cola → Historial (PASS) → Perfil (PASS). Ganancias FAIL — server error D-002. |
| G-LINK-DEMO | PASS | `2026-09-16T03:39:20Z` | Demo: home → agente → pkt-2024-005 packet detail via `<Link>` |
| G-BACKFWD-APP (realtor) | PASS | `2026-09-16T03:13:44Z` | back → `/agente/perfil`, forward → `/agente/nuevo-paquete` |
| G-BACKFWD-APP (landlord) | PASS | `2026-09-16T03:21:21Z` | back → `/arrendador/contratos`, forward → `/arrendador/perfil` |
| G-BACKFWD-APP (renter) | PASS | `2026-09-16T03:46:13Z` | back → `/arrendatario/contratos`, forward → `/arrendatario/perfil` |
| G-BACKFWD-DEMO | PASS | `2026-09-16T03:40:59Z` | back → `/agente`, forward → `/agente/paquetes/pkt-2024-005` |
| G-REDIRECT-QUERY (app) | PASS | `2026-09-16T03:42:30Z` | `/agente/perfil` → `/auth/login?next=%2Fagente%2Fperfil` |
| G-REDIRECT-QUERY (notary) | PASS | `2026-09-16T03:42:45Z` | `/historial` → `/auth/login?next=%2Fhistorial` |
| G-NO-LOOPS (legacy prefix) | PASS | `2026-09-16T03:43:00Z` | `notario.veradoc.pe/notario/perfil` → `/auth/login?next=%2Fperfil` (single redirect, no loop) |
| G-NO-LOOPS (login) | PASS | `2026-09-16T03:43:10Z` | `app.veradoc.pe/auth/login` renders login form without loop |
| G-NO-PREFIX (notary) | PASS | `2026-09-16T03:43:20Z` | `notario.veradoc.pe/perfil` URL stays `/perfil`, no `/notario/` prefix |
| G-NO-PREFIX (demo) | PASS | `2026-09-16T03:43:30Z` | `demo.veradoc.pe/agente` URL stays `/agente`, no `/demo/` prefix |

## 16. Remaining admin checks (E) — PARTIAL (UX-001 logout only)

**Status: PARTIAL.** Cross-surface admin content isolation is verified (admin paths on app/notary/demo/apex all redirect to admin login). Admin state-specific denial is now complete (3/3 PASS). The only remaining gap is:

- **Admin logout** was verified via JS cookie clear, not a product UI control (UX-001). This proves session invalidation works at the technical level, but the user-facing logout workflow is untested because no logout button exists.
- **Admin refresh**: Now tested and PASS — direct refresh at `admin.veradoc.pe/` preserves the AAL2 session without re-prompting for MFA.
- **Admin tab navigation**: All 5 in-page tabs (Resumen, Agentes, Invitaciones, Cobertura, Usuarios) exercised. These are in-page tab components, not `<Link>` routes; the B2 two-client-link requirement is structurally N/A for admin.

| Test | Status | UTC | Evidence |
| --- | --- | --- | --- |
| E-ADMIN-LOGOUT | PARTIAL | `2026-09-16T03:27:26Z` | JS cookie clear → admin dashboard redirects to `/auth/login?next=%2F`, 0 cookies. **Session invalidation verified. User-facing logout untested (UX-001).** |
| E-ADMIN-BACKBUTTON | PASS | (prior, no UTC) | history.back() and direct `/` both redirect to login after cookie-clear logout |
| E-WRONG-ROLE-ADMIN | PASS | (prior, no UTC) | All non-admin active roles (realtor, notary, landlord, renter) redirect to their canonical login with `?error=wrong-surface` |
| E-ADMIN-PENDING | PASS | `2026-09-16T04:32:09Z` | `qa-pending-realtor` on `admin.veradoc.pe/auth/login` → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 cookies on admin. Denial via **wrong-surface role enforcement** (realtor ≠ admin). No admin data rendered. |
| E-ADMIN-REJECTED | PASS | `2026-09-16T04:32:32Z` | `qa-rejected-realtor` on `admin.veradoc.pe/auth/login` → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 cookies on admin. Denial via **wrong-surface role enforcement**. No admin data rendered. |
| E-ADMIN-SUSPENDED | PASS | `2026-09-16T04:32:55Z` | `qa-suspended-realtor` on `admin.veradoc.pe/auth/login` → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 cookies on admin. Denial via **wrong-surface role enforcement**. No admin data rendered. |
| E-ADMIN-NO-SESSION-SURVIVES | PASS | `2026-09-16T04:33:00Z` | After all 3 state-denial attempts, direct `admin.veradoc.pe/` → `/auth/login?next=%2F`, 0 cookies. No usable admin-host session survived any denied login attempt. |
| E-ADMIN-CONTENT-APP | PASS | `2026-09-16T03:35:00Z` | `app.veradoc.pe/admin` → `admin.veradoc.pe/auth/login?next=%2F`, no admin dashboard content |
| E-ADMIN-CONTENT-NOTARY | PASS | `2026-09-16T03:35:15Z` | `notario.veradoc.pe/admin` → `admin.veradoc.pe/auth/login?next=%2F`, no admin dashboard content |
| E-ADMIN-CONTENT-DEMO | PASS | `2026-09-16T03:35:25Z` | `demo.veradoc.pe/admin` → `admin.veradoc.pe/auth/login?next=%2F`, no admin dashboard content |
| E-ADMIN-CONTENT-APEX | PASS | `2026-09-16T03:35:35Z` | `veradoc.pe/admin` → `admin.veradoc.pe/auth/login?next=%2F`, no admin dashboard on apex |
| E-CROSS-SURFACE-NOTARY-ON-APP | PASS | `2026-09-16T03:35:45Z` | `app.veradoc.pe/notario` → `notario.veradoc.pe/auth/login?next=%2F` |
| E-CROSS-SURFACE-DEMO-ON-APP | PASS | `2026-09-16T03:35:55Z` | `app.veradoc.pe/demo` → `demo.veradoc.pe/` ("Modo demostración") |
| E-CROSS-SURFACE-APP-ON-NOTARY | PASS | `2026-09-16T03:36:10Z` | `notario.veradoc.pe/agente` → `app.veradoc.pe/auth/login?next=%2Fagente` |
| E-DEMO-NO-PROD-AUTH | PASS | `2026-09-16T03:36:58Z` | `demo.veradoc.pe/auth/login` → empty document, no login form, no password field, 0 cookies |

## 17. Updated completion-condition standing

| # | Completion condition | Standing | Change |
| --- | --- | --- | --- |
| 1 | Each hostname serves only its approved surface | **PASS** — anonymous and sampled authenticated surface isolation verified; wrong-role matrix 10/10; admin content unavailable from app/notary/demo/apex (8/8) | Confirmed |
| 2 | Public URLs follow the clean target contract | **PASS** — tested navigation uses clean public paths; no prefix leakage; legacy `/notario/perfil` collapses to clean `/perfil`; all 9 marketing routes publish matching route-specific canonical and `og:url` values | ↑ from PARTIAL to PASS |
| 3 | Durable generated links use typed origins | PARTIAL — automated/source evidence exists; fresh copied/email links remain untested | — |
| 4 | Auth callbacks establish sessions on intended host | BLOCKED — password login was tested (not a callback); magic-link, confirmation, recovery, and OAuth callback flows remain untested | Remains BLOCKED |
| 5 | Sessions remain host-scoped | **PASS** — nine authenticated-source cross-host destinations, two session-persistence checks, and one demo no-auth confirmation all pass; password-session cookies are host-only, `Secure=true`, and `SameSite=Lax` on app, notary, and admin; demo receives 0 cookies | Confirmed; SEC-001 closed |
| 6 | Server authorization works independently of Proxy | PARTIAL — wrong-role denial (10/10 active, UTC-timestamped + 3/3 state-specific admin denial), account-state gating (6/6 states, UTC-timestamped), MFA enforcement, expired-session role enforcement, and product-level post-logout access denial on all surfaces including the admin back-button; admin refresh preserves AAL2; negative mutation matrix blocked | ↑ B5 complete; remains PARTIAL for negative mutations |
| 7 | Fresh and legacy signing links complete | BLOCKED | — |
| 8 | Notary invitation delivery | **REMOVED FROM PRODUCT SCOPE** — exclusive notary is operationally provisioned; retired links must fail closed | Not counted in applicable-condition totals |
| 9 | Admin includes the approved additional control | **PASS** — AAL1→MFA gate, AAL2→dashboard, visible product-level logout, session-cookie removal, same-host login redirect, back/direct/refresh denial, and wrong-role denial are verified | UX-001 closed in section 26 |
| 10 | Demo cannot cause production side effects | PARTIAL — anonymous+interactive demo checks pass; 0 cookies; demo `/auth/login` returns empty document (no login form); mutation/token tests blocked | ↑ from PARTIAL |
| 11 | APIs, webhooks, cron, and actions avoid cross-host redirects | PARTIAL — sampled wrong-host POST and automated tests pass; provider workflows remain untested | — |
| 12 | Only marketing is intentionally indexable | **PASS** | Confirmed |
| 13 | Automated and manual matrices pass | PARTIAL — the seven-item remediation is 7/7 PASS; B2 is complete for all 5 roles, including the product-level admin logout; B3 is complete with secure host-only cookies and UTC-timestamped re-records; B4 is 10/10 UTC-timestamped; B5 is 6/6 UTC-timestamped; D-002 and D-003 pass; E cross-surface isolation is 8/8 with admin state-specific denial 3/3; F-DEMO-03 is 7/7; provider workflows remain blocked | ↑ B5 complete; remains PARTIAL for other packages |
| 14 | Production telemetry shows no material regression | **PASS** — all public surfaces are healthy with no observed CORS failures, redirect loops, or current-deployment 5xx responses; the notification-outbox cron defect is closed; and the authenticated exact-window Supabase query found 67 retained edge-log events with zero `notary_payout_rates` requests and zero associated HTTP 400 responses. | ↑ from PARTIAL to PASS; exact-window database telemetry closed in section 27 |
| 15 | Rollback exercised or proven production-like | BLOCKED | — |

**Summary: 6 PASS (#1, #2, #5, #9, #12, #14), 5 PARTIAL (#3, #6, #10, #11, #13), 3 BLOCKED (#4, #7, #15), and 1 REMOVED FROM PRODUCT SCOPE (#8).**

## 18. Updated phase readiness

| Area | Status | Missing prerequisite |
| --- | --- | --- |
| B2: login, logout, post-logout | **COMPLETE** — all five roles are functionally complete. Admin product-level logout clears both auth-cookie chunks, stays on the admin host, and prevents access after back, direct navigation, and refresh. | — |
| B3: cookie isolation | **PASS** — 9 authenticated-source cross-host destinations, 2 session-persistence checks, 1 demo no-auth confirmation; app, notary, and admin password-session cookies are host-only, `Secure=true`, and `SameSite=Lax`; demo receives 0 cookies | — |
| B4: wrong-role matrix | **COMPLETE** — 10/10 PASS, UTC-timestamped (section 24a) | — |
| B5: account states | **COMPLETE — 6/6 PASS**, UTC-timestamped (sections 24b and 28) | — |
| C: read-only role dashboard/navigation | **COMPLETE** — dashboard and profile pages render for all 3 app roles; realtor `/agente/nuevo-paquete` returns HTTP 200 and renders the six-step wizard | — |
| C: customer packet/upload/signing workflow | BLOCKED | Provider-safe environment, synthetic packet/signing links, safe OTP sink, and mutation authorization |
| D: read-only notary dashboard/navigation | PARTIAL — `/ganancias` is healthy; the packet queue link, initial detail render, clean paths, back/forward, and wrong-role denial pass, but direct packet-detail refresh emits React hydration error #418 in 2/2 clean notary contexts | Diagnose and remediate D-004, then rerun the focused refresh check |
| D: notary certification workflow | BLOCKED | Assigned synthetic packet, stubbed provider path, mutation authorization, and audit visibility |
| E: admin access control | **COMPLETE** — cross-surface admin content isolation 8/8; wrong-role denial verified; admin state-specific denial 3/3 PASS; product-level logout removes both auth-cookie chunks and denies access after back/direct/refresh; admin refresh PASS; admin tab navigation N/A. | — |
| E: privileged mutation and audit | BLOCKED | Harmless synthetic target, mutation authorization, and audit visibility |
| F-DEMO-03: state persistence | **COMPLETE** — 7/7 checks including refresh, client nav, back/forward, multi-role demo surfaces | — |
| F-DEMO-05/06/07: side-effect and token separation | BLOCKED | Network evidence plus safe demo/production-shaped synthetic tokens |
| G: authenticated navigation | PARTIAL — packet-detail `<Link>` navigation and back/forward pass in 2/2 clean notary contexts with no prefix leakage, but direct refresh emits D-004 in both contexts | Diagnose and remediate D-004, then rerun |
| G: negative privileged mutations | BLOCKED | Provider-safe mutation targets and explicit mutation authorization |
| H1: telemetry | **PASS** — public-surface and Supabase auth telemetry reviewed; notification-outbox cron 503 closed; payout-rate query gated and verified disabled; authenticated exact-window query returned 67 retained edge-log events, zero `notary_payout_rates` requests, and zero associated HTTP 400 responses | — |
| H2: rollback exercise | BLOCKED | Production-like environment, named operator, and explicit exercise authorization |

## 19. Defects and findings

| ID | Severity | Summary | Status |
| --- | --- | --- | --- |
| D-002 | Medium | `notario.veradoc.pe/ganancias` server error (ERROR 2581687241) — **confirmed cause:** `getNotaryEarnings` selected `notary_igv_centimos`, a column from unapplied migration `20260910160000_commercial_accounting.sql` | **PASS IN PRODUCTION** — authenticated `/ganancias` returned HTTP 200 and the stable unavailable-state message; reconfirmed on current deployment in section 25 |
| D-003 | Medium | `app.veradoc.pe/agente/nuevo-paquete` server error — **serial causes:** the disabled-gate path originally queried unapplied effective-date columns; after that code fix, deployment `dpl_BS7UyHNMCkoP2dsNF1vuviWpq2rw` supplied an invalid `SUPABASE_SECRET_KEY`, causing the legacy `pricing_config` request to return 401 | **PASS IN PRODUCTION** — first closed on corrected-key deployment `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2`; authenticated wizard and pricing fallback remain healthy on current deployment per section 25 |
| UX-001 | Low | Admin dashboard had no visible logout button | **PASS IN PRODUCTION** — visible submit control, pending state, cookie removal, same-host login redirect, and back/direct/refresh denial verified in section 26 |
| UX-002 | Low | Suspended account login shows no visible error message | **PASS IN PRODUCTION** — persistent suspended-account `role="alert"`; no dashboard navigation or surviving session cookies |
| A-MKT-03b | Low | Marketing pages missing explicit canonical tags | PASS IN PRODUCTION — 9/9 canonical and `og:url` values verified |
| A-HDR-05 | Medium | Global wildcard `Access-Control-Allow-Origin: *` on HTML responses | PASS IN PRODUCTION — exact same-origin ACAO verified on all five surfaces |
| SEC-001 | Low | Supabase password-session cookies lacked the `Secure` flag | **PASS IN PRODUCTION** — both cookie chunks are `Secure=true`, host-only, and `SameSite=Lax` on app, notary, and admin |
| RSC-CORS | Low | Admin RSC prefetch for `/auth/signup` CORS warning | PASS IN PRODUCTION — zero speculative signup RSC requests observed |
| D-004 | Medium | Direct refresh of an authenticated notary packet detail emits minified React hydration error #418 while the HTTP 200 page remains visibly rendered | **ROOT CAUSE CONFIRMED; FIX PENDING** — server UTC and browser-local date/time output differ because `EvidenceReviewClient` omits an explicit `timeZone`; sections 29–30 |

### 19a. Seven-item remediation implementation and closure

The seven items in the fix-then-retest list were remediated without applying migration `20260910160000_commercial_accounting.sql`. All seven are now deployed and verified in production:

- **D-002:** notary earnings now fails closed before creating an admin client while commercial accounting is disabled; the page renders an unavailable-state message instead of querying unapplied payout columns.
- **D-003:** packet pricing now uses the legacy pricing columns while the commercial gate is disabled and only applies effective-date filters after the versioned schema is enabled.
- **A-MKT-03b:** all nine marketing routes now publish matching explicit apex canonical and Open Graph URLs.
- **A-HDR-05:** live tracing showed that Vercel adds wildcard ACAO to cached static HTML but not dynamic Proxy redirects. Host-matched Next.js response rules now override the platform default with each surface's exact own origin on apex, `www`, app, notary, admin, and demo. The production build manifest contains all six non-wildcard rules.
- **RSC-CORS:** the signup control is now a normal document link, so admin/notary login pages do not issue speculative RSC prefetches that redirect cross-origin.
- **SEC-001:** all Supabase browser/server/Proxy clients share a production `Secure` cookie policy while omitting `Domain` to preserve host-only sessions.
- **UX-002:** suspended login invalidates the newly created session and returns a persistent inline `role="alert"` message.

Local verification: remediation-focused Vitest **29/29 passed**; complete Vitest **252/252 passed** before the final isolated header-rule strengthening; post-header routing/header Vitest **12/12 passed**; TypeScript **passed**; ESLint **0 errors** (7 unrelated pre-existing warnings); Next.js production build **passed** with inert process-local placeholders for the three required values absent from the local environment. The post-header attempt to rerun the entire suite was interrupted by the command-approval service before results were produced; the changed header boundary is covered by the post-change focused tests and production build.

## 20. Historical release assessment (2026-09-16T04:33Z; superseded)

> This section preserves the pre-remediation browser snapshot for audit history. It is not the current standing. See sections 17–19 and 22 for the reconciled status after the final production verification.

A broad browser acceptance pass was executed. Cookie-attribute evidence is now captured; admin state-denial tests are complete; realtor refresh and admin refresh/tab-navigation are verified. The result remains **PARTIAL**, with two confirmed functional failures (D-002, D-003), admin logout UX-blocked (UX-001), and provider-dependent workflows still blocked.

The production hostname transition routing is functioning correctly for both anonymous and authenticated surfaces. Login, role-based navigation, session isolation, wrong-role denial, state-specific admin denial, and post-logout protection work as designed across all tested roles.

**What was completed this session (2026-09-16T04:27–04:33Z):**

- **B3 notary→admin isolation:** While notary authenticated (2 cookies), navigated to `admin.veradoc.pe/` → login page, 0 cookies. PASS.
- **B3 notary→demo isolation:** While notary authenticated, navigated to `demo.veradoc.pe/` → "Modo demostración", 0 cookies. PASS.
- **B3 notary session persistence:** Notary session survived visiting admin and demo — returned to dashboard with 2 cookies. PASS.
- **B3 cookie attributes:** Confirmed via sanitized browser-context cookie inspection for app, notary, admin, and demo. Domain is the specific host on all authenticated surfaces; no parent-domain cookie present. SEC-001 finding: `Secure=false` (defense-in-depth, not release-blocking given HSTS).
- **B2-REALTOR-REFRESH:** Direct refresh of `/agente` preserved session (2 cookies, dashboard content). PASS.
- **B2-ADMIN-REFRESH:** Direct refresh of `admin.veradoc.pe/` preserved AAL2 session (2 cookies, no MFA re-prompt). PASS.
- **B2-ADMIN-NAV:** All 5 admin tabs (Resumen, Agentes, Invitaciones, Cobertura, Usuarios) exercised. In-page tab components, not `<Link>` routes — B2 two-client-link is structurally N/A. URL stays at `/`.
- **E-ADMIN-PENDING:** `qa-pending-realtor` on admin → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 admin cookies. PASS.
- **E-ADMIN-REJECTED:** `qa-rejected-realtor` on admin → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 admin cookies. PASS.
- **E-ADMIN-SUSPENDED:** `qa-suspended-realtor` on admin → `app.veradoc.pe/auth/login?error=wrong-surface`, 0 admin cookies. PASS.
- **E-ADMIN-NO-SESSION-SURVIVES:** After all 3 denial attempts, direct `admin.veradoc.pe/` → login page, 0 cookies. PASS.
- **B3-DEMO-NO-AUTH:** While admin session active, demo received 0 cookies. PASS.

**What was completed in prior sessions:**

- **B2:** Landlord, renter, and notary fully verified (login, ≥2 nav links, refresh, product-UI logout, post-logout denial). Realtor verified except D-003 FAIL on `/agente/nuevo-paquete`; refresh now PASS. Admin login + AAL2 verified; session invalidation works but via developer-tooling cookie clear (UX-001).
- **B3:** All app→notary/admin/demo and admin→app/notary/demo pairs verified in prior sessions.
- **B4:** 10/10 (no UTC timestamps — from prior session).
- **B5 at this historical checkpoint:** 5/6 states verified (no UTC timestamps — from prior session); superseded by sections 24 and 28.
- **C/D:** Dashboards render for all roles. D-002 and D-003 are confirmed FAILs.
- **E:** Cross-surface admin isolation 8/8 PASS.
- **F-DEMO-03:** 7/7 PASS.
- **G:** Routing patterns work (refresh, `<Link>`, back/forward, redirect query preservation, no loops, no prefix leakage). Two `<Link>` destinations are server-error FAILs.

**Open defects:**

1. **D-002 (Medium):** Fixed locally; pending deployment and browser retest of notary `/ganancias` with the commercial gate disabled.
2. **D-003 (Medium):** Fixed locally; pending deployment and browser retest of realtor `/agente/nuevo-paquete` against the legacy pricing schema.
3. **UX-001 (Low):** Admin missing logout button.
4. **UX-002 (Low):** Fixed locally; pending suspended-account login retest.
5. **SEC-001 (Low):** Fixed locally; pending cookie-attribute retest on all authenticated surfaces.
6. **A-MKT-03b (Low):** Fixed locally; pending canonical-tag inspection on all nine marketing routes.
7. **A-HDR-05 (Medium):** Host-specific same-origin overrides compiled for all six production hosts; pending live header retest after deployment.
8. **RSC-CORS (Low):** Fixed locally; pending admin console/network retest.

**Completion-condition summary: 4 PASS (#1, #5, #9, #12), 6 PARTIAL (#2, #3, #6, #10, #11, #13), 5 BLOCKED (#4, #7, #8, #14, #15).**

**Evidence-format gaps versus acceptance guide section 7:**

- B4 and B5 rows lack UTC timestamps (from prior session).
- Three early B3 rows say `(prior, no UTC)`.
- Browser profile labels, viewport, HTTP redirect status codes, and console/network summaries are absent from most rows.

**Next steps to close browser-testable gaps:**

1. **Deploy and retest D-002:** open notary `/ganancias` with `COMMERCIAL_ACCOUNTING_ENABLED=false`; confirm stable unavailable state and no server error.
2. **Deploy and retest D-003:** open realtor `/agente/nuevo-paquete`; confirm the wizard renders from legacy pricing without a server error.
3. **Admin UX-001:** implement logout button, then test product-level logout.
4. **Re-record B4 and B5** with UTC timestamps and full evidence standard (requires re-running the same 10+6 login scenarios with timestamped evidence capture).

**Next blocking question for provider-dependent phases:**

> Which provider-safe environment and synthetic packet/signing fixtures should be used for the state-changing customer and notary workflows?

## 21. Production remediation deployment and post-deploy retest — 2026-09-16T16:38–16:48Z

The seven-item remediation, including the follow-up `og:url` gap, was deployed to Vercel production as deployment `dpl_BS7UyHNMCkoP2dsNF1vuviWpq2rw` (`veradoc-9cyqiqupt-jonahs-projects-27d907e3.vercel.app`). Vercel inspection at `2026-09-16T16:40Z` reported the deployment `Ready` and confirmed that the same artifact serves `veradoc.pe`, `www.veradoc.pe`, `app.veradoc.pe`, `notario.veradoc.pe`, `admin.veradoc.pe`, `demo.veradoc.pe`, and both project aliases.

### 21a. Release gates

- Remediation-focused Vitest: **19/19 passed** across metadata, header configuration, suspended login, pricing fallback, cookie policy, and commercial-accounting gating.
- Complete Vitest: **253/253 passed** across 28 files.
- TypeScript: **passed** (`tsc --noEmit`).
- ESLint: **0 errors**, 7 unrelated pre-existing warnings.
- Next.js production build: **passed**; inert process-local placeholders were used only for the three required Supabase values absent from the local build environment.
- Generated static HTML: **9/9** marketing routes contained matching `<link rel="canonical">` and `<meta property="og:url">` values before deployment.

### 21b. Live browser and HTTP results

Browser: headless Microsoft Edge, default Playwright viewport (1280×720). Evidence window ended at `2026-09-16T16:48:00Z`.

| ID | Result | Production evidence |
| --- | --- | --- |
| A-MKT-03b | **PASS** | All 9 marketing routes returned HTTP 200 and exact route-specific `https://veradoc.pe/...` values for both canonical and `og:url`. |
| A-HDR-05 | **PASS** | Marketing, app login, notary login, admin login, and demo returned their own exact HTTPS origin as ACAO; none returned `*`. |
| RSC-CORS | **PASS** | Admin login rendered one normal signup anchor and emitted **0** speculative `/auth/signup` RSC requests during load plus a 3-second observation window. |
| SEC-001 | **PARTIAL PASS** | A real Google OAuth initiation produced one Supabase verifier cookie on `app.veradoc.pe`; it was `Secure=true`, host-scoped, and `SameSite=Lax`. The two password-session cookies still require an authenticated password-login retest on each applicable surface. |
| D-002 | **DEPLOYED; RETEST PENDING** | The production artifact includes the disabled-accounting unavailable-state path. No authorized notary browser session was available to execute `/ganancias` after deployment. |
| D-003 | **DEPLOYED; RETEST PENDING** | The production artifact includes the legacy pricing query. No authorized realtor browser session was available to execute `/agente/nuevo-paquete` after deployment. |
| UX-002 | **DEPLOYED; RETEST PENDING** | The production artifact includes suspended-session invalidation and the persistent inline `role="alert"`. No authorized suspended-account password credential was available for the live form retest. |

An attempted route to obtain production credentials for disposable synthetic authenticated users was rejected by the command-approval boundary because it would export the full production secret set. That control was not bypassed. No production users, business records, provider settings, Supabase configuration, DNS, or existing QA credentials were changed during the post-deploy verification.

### 21c. Remaining browser closure

> Historical checklist as of `2026-09-16T16:48Z`. All four checks below were subsequently executed; see section 22 for the final results.

Use the existing authorized QA browser sessions or credentials to run only these final checks against the already-uniform deployment:

1. Notary `/ganancias`: expect HTTP 200 and the accounting-unavailable state, with no server error.
2. Realtor `/agente/nuevo-paquete`: expect the wizard to render from legacy pricing, with no server error.
3. Password login on app, notary, and admin: confirm both resulting Supabase session cookies are `Secure=true`, host-scoped, and `SameSite=Lax`.
4. Suspended realtor login: expect the persistent suspended-account `role="alert"`, no dashboard navigation, and no surviving session cookies.

## 22. Seven-item production closure and D-003 credential follow-up — 2026-09-16T17:39–19:06Z

### 22a. Seven-item retest on deployment `dpl_BS7UyHNMCkoP2dsNF1vuviWpq2rw`

Browser and HTTP evidence collected from `2026-09-16T17:39:00Z` through `2026-09-16T17:54:15Z` produced six passes and one remaining failure:

| ID | Result | Production evidence |
| --- | --- | --- |
| D-002 | **PASS** | Authenticated `qa-active-notary` request to `/ganancias` returned HTTP 200, heading “Ganancias,” and the expected accounting-unavailable message. |
| D-003 | **FAIL** | Authenticated `qa-active-realtor` request to `/agente/nuevo-paquete` returned a server error with digest `2438399202`. |
| A-MKT-03b | **PASS** | All 9 marketing routes returned route-specific apex canonical and `og:url` values. |
| A-HDR-05 | **PASS** | Apex, `www`, app, notary, admin, and demo returned their own exact HTTPS origin as ACAO; no wildcard was observed. |
| RSC-CORS | **PASS** | Admin and notary signup controls rendered as normal anchors, with no speculative signup RSC prefetch. |
| SEC-001 | **PASS** | Both password-session cookie chunks were `Secure=true`, host-only, and `SameSite=Lax` on app, notary, and admin. |
| UX-002 | **PASS** | Suspended realtor login remained on `/auth/login`, displayed the persistent suspended-account `role="alert"`, and left no session cookies. |

### 22b. D-003 production investigation

The legacy pricing row and schema were valid: one active `lease_packet_standard` row existed with amount `8900`, currency `PEN`, and a non-empty description; the migration grants `service_role` access to `pricing_config`. The client wizard also accepted the legacy defaults.

Vercel and Supabase logs identified a deployment-configuration failure instead:

- `2026-09-16T17:42:48.129Z`: Vercel returned HTTP 500 for `/agente/nuevo-paquete` and logged the generic pricing exception with digest `2438399202`.
- `2026-09-16T17:42:48.538Z`: Supabase received `GET /rest/v1/pricing_config` and returned HTTP 401.
- Supabase gateway classification: `UNAUTHORIZED_INVALID_API_KEY`; both the `apikey` and `Authorization` credential checks were `invalid`.

The deployed `SUPABASE_SECRET_KEY` was therefore rejected by the linked Supabase project. The pricing service's generic exception had masked the underlying 401. The production key was corrected and Vercel was redeployed; no database migration or pricing-row mutation was required.

### 22c. Final verification on deployment `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2`

Vercel inspection confirmed that the replacement deployment was `Ready`, targeted production, and uniformly served apex, `www`, app, notary, admin, and demo. It was a Vercel `redeploy` of the prior CLI-uploaded artifact. Vercel retained Git metadata `351c343c1d2a09f85d79b21fb19a008cd9335247`; the remediation implementation tracked in this workspace is commit `64eac00cdf1f954053fef407f7460cead506d175`.

At `2026-09-16T19:05:35Z`, a clean headless Chrome `152.0.7977.83` session performed an ordinary password login as `qa-active-realtor` and navigated to `https://app.veradoc.pe/agente/nuevo-paquete`:

- Main document returned HTTP 200.
- Heading rendered as “Crear paquete de arrendamiento.”
- The complete six-step wizard rendered at “Paso 1 de 6 · Cargar contrato.”
- No server-error page appeared.
- Both app auth-cookie chunks were host-scoped, `Secure=true`, and `SameSite=Lax`.
- Vercel recorded the related `/agente/nuevo-paquete` requests as HTTP 200 with no error or fatal log entries.
- Supabase recorded `GET /rest/v1/pricing_config` at `2026-09-16T19:05:36.052Z` as HTTP 200 with no gateway error code.

**Seven-item remediation result: 7 PASS, 0 FAIL.**

### 22d. Remaining acceptance work outside the seven-item remediation

1. Implement and test a visible admin logout control (UX-001).
2. Exercise the expired-but-refreshable session state with a controlled fixture.
3. Obtain provider-safe fixtures and authorization for the state-changing customer, signing, notary, privileged-mutation, webhook, and notification workflows.
4. Complete the notary packet-detail navigation check with an assigned synthetic packet.
5. Gate or remove the ungated payout-rate query and confirm the Supabase 400s stop, then complete rollback evidence in an approved production-like context. The notification-outbox cron 503 is closed in section 25; the payout gate and exact-window telemetry are subsequently closed in sections 26–27, leaving rollback outstanding.

## 23. Recommended next test sequence — 2026-09-16T20:21Z

The seven-item remediation is fully closed. The following sequence covers the remaining acceptance gaps in dependency order. Each package lists the setup required before testing can begin and the pass criteria that would close the item.

| Priority | Test package | Setup required | Pass criteria |
| --- | --- | --- | --- |
| 1 | **Admin logout (UX-001)** | Add a visible logout control; use the AAL2 QA admin | Logout clears both auth-cookie chunks, redirects to login, and back/refresh cannot reopen admin content |
| ~~2~~ | ~~**Expired-session behavior**~~ | ~~Controlled expired access token with a still-valid refresh token~~ | **DONE** — two naturally expired production sessions passed; see section 28 |
| 3 | **Notary packet-detail navigation** | **SETUP COMPLETE** — synthetic packet assigned to `qa-active-notary` without provider actions | **RUN — FAIL**: refresh emits D-004 in 2/2 clean contexts; other scoped checks pass (section 29) |
| ~~4~~ | ~~**Re-record B4/B5 evidence**~~ | ~~Clean browser contexts and the existing QA account matrix~~ | **DONE** — section 24a–d; UTC timestamps, viewport, cookies, console captured |
| 5 | **Provider-safe workflows** | Staging/preview or production-safe provider sandboxes, synthetic packets, safe OTP/message sinks | Complete customer, signing, invitation, payment, and certification workflows without real-world side effects |
| 6 | **Operations gates** | Cron configuration defect closed (section 25); payout gate and exact-window Supabase telemetry closed (sections 26–27); approved rollback environment/operator still required | Complete the rollback exercise |

### 23a. Package details

**Priority 1 — Admin logout (UX-001).** This is the only remaining functional defect. The admin dashboard currently has no visible logout control; the QA workaround was manual cookie deletion via DevTools. Implementation adds a logout button or menu item to the admin layout. The test authenticates `qa-active-admin` through password + TOTP, exercises the new logout control, and then verifies: (a) both `sb-…-auth-token` chunks are absent from `cookieStore.getAll()`; (b) the browser lands on `/auth/login`; (c) back-button and direct `/` refresh both resolve to the login page with zero auth cookies. This is the only item that requires a code change before testing.

**Priority 2 — Expired-session behavior (complete).** Section 28 records two independently authenticated, server-issued sessions that were retained in process memory without mutation until their signed access tokens expired naturally. Both refreshed transparently on `app.veradoc.pe`, rotated access and refresh tokens, preserved identity and role enforcement, retained `Secure=true` / host-only / `SameSite=Lax` cookies, and produced no redirect loop. Exact-window authenticated Supabase telemetry corroborated two successful token POSTs and zero token 4xx/5xx.

**Priority 3 — Notary packet-detail navigation (executed; failed refresh criterion).** Section 29 records the single synthetic production packet assigned to `qa-active-notary`, the zero-side-effect database proof, two independent authenticated notary contexts, one wrong-role realtor context, and exact-window Supabase telemetry. Initial detail rendering, back/forward, clean paths, and wrong-role denial pass. Direct refresh returns HTTP 200 and remains visibly rendered but emits React hydration error #418 in both clean notary contexts, so this package remains open as D-004.

**Priority 4 — Re-record B4/B5 evidence (complete).** Section 24a–d records the 10/10 B4 matrix, the first five B5 states, the older B3 rows, and the security-relevant admin post-logout direct-navigation check with UTC timestamps, viewport, cookies, page content, and console observations. Section 28 subsequently closes the expired-but-refreshable sixth B5 state.

**Priority 5 — Provider-safe workflows.** This is the largest remaining package and the only one that exercises real business flows end-to-end. It requires: a staging/preview environment or production-safe provider sandboxes for FirmEasy (signing), Supabase (OTP/email), payment gateway, and messaging; synthetic packets with documents uploaded to a safe storage bucket; and safe OTP/message sinks that do not reach real recipients. Pass criteria cover the full customer lifecycle (signup → packet creation → signing entry → OTP → identity → consent → review → signature → completion), exclusive-notary certification, and payment success/failure/pending redirects — all without real-world side effects.

**Priority 6 — Operations gates.** The production cron secret was configured and deployment `dpl_8oGzv9X6LeSqXpFUbSsgwvuiiZMi` was verified with seven consecutive scheduled HTTP 200 responses and zero current-deployment cron 503s. The commercial payout-rate query was subsequently gated and exact-window Supabase telemetry confirmed zero requests and zero associated 400s (sections 26–27). The only remaining operations gate is for an approved rollback operator to exercise `HOST_ROUTING_MODE=off` in a production-like environment and record the time to full service restoration.

### 23b. Blocking dependencies

- **Priority 1** blocks on implementation (code change), not on external setup.
- **Priority 2 is closed. Priority 3** no longer blocks on fixture creation; it now blocks on diagnosing and remediating D-004, then rerunning the refresh check. Priority 4 is complete.
- **Priority 5** blocks on provider-safe environment authorization — the question first raised in section 20 remains open:

> Which provider-safe environment and synthetic packet/signing fixtures should be used for the state-changing customer and notary workflows?

- **Priority 6** now blocks only on an approved production-like rollback environment and operator. The cron and payout-rate operational errors are closed, including the exact-window Supabase verification.

## 24. Evidence re-capture and telemetry review — 2026-09-16T20:30–20:57Z

Browser: Cursor IDE Chromium, viewport 1280×720 (`Emulation.setDeviceMetricsOverride` verified). Console hooks for `console.error`/`console.warn` reported **no entries** across all scenarios. Cookie state checked via `cookieStore.getAll()` (`Runtime.evaluate`). HTTP redirect status codes for auth flows were client-side navigations (Next.js router); intermediate 302/307 chains were not individually captured.

### 24a. B4 wrong-role login matrix — re-recorded with UTC timestamps (10/10 PASS)

All 10 cross-surface login attempts redirected to the user's correct canonical login page with `?error=wrong-surface`, 0 cookies on the destination, and the alert *"Esta cuenta pertenece a otro portal. Inicie sesión nuevamente aquí."*

| # | Account role | Wrong host | UTC | Final URL | `?error=wrong-surface` | Cookies | Page heading | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Notary | `app.veradoc.pe` | `2026-09-16T20:47:26Z` | `notario.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 2 | Notary | `admin.veradoc.pe` | `2026-09-16T20:48:41Z` | `notario.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 3 | Realtor | `notario.veradoc.pe` | `2026-09-16T20:49:41Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 4 | Realtor | `admin.veradoc.pe` | `2026-09-16T20:57:46Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 5 | Admin | `app.veradoc.pe` | `2026-09-16T20:51:45Z` | `admin.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 6 | Admin | `notario.veradoc.pe` | `2026-09-16T20:52:39Z` | `admin.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 7 | Landlord | `admin.veradoc.pe` | `2026-09-16T20:53:41Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 8 | Landlord | `notario.veradoc.pe` | `2026-09-16T20:54:42Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 9 | Renter | `admin.veradoc.pe` | `2026-09-16T20:55:47Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |
| 10 | Renter | `notario.veradoc.pe` | `2026-09-16T20:56:47Z` | `app.veradoc.pe/auth/login?error=wrong-surface` | Yes | 0 | Iniciar sesión | PASS |

This closes the B4 evidence-format gap. The prior section 11 results are confirmed and superseded by the timestamped evidence above.

### 24b. Historical B5 account-state re-record — 5/5 PASS (superseded by section 28)

Each scenario started with cookies cleared on `app.veradoc.pe`, then a fresh login at `https://app.veradoc.pe/auth/login`.

| # | Account state | UTC | Start → Final URL | Cookies | Visible content | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Pending approval (`qa-pending-realtor`) | `2026-09-16T20:32:03Z` | `/auth/login` → `/auth/pending-approval` | 2 | "Cuenta pendiente de aprobación" | PASS |
| 2 | Rejected (`qa-rejected-realtor`) | `2026-09-16T20:33:09Z` | `/auth/login` → `/auth/rejected` | 2 | "Solicitud no aprobada" | PASS |
| 3 | Suspended (`qa-suspended-realtor`) | `2026-09-16T20:34:34Z` | `/auth/login` → `/auth/login` (stays) | 0 | `role="alert"`: "Esta cuenta está suspendida. Comuníquese con soporte para solicitar una revisión." | PASS |
| 4 | Missing role / no profile (`qa-missing-role`) | `2026-09-16T20:35:48Z` | `/auth/login` → `/auth/pending-approval` | 1 | "Cuenta pendiente de aprobación" (treated as pending) | PASS |
| 5 | Invalid session (garbage cookie) | `2026-09-16T20:36:20Z` | `/agente` → `/auth/login?next=%2Fagente` | 1 (invalid) | "Iniciar sesión"; `next=` preserved | PASS |
| 6 | Expired but refreshable | — | — | — | — | NOT RUN (requires controlled expired-token fixture) |

**Notes:**
- State 4 (missing-role) produced 1 unsplit cookie name (`sb-…-auth-token`) rather than the 2-chunk pattern seen with other accounts. This is cosmetic — the user lands on the correct pending-approval gate.
- State 5 retains the garbage `.0` cookie value until explicitly cleared; the session is not valid and the protected route correctly rejects it.

This closed the B5 evidence-format gap for states 1–5 at that checkpoint. Section 28 subsequently executes and closes state 6 with a controlled naturally expired-token fixture.

### 24c. B3 cross-host isolation — re-recorded with UTC timestamps (4/4 PASS)

Login as `qa-active-realtor` on `app.veradoc.pe` at `~2026-09-16T20:37:35Z` (2 cookies), then cross-host visits:

| Test | UTC | Start → Final URL | Cookies on visited host | Visible content | Status |
| --- | --- | --- | --- | --- | --- |
| B3-APP-TO-NOTARY | `2026-09-16T20:38:32Z` | `notario.veradoc.pe/` → `notario.veradoc.pe/auth/login?next=%2F` | 0 | "Iniciar sesión" | PASS |
| B3-APP-TO-ADMIN | `2026-09-16T20:39:17Z` | `admin.veradoc.pe/` → `admin.veradoc.pe/auth/login?next=%2F` | 0 | "Iniciar sesión" | PASS |
| B3-APP-TO-DEMO | `2026-09-16T20:39:44Z` | `demo.veradoc.pe/` → `demo.veradoc.pe/` | 0 | "Modo demostración" | PASS |
| B3-APP-SESSION-PERSIST | `2026-09-16T20:40:14Z` | `app.veradoc.pe/agente` → `app.veradoc.pe/agente` | 2 | "Panel del agente inmobiliario" | PASS |

This closes the three `(prior, no UTC)` B3 rows from section 10.

### 24d. E-ADMIN-BACKBUTTON — re-recorded (direct navigation PASS; history.back N/A in shared tab)

Admin login + MFA completed at `~2026-09-16T20:41:45Z`. Cookies cleared at `2026-09-16T20:41:57Z`.

| Step | UTC | Action | Final URL | Cookies | Visible content | Status |
| --- | --- | --- | --- | --- | --- | --- |
| history.back() | `2026-09-16T20:42:14Z` | After cookie clear on admin `/` | `app.veradoc.pe/agente` | 2 (app realtor session) | "Panel del agente inmobiliario" | N/A — back navigated to prior cross-host history entry (shared tab from B3 tests), not an admin page |
| Direct `/` | `2026-09-16T20:44:45Z` | Navigate to `admin.veradoc.pe/` | `admin.veradoc.pe/auth/login?next=%2F` | 0 | "Iniciar sesión" | PASS |

The `history.back()` result is expected: the browser's back stack contained `app.veradoc.pe/agente` from the B3 test sequence in the same tab, so it navigated there (with the still-valid app realtor session). This is not a security issue — it confirms the app and admin sessions are independent. The prior session's `history.back()` result (redirect to admin login) was recorded in an admin-only tab history. The security-relevant check is the direct navigation (step 2): after clearing admin cookies, `admin.veradoc.pe/` redirects to login with 0 cookies. **PASS.**

### 24e. Historical H1 production telemetry review — PARTIAL (superseded by section 25 for current deployment status)

This subsection records the pre-fix state of deployment `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2`. Its recurring cron 503 finding is closed by the deployment and retest in section 25; the payout-rate finding remains open.

**Checks performed:** initial surface/log review `2026-09-16T20:30:00Z` – `2026-09-16T20:36:00Z`; status-filtered Vercel and Supabase follow-up through `2026-09-16T21:06:28Z`
**Deployment:** `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2` (Ready, all 6 aliases)

#### Surface health

| Surface | HTTP status | Response time |
| --- | --- | --- |
| `veradoc.pe/` | 200 | 417 ms |
| `www.veradoc.pe/` | 200 (via 307 → apex) | 554 ms |
| `app.veradoc.pe/auth/login` | 200 | 1076 ms |
| `notario.veradoc.pe/auth/login` | 200 | 428 ms |
| `admin.veradoc.pe/auth/login` | 200 | 402 ms |
| `demo.veradoc.pe/` | 200 | 359 ms |

Previously failing routes also healthy: `app.veradoc.pe/agente/nuevo-paquete` → 200 (login gate); `notario.veradoc.pe/ganancias` → 200 (login gate). No error pages, no redirect loops.

#### CORS consistency

| URL | ACAO |
| --- | --- |
| `veradoc.pe/precios` | `https://veradoc.pe` |
| `app.veradoc.pe/agente` | `https://app.veradoc.pe` |
| `notario.veradoc.pe/perfil` | `https://notario.veradoc.pe` |
| `admin.veradoc.pe/` | `https://admin.veradoc.pe` |
| `demo.veradoc.pe/agente` | `https://demo.veradoc.pe` |

OPTIONS preflight with foreign origin (`https://evil.example.com`) on `app.veradoc.pe/auth/login` returned `https://app.veradoc.pe` — does not reflect foreign origin. No wildcard `*` observed. Vercel logs show 0 CORS-related errors in the 24-hour window.

#### Vercel request logs (24-hour window)

| Status | Count | Assessment |
| --- | --- | --- |
| 401 | 0 | No auth-denial spike |
| 403 | 0 | No forbidden spike |
| 500 | 6 | **All on prior deployments** (`dpl_4jk9i…` and `dpl_BS7Uy…`); **0 on current** `dpl_BRjTz…` |
| 404 | 20 | Expected: demo/admin `/auth/callback` without params, demo `OPTIONS /agente`, crawler probes |
| 503 | At least 25 unique on the current deployment from `19:00:40Z` through `21:00:40Z` | All were the internal notification-outbox cron; one every five minutes |

The unfiltered 2,500-row sample reached its cap and contained only 200/304/307 responses; it therefore cannot support a claim of zero 4xx/5xx responses across the full 24-hour window. A separate status-filtered query found the recurring 503 responses above. The earlier `~1,000` figure was not a reliable unique count and is superseded by the directly verified current-deployment series.

No redirect loops were observed. Auth-gate redirects (`/agente`, `/perfil`, `/auth/callback`) behave as expected 307 → login. Domain distribution in the capped sample showed only known production hosts; the status-filtered results likewise showed no unknown-host traffic.

Auth callback behavior: bare `app.veradoc.pe/auth/callback` → 307 → login (expected without OAuth params). `admin.veradoc.pe/auth/callback` and `demo.veradoc.pe/auth/callback` → 404 (by design). No callback 500 errors.

#### Operational note (non-subdomain)

Deployment `dpl_BRjTzUEcarJzj4oKYKSziWaAeCH2` returned HTTP 503 for `GET /api/internal/notification-outbox/process` every five minutes throughout the verified `19:00:40Z`–`21:00:40Z` interval. The route returns 503 only when neither `CRON_SECRET` nor `OUTBOX_CRON_SECRET` is configured. At that checkpoint, a production environment-variable inventory confirmed that both names were absent, while `vercel.json` scheduled the route every five minutes. This was not a hostname-routing regression. It was subsequently corrected and successfully retested on the replacement deployment in section 25.

#### Supabase auth logs

The Supabase MCP flow did not authenticate, but the read-only Supabase Management API was available and was used without exposing identities, tokens, or request payloads.

For `2026-09-15T21:06:28Z` through `2026-09-16T21:06:28Z`, Supabase Auth recorded:

- 1,739 informational events and 1 warning.
- 198 login events, 55 logout events, 30 token-revocation events, 12 MFA challenges, 1 factor-in-progress event, and 1 factor-deletion event.
- The only Auth HTTP error was one `GET /authorize` response with status 400 at `2026-09-16T16:47:27Z`.
- No Supabase Auth 5xx events were present.

The Supabase API gateway also showed historical 401 responses from the invalid secret-key deployment described in section 22. After the corrected-key deployment (`2026-09-16T19:00:00Z` onward), three 4xx events remained:

| UTC | Request | Status | Assessment |
| --- | --- | --- | --- |
| `2026-09-16T20:31:35.687Z` | `GET /auth/v1/health` | 401 | Expected unauthenticated health probe; `UNAUTHORIZED_MISSING_API_KEY` |
| `2026-09-16T20:37:52.503Z` | `GET /rest/v1/notary_payout_rates` | 400 | Server-side Node query requested commercial payout-rate fields while the commercial schema is unavailable |
| `2026-09-16T20:37:53.700Z` | `GET /rest/v1/notary_payout_rates` | 400 | Repeat of the same server-side query |

The payout-rate error is swallowed by `getNotaryQueue`, so the dashboard degrades to a null participation percentage rather than returning a user-facing 500. It is nevertheless a real telemetry defect: the effective-date payout query is not gated when commercial accounting is disabled.

#### H1 verdict: **PARTIAL**

| What passes | What prevents full PASS |
| --- | --- |
| All 6 public surfaces healthy (200, sub-1.1s) | Notification-outbox cron returns 503 every five minutes because the production cron secret is absent |
| CORS consistent and same-origin, no wildcard | Two server-side payout-rate requests returned Supabase 400 because the commercial query is not gated |
| 0 current-deployment 500 responses | Vercel's unfiltered 24-hour view was capped at 2,500 rows; status-filtered queries are required for error counts |
| Supabase Auth reviewed: no auth 5xx events | At this historical checkpoint, the operational fixes had not yet been deployed or retested |
| No redirect loops; auth-gate redirects correct | |
| No unknown-host traffic observed | |
| No callback 500 errors | |

## 25. Current production acceptance retest — 2026-09-17T03:00–03:32Z

**Deployment:** `dpl_8oGzv9X6LeSqXpFUbSsgwvuiiZMi`

**Deployment status:** Ready, Production

**Evidence:** Cursor IDE Chromium authenticated browser testing, HTTP/header inspection, Vercel deployment inspection, and exact-window status-filtered request logs. Independent verification was performed after receipt of the retest report. No credentials, cookie values, authorization headers, or secret values were recorded.

### 25a. Deployment and surface health

Vercel inspection confirmed that the current deployment serves all six production aliases: apex, `www`, app, notary, admin, and demo. Each intended landing/login surface returned a successful final HTTP 200 response, with the expected `www` → apex and unauthenticated app/notary/admin login redirects. No server-error page or redirect loop was observed.

The `www` redirect hop returned HTTP 307 with `Access-Control-Allow-Origin: https://www.veradoc.pe`; the final apex response returned `Access-Control-Allow-Origin: https://veradoc.pe`. App, notary, admin, and demo returned their own exact origins. An OPTIONS preflight using foreign origin `https://evil.example.com` returned the app origin rather than reflecting the foreign origin. No wildcard ACAO was observed.

All nine marketing routes returned HTTP 200 with matching route-specific canonical and `og:url` values under `https://veradoc.pe`.

### 25b. Seven-item regression — 7/7 PASS

| ID | Result | UTC evidence | Verified behavior |
| --- | --- | --- | --- |
| D-002 | **PASS** | `2026-09-17T03:23:56Z` browser; corroborating HTTP 200 requests from `03:23:15Z` onward | Authenticated notary `/ganancias` rendered the heading and stable accounting-unavailable state without a server error |
| D-003 | **PASS** | `2026-09-17T03:25:08Z` browser; corroborating HTTP 200 requests at `03:24:47Z` and `03:25:06–07Z` | Authenticated realtor `/agente/nuevo-paquete` rendered the six-step wizard (`Paso 1 de 6 · Cargar contrato`) |
| A-MKT-03b | **PASS** | `2026-09-17T03:22:46–03:22:49Z` | 9/9 marketing routes published correct canonical and `og:url` metadata |
| A-HDR-05 | **PASS** | `2026-09-17T03:22:18–03:22:22Z`; independently rechecked | Exact per-surface ACAO on all six surfaces and the `www` redirect hop; foreign origin not reflected |
| RSC-CORS | **PASS** | `2026-09-17T03:22:49Z` | Admin and notary signup controls produced no speculative signup RSC requests; implementation remains a plain `<a>` |
| SEC-001 | **PASS** | App `03:27:11Z`; notary `03:26:43Z`; admin post-MFA `03:30:05Z` | Both Supabase auth-cookie chunks were `Secure=true`, host-only, and `SameSite=Lax` on all three authenticated surfaces |
| UX-002 | **PASS** | `2026-09-17T03:31:42Z` | Suspended realtor remained on login with a persistent `role="alert"`, no dashboard navigation, and zero session cookies |

The browser inspection also recorded `HttpOnly=false` for the Supabase browser-managed auth cookies. That observation does not reopen SEC-001, whose acceptance scope is the `Secure` flag plus host-only/SameSite behavior; it remains relevant to the application's broader XSS threat model.

### 25c. Notification-outbox cron regression — CLOSED

The production `CRON_SECRET` was configured and the prior known-good artifact was redeployed uniformly. Seven consecutive scheduled requests were independently found on the current deployment:

| UTC | Method | Path | Status |
| --- | --- | --- | --- |
| `2026-09-17T03:00:40.307Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:05:40.366Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:10:40.314Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:15:40.265Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:20:40.205Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:25:40.132Z` | GET | `/api/internal/notification-outbox/process` | 200 |
| `2026-09-17T03:30:40.092Z` | GET | `/api/internal/notification-outbox/process` | 200 |

Exact-window status-filtered logs contained zero 503 responses and no `CRON_SECRET not configured` error. Two deliberate unauthenticated apex probes returned the expected 401 at `03:01:19.767Z` and `03:23:06.915Z`. This conclusively closes the missing-secret/recurring-503 defect. It proves scheduler authentication and successful Route Handler execution; downstream provider delivery remains part of the separately blocked provider-workflow package.

### 25d. Corrected exact-window telemetry

The submitted retest summary reported five 4xx responses. Independent status-filtered verification for the stated `03:00–03:32Z` window found four:

| UTC | Host/path | Status | Assessment |
| --- | --- | --- | --- |
| `2026-09-17T03:01:19.767Z` | `veradoc.pe/api/internal/notification-outbox/process` | 401 | Expected unauthenticated cron probe |
| `2026-09-17T03:18:38.047Z` | Current deployment URL `/` | 404 | Unattributed direct deployment-URL probe; no functional surface impact |
| `2026-09-17T03:18:38.630Z` | Current deployment URL `/` | 404 | Unattributed direct deployment-URL probe; no functional surface impact |
| `2026-09-17T03:23:06.915Z` | `veradoc.pe/api/internal/notification-outbox/process` | 401 | Expected unauthenticated cron probe |

The non-apex cron-path 404 cited in the submitted report occurred at `2026-09-17T02:59:00.052Z`, immediately before the stated test window, and is therefore excluded from the exact-window count. The available request records do not establish that the two deployment-URL root probes were scanner traffic, so they are recorded as unattributed. Exact-window current-deployment 5xx count was zero.

No CORS failure, auth-callback failure, redirect-loop signature, or unknown production-host traffic was found in the reviewed evidence. Absence claims are bounded to the queried acceptance window and Vercel retention/query limits.

### 25e. Updated verdict and remaining operations gap

| Scope | Result |
| --- | --- |
| Current deployment Ready on all six aliases | **PASS** |
| Seven-item production regression | **7/7 PASS** |
| Notification-outbox missing-secret/503 regression | **CLOSED** |
| Current-deployment 5xx during acceptance window | **0** |
| Exact-window cron 503 | **0** |
| H1 overall | **PARTIAL** — the cron blocker is closed, but the ungated `notary_payout_rates` query that previously produced two Supabase 400 responses remains unremediated and un-retested |
| Overall completion standing | **5 PASS, 6 PARTIAL, 4 BLOCKED** — unchanged because condition #14 remains PARTIAL until the payout-rate telemetry defect is closed |

The production acceptance retest itself is **18/18 PASS**. This does not change the full transition to complete: admin logout, the expired-refreshable fixture, notary packet-detail fixture, provider-safe state-changing workflows, the payout-rate query, and the rollback exercise remain outstanding as documented in sections 17, 18, and 23.

## 26. Focused admin-logout and payout-gate production closure — 2026-09-17T05:53–05:56Z

This section supersedes the UX-001 and payout-query status statements in sections 22d, 23, and 25e. Historical observations in those sections remain valid for the deployments and times recorded there.

### 26a. Artifact and execution-environment verification

| Field | Verified result |
| --- | --- |
| Commit | `3a2203affc7ef4a2809fd69304d43e7bebb47b7c` — `fix: close admin logout and payout telemetry gaps` |
| GitHub branch | `codex/build-out-demo-parties`; remote branch resolves to the exact commit |
| Deployment | `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51` |
| Deployment target/status | Production / Ready |
| Deployment URL | `https://veradoc-1eyb8z3ar-jonahs-projects-27d907e3.vercel.app` |
| Vercel Git metadata | Exact commit `3a2203affc7ef4a2809fd69304d43e7bebb47b7c`, branch `codex/build-out-demo-parties` |
| Build log | Repository cloned at commit `3a2203a`; build completed in 38 seconds; deployment completed |
| Focused unit tests | 3 files passed; 9/9 tests passed |
| Acceptance browser | Standalone Google Chrome `chrome.exe`, headless shell, temporary user-data directory and dedicated process; not a Cursor renderer |
| Viewport | 1280 × 720 |
| Admin test window | `2026-09-17T05:55:35Z`–`05:56:07Z` |
| Notary payout-gate window | `2026-09-17T05:53:09Z`–`05:53:34Z` |

The focused browser run was isolated from the Cursor/Electron host after an earlier integrated-browser run reloaded the IDE and interrupted its agent. Full refresh and history operations in this section were executed only against the dedicated standalone Chrome process.

All six public aliases are attached to the deployment and currently reach a successful final response:

| Surface | Direct behavior | Final result |
| --- | --- | --- |
| `veradoc.pe` | No redirect | HTTP 200 at apex |
| `www.veradoc.pe` | One canonical redirect | HTTP 200 at `veradoc.pe` |
| `app.veradoc.pe` | One expected auth redirect | HTTP 200 at same-host `/auth/login` |
| `notario.veradoc.pe` | One expected auth redirect | HTTP 200 at same-host `/auth/login?next=%2F` |
| `admin.veradoc.pe` | One expected auth redirect | HTTP 200 at same-host `/auth/login?next=%2F` |
| `demo.veradoc.pe` | No redirect | HTTP 200 at demo root |

The distinction between the initial 307 and final 200 is intentional: protected roots redirect unauthenticated clients to their same-host login page.

### 26b. UX-001 admin logout — PASS and closed

The supplied authenticated browser evidence and independent deployed-code/artifact review establish all required criteria:

1. The admin dashboard displayed an enabled, keyboard-accessible `Cerrar sesión` submit button inside a Server Action form.
2. Submitting through the product UI exposed the pending label `Cerrando sesión...`.
3. Before logout, two sanitized Supabase auth-token cookie chunks were present.
4. Both cookies were host-only to `admin.veradoc.pe`, `Secure=true`, and `SameSite=Lax`.
5. After logout, zero Supabase auth cookies remained.
6. The browser remained on `admin.veradoc.pe` and landed at `/auth/login`.
7. The login page rendered and admin dashboard content was absent.
8. Back-button navigation resolved to the admin login gate with no admin content.
9. Direct navigation to `/` resolved to the admin login gate with no admin content.
10. Refresh remained on the login gate with no admin content.
11. The focused run observed zero console errors, zero warnings, zero 5xx responses, zero cross-host redirects, and no redirect loop.

The deployed Server Action calls the shared Supabase sign-out action and uses the relative `/auth/login` redirect, preserving the current admin host. UX-001 is therefore **PASS IN PRODUCTION** and no longer blocks B2 or E.

### 26c. Payout-rate query gate — implementation PASS; server-log confirmation pending (superseded by section 27)

The notary dashboard and `/historial` rendered successfully across the focused navigation and refresh sequence. The browser run observed zero failed requests, zero 5xx responses, zero payout-related console errors, and a stable `Estimado de pago: Sin términos` state.

The remediation itself is independently verified through the following deterministic chain:

- The exact deployed commit wraps the `notary_payout_rates` lookup in `isCommercialAccountingEnabled()`.
- The exact deployment contains no `COMMERCIAL_ACCOUNTING_ENABLED` key in either its captured build environment or runtime environment.
- The server environment parser defaults an absent boolean flag to `false`.
- The disabled-path unit test proves that the queue remains available, returns a null payout participation percentage, and does not call `adminClient.from("notary_payout_rates")`.
- Enabled-path and sanitized-error tests prove the query still works when deliberately enabled and that failures log only the provider error code.
- The complete focused suite passed 9/9 tests across the accounting gate, logout redirect, and logout-button files.

Browser interception alone cannot establish the absence of this query because `getNotaryQueue` performs it server-side. Likewise, the rendered `Sin términos` value confirms a null application result but does not by itself prove why the value is null. The deployed artifact, captured deployment configuration, default-false parser, and focused tests provide the evidence that the disabled production branch cannot execute the query.

At this checkpoint, exact-window Supabase query logs were not inspected because Supabase MCP authentication was unavailable. Section 27 subsequently closes this evidence gap through the authenticated read-only Supabase Management API. At the time of this section, the conclusions were:

- **Payout-query code/configuration remediation: PASS.**
- **Browser/runtime behavior: PASS.**
- **H1 exact-window database telemetry: PARTIAL** until a read-only Supabase log query confirms zero `notary_payout_rates` requests and zero associated 400 responses for `2026-09-17T05:53:09Z`–`05:53:34Z`.

### 26d. Updated closure and remaining work (superseded by section 27 for H1)

| Scope | Current result |
| --- | --- |
| UX-001 admin logout | **CLOSED — PASS IN PRODUCTION** |
| B2 login/logout/post-logout | **COMPLETE** |
| E admin access control | **COMPLETE** |
| Payout-query implementation | **CLOSED — PASS IN PRODUCTION** |
| H1 browser/runtime portion | **PASS** |
| H1 database-log portion | **PARTIAL — exact-window Supabase logs unavailable** |
| Production deployment | **ACCEPTABLE** |
| Completion-condition standing | **5 PASS, 6 PARTIAL, 4 BLOCKED** |

At this checkpoint, the remaining acceptance work was the expired-but-refreshable session fixture, notary packet-detail fixture, provider-safe state-changing workflows, the H1 exact-window Supabase log check, and the authorized production-like rollback exercise. Section 27 subsequently closes the H1 log check.

## 27. Authenticated exact-window Supabase telemetry closure — 2026-09-17T06:29:35Z–06:29:37Z

This section supersedes the H1 database-log `PARTIAL` statements and operations blockers in sections 22d, 23, 25e, and 26. Historical statements remain valid for the checkpoints at which they were recorded; the current tables in sections 17 and 18 have been reconciled to this result.

### 27a. Query method and evidence boundary

The new `scripts/h1-supabase-telemetry.mjs` acceptance harness queried the Supabase Management API's read-only unified Logs endpoint using an authenticated token with log access. The request and ClickHouse SQL were both bounded to the exact production browser window `2026-09-17T05:53:09.000Z`–`2026-09-17T05:53:34.000Z`, filtered to `source = 'edge_logs'`, and returned aggregate counters only. The query did not select event messages, headers, identities, cookies, authorization values, raw query strings, or request bodies.

| Field | Verified result |
| --- | --- |
| Test execution UTC | `2026-09-17T06:29:35.722Z`–`06:29:37.121Z` |
| Historical telemetry window | `2026-09-17T05:53:09.000Z`–`05:53:34.000Z` |
| Deployment under acceptance | `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51` |
| Supabase Logs API authentication | **PASS** — authenticated HTTP 200 response received |
| Retained edge-log coverage | **PASS** — 67 rows in the exact window |
| First retained event | `2026-09-17T05:53:12.378000Z` |
| Last retained event | `2026-09-17T05:53:31.682000Z` |
| `/rest/v1/notary_payout_rates` requests | **0** |
| Associated HTTP 400 responses | **0** |

The nonzero edge-log count proves that the exact-window result is supported by retained telemetry rather than an empty or unavailable log source. The zero payout-request count is stronger than merely observing zero 400 responses: the disabled production gate did not issue the database API request during the acceptance window.

### 27b. Puppeteer harness result and no-overclaim boundary

The same harness is designed to require two authenticated clean Chrome contexts before its combined end-to-end verdict can be `PASS`. For this execution, `H1_NOTARY_EMAIL` and `H1_NOTARY_PASSWORD` were not supplied, so both fresh browser contexts were not run and the harness correctly returned overall **BLOCKED** rather than claiming a combined pass.

This harness-level browser block does not reopen the browser/runtime result from section 26, which was independently captured with an authenticated standalone Chrome process against the same deployment and exact production window. It means only that this new automated execution cannot be cited as an additional authenticated browser rerun. The evidence boundaries are therefore:

- **New authenticated exact-window database telemetry: PASS.**
- **Previously established browser/runtime evidence from section 26: PASS.**
- **New harness's fresh authenticated browser rerun: BLOCKED — QA notary credential environment variables were unavailable; second clean context NOT RUN.**
- **Combined H1 acceptance, using the independent browser/runtime evidence plus the new database telemetry: PASS.**

The harness emits `PASS` only when required evidence is observed, `FAIL` for demonstrated contradictory behavior, and `PARTIAL` or `BLOCKED` when telemetry, authentication, retained coverage, Chrome, or another required source is unavailable. Its focused unit suite passed 5/5; syntax, focused lint, TypeScript, and diff-quality checks also passed.

### 27c. Updated current standing

| Scope | Current result |
| --- | --- |
| Payout-query code/configuration remediation | **PASS** |
| H1 browser/runtime portion | **PASS** — section 26 |
| H1 exact-window database-log portion | **PASS** — 67 retained edge events; 0 payout requests; 0 payout 400s |
| H1 overall | **COMPLETE — PASS** |
| Production deployment | **ACCEPTABLE** |
| Completion-condition standing | **6 PASS, 5 PARTIAL, 4 BLOCKED** |

The remaining acceptance work is now limited to the notary packet-detail fixture, provider-safe state-changing workflows, and the authorized production-like rollback exercise.

## 28. B5 expired-but-refreshable production closure — 2026-09-17T18:14:13Z–19:14:56Z

**Deployment:** `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51` (Ready / Production; independently re-inspected immediately before the run)

**Browser:** Standalone headless Chrome `152.0.7977.83`, 1280×720, dedicated process and new browser contexts

### 28a. Controlled fixture and verdict boundary

The test created two independent sessions through the ordinary production realtor login. Each server-issued cookie was held only in process memory, its signed access token was left unmodified, and the originating browser context was closed so browser-side proactive refresh could not occur. Production Supabase configuration reported a 3,600-second JWT lifetime. The harness waited until both JWT `exp` times plus a 15-second buffer, restored each session into its own new context, and navigated directly to `https://app.veradoc.pe/agente`.

No production account, database row, auth configuration, Vercel configuration, provider setting, or application data was changed. Credential, cookie, access-token, refresh-token, authorization-header, identity, event-message, and raw-query values were neither printed nor written.

### 28b. Two-context authentication evidence — PASS

| Evidence | Context 1 | Context 2 |
| --- | --- | --- |
| Fixture issued UTC | `2026-09-17T18:14:21.110Z` | `2026-09-17T18:14:25.744Z` |
| Original signed access-token expiry | `2026-09-17T19:14:19Z` | `2026-09-17T19:14:24Z` |
| Post-expiry request window | `19:14:39.574Z`–`19:14:45.521Z` | `19:14:48.526Z`–`19:14:52.269Z` |
| Protected route | `/agente`, HTTP 200, `Panel del agente inmobiliario` | `/agente`, HTTP 200, `Panel del agente inmobiliario` |
| Access token rotated | PASS | PASS |
| Refresh token rotated | PASS | PASS |
| New access-token expiry | `2026-09-17T20:14:42Z` | `2026-09-17T20:14:49Z` |
| User identity preserved | PASS | PASS |
| Auth `Set-Cookie` observed | PASS | PASS |
| Cookie chunks before → after | 2 → 2 | 2 → 2 |
| Cookie attributes | `Secure=true`, host-only `app.veradoc.pe`, `SameSite=Lax` | Same |
| Wrong-role route | `/arrendador` → 307 → `/agente` HTTP 200 | Same |
| Cross-host bounce / redirect loop | None / none | None / none |
| Page errors / HTTP 5xx | 0 / 0 | 0 / 0 |

Context 2 recorded two Chromium `net::ERR_ABORTED` GET cancellations for app routes while the test deliberately navigated through the wrong-role redirect. They were not failed main documents, produced no HTTP error response, and had no user-visible impact.

### 28c. Exact-window Supabase Auth telemetry — PASS

An authenticated read-only Supabase Management Logs API query aggregated only counters for `2026-09-17T19:14:39.000Z`–`19:14:56.500Z`. The window excludes the two password logins one hour earlier.

| Counter | Result |
| --- | --- |
| Retained edge-log rows | 44 |
| `POST /auth/v1/token` | 2 |
| Token HTTP 2xx | 2 |
| Token HTTP 4xx | 0 |
| Token HTTP 5xx | 0 |
| First / last retained event | `19:14:41.671Z` / `19:14:55.347Z` |

The two successful token POSTs corroborate the two independently observed token rotations. Nonzero retained coverage prevents an empty-log false pass.

### 28d. Harness false-negative reconciliation

The first automated verdict emitted `FAIL` even though every product requirement above passed. Two oracle defects caused that false negative:

1. The installed Puppeteer `BrowserContext.cookies(url)` call returned the whole context store rather than URL-applicable cookies. The two cookies it returned explicitly had the host-only domain `app.veradoc.pe`; this was a test-query error, not leakage to `admin.veradoc.pe`. The harness now uses CDP `Network.getCookies` for URL applicability.
2. The oracle treated all `net::ERR_ABORTED` cancellations as material failures. The two cancellations were caused by deliberate navigation/redirects and are now retained as observations but excluded from the failure count.

The original sanitized FAIL artifact is preserved with its complete failure fields (severity, exact reproduction, expected/actual, exact route and UTC, deployment ID, sanitized error, likely layer, second-context result, and next diagnostic). A colocated reassessment records the corrected oracle and exact-window telemetry. No product defect is opened from the false negative.

### 28e. Current B5 standing

| Scope | Result |
| --- | --- |
| Natural expired-token fixture | **PASS — 2/2 independent sessions** |
| Same-host refresh | **PASS** |
| Access + refresh token rotation | **PASS** |
| Cookie security and chunk preservation | **PASS** |
| Role enforcement after refresh | **PASS** |
| Redirect-loop check | **PASS** |
| Exact-window auth telemetry | **PASS — 2 token POSTs, 2 HTTP 2xx, 0 HTTP 4xx/5xx** |
| B5 account-state matrix | **COMPLETE — 6/6 PASS** |

This closes the expired-but-refreshable package. The transition remains **PARTIAL** for the notary packet-detail fixture, provider-safe state-changing workflows, and the authorized production-like rollback exercise.

## 29. Notary packet-detail production test — 2026-09-17T20:55:19Z–20:56:33Z

**Overall result: FAIL.** Required authentication and telemetry evidence was available. The initial detail render, clean public navigation, back/forward, and wrong-role denial passed. Direct refresh failed the zero-page-exception criterion because React hydration error #418 reproduced in both independent clean notary contexts. The visibly rendered HTTP 200 response does not override that failure.

### 29a. Test design and controlled fixture

The authorized fixture setup created exactly one `pending_notary` packet with the opaque test label `QA-D3-20260917-01` and exactly one assignment to the active `qa-active-notary` profile. The packet uses an unmistakably synthetic address, future synthetic lease dates, no uploaded document, and no signer identity. Setup used direct transactional database inserts into `lease_packets` and `notary_assignments`; it did not call application actions, assignment RPCs, signing providers, payment providers, notification services, or certification workflows.

Live trigger inspection found only packet-code generation and update-bookkeeping triggers on `lease_packets`, and no user trigger on `notary_assignments`. The fixture supplied its packet code explicitly, so packet-code generation was not invoked. Pre- and post-browser verification returned:

| Fixture evidence | Count |
| --- | ---: |
| Synthetic packets matching the fixture key | 1 |
| Assignments to the intended active QA notary | 1 |
| Documents | 0 |
| Signers / signing-token relationships | 0 |
| Payments | 0 |
| Notification-outbox rows | 0 |
| Notary workflow jobs | 0 |
| Certifications | 0 |
| Registry entries | 0 |
| Audit mutations | 0 |

The browser oracle required all of the following:

1. Authenticate as `qa-active-notary` on the canonical notary host and verify `notary/active` trusted session metadata.
2. Find `QA-D3-20260917-01` in the queue and follow its visible `<Link>` to `/paquetes/[packet-id]`.
3. Verify the synthetic packet code, synthetic address, summary section, and empty-signer state render.
4. Hard-reload the detail URL and require HTTP 200, the same visible markers, and zero page exceptions.
5. Use browser Back to restore the queue and Forward to restore the detail page, without `/notario` prefix leakage.
6. In a separate clean context, submit active realtor credentials on the notary login, require the canonical wrong-surface denial, then request the packet detail directly and require the notary login gate, zero applicable notary auth cookies, and no packet content.
7. Require retained exact-window database telemetry and zero relevant REST HTTP errors.

### 29b. Release, browser, authentication, and telemetry evidence

| Field | Verified result |
| --- | --- |
| Deployment | `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51` |
| Deployment status | Ready / Production; all six aliases attached, independently re-inspected before the run |
| Browser | Standalone headless Chrome `152.0.7977.83` |
| Viewport | 1280 × 720 |
| Clean contexts | Two active-notary contexts plus one wrong-role realtor context |
| Correct-role authentication | PASS in 2/2 contexts; trusted metadata was `notary/active` |
| Notary cookies | Two Supabase cookie chunks in each correct-role context; host-only `notario.veradoc.pe`, `Secure=true`, `SameSite=Lax` |
| Wrong-role cookie result | Zero auth cookies applicable to the notary packet URL |
| Exact telemetry window | `2026-09-17T20:55:19.532Z`–`20:56:33.628Z` |
| Retained Supabase edge-log rows | 136 |
| `notary_assignments` REST requests | 16 |
| `lease_packets` REST requests | 4 |
| Relevant REST HTTP 4xx/5xx | 0 |
| First / last retained event | `20:55:22.480Z` / `20:55:47.273Z` |

The nonzero request counters corroborate the browser's authenticated queue/detail reads. The absence of REST errors does not convert the browser result to PASS because the observed failure is a client hydration exception after a successful HTTP 200 response.

### 29c. Scoped results

| Check | Result | Evidence |
| --- | --- | --- |
| Queue link to packet detail | **PASS — 2/2** | Visible fixture link; clean `/paquetes/[packet-id]` destination |
| Initial detail rendering | **PASS — 2/2** | Packet code, synthetic address, summary, and `Sin firmantes registrados.` rendered |
| Direct refresh | **FAIL — 2/2** | HTTP 200 and visible markers remained, but React hydration error #418 fired during `detail-refresh` |
| Browser Back | **PASS — 2/2** | Returned to `/`, `Panel del notario`, fixture link still visible |
| Browser Forward | **PASS — 2/2** | Returned to clean `/paquetes/[packet-id]` and restored fixture content |
| Internal-prefix leakage | **PASS — 2/2** | No settled public URL began with `/notario` |
| Material network failures / HTTP 5xx | **PASS — 0** | Only navigation-related `net::ERR_ABORTED` cancellations; no material failure and no 5xx |
| Wrong-role denial | **PASS — 1/1** | Realtor login was redirected to the app login with `error=wrong-surface`; direct notary detail request rendered the notary login gate, zero notary auth cookies, and no packet data |
| Provider and business side effects | **PASS — none observed** | Post-test database counts remained zero for notifications, payments, signing data, workflow jobs, certifications, registry entries, and audit mutations |

### 29d. Failure D-004

- **Severity:** Medium. The page remains visibly rendered and no protected data leak or server error was observed, but a deterministic hydration exception on direct refresh violates the required browser acceptance criterion and may leave client behavior unreliable.
- **Exact reproduction steps:** (1) Start a clean Chrome context. (2) Open `https://notario.veradoc.pe/auth/login`. (3) Authenticate with `qa-active-notary`. (4) Click `QA-D3-20260917-01` in the queue. (5) Confirm the clean `/paquetes/[packet-id]` detail. (6) perform a hard reload. (7) Observe the browser `pageerror` stream.
- **Expected versus actual:** Expected HTTP 200, correct synthetic detail content, and zero page exceptions. Actual HTTP 200 and correct visible content, followed by minified React hydration error #418 during the `detail-refresh` stage.
- **Exact route and UTC:** `https://notario.veradoc.pe/paquetes/[packet-id]`; context 1 `2026-09-17T20:55:19.911Z`–`20:55:31.991Z`; context 2 `2026-09-17T20:55:31.998Z`–`20:55:44.592Z`. A preceding diagnostic capture recorded the exception at `20:53:21.996Z` and `20:53:36.375Z` on the same route and stage.
- **Deployment ID:** `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51`.
- **Sanitized error or stack:** `Error: Minified React error #418` in the deployed Next.js/React client chunk; raw packet identifiers, credentials, cookies, and query strings are omitted.
- **Failing layer:** Client hydration of the notary evidence-review page after a full document load. Section 30 confirms that `formatDate` and `formatDateTime` call locale formatting without an explicit `timeZone`, so the UTC server and America/Bogota browser produce different initial text. Routing, authentication, RLS reads, and Supabase REST responses completed successfully.
- **Second clean context:** Yes. The same error reproduced in the second independently authenticated clean Chrome context. It also reproduced in the preceding two-context diagnostic run.
- **Recommended next action:** Make packet date/time rendering deterministic by choosing and applying the product-approved timezone explicitly (likely `America/Lima` for Peruvian business timestamps, with date-only lease fields handled so they cannot shift to the previous day). Add a server/client render test, then rerun this unchanged fixture test with two clean contexts and exact-window telemetry.

### 29e. Evidence boundary and current standing

The raw packet identifier, credentials, cookie values, and authentication tokens are excluded from the report and sanitized artifacts. The focused harness is `scripts/d3-notary-packet-detail.mjs`; its final artifact is `artifacts/d3-notary-packet-detail/evidence-2026-09-17T20-55-19-532Z.json`.

The fixture remains in place for the diagnostic rerun. No cleanup was performed because the user requested one synthetic assigned packet and the unresolved refresh failure requires a stable reproduction target. The full transition remains **PARTIAL**. D packet navigation remains **PARTIAL with D-004 root cause confirmed and remediation pending**; the focused packet-detail package is **FAIL**.

## 30. D-004 hydration root-cause diagnostic — 2026-09-17T21:58:59Z–21:59:18Z

**Diagnostic status: COMPLETE — root cause confirmed. No application code was changed.**

The diagnostic reused the authenticated synthetic packet and compared three reads of the same production route:

1. JavaScript-disabled Chrome, which exposes the server-rendered HTML without client hydration.
2. Normal Chrome using the host timezone `America/Bogota`.
3. Chrome forced to `UTC`, matching the Vercel server runtime timezone observed in the server HTML.

All three requests returned HTTP 200 and rendered the correct synthetic packet. Only the America/Bogota hydration emitted React error #418.

| Field | Server HTML, JavaScript disabled | Hydrated browser, `America/Bogota` | Hydrated browser, forced `UTC` |
| --- | --- | --- | --- |
| Lease start | `01 ene. 2099` | `31 dic. 2098` | `01 ene. 2099` |
| Lease end | `31 dic. 2099` | `30 dic. 2099` | `31 dic. 2099` |
| Submitted to notary | `17 set. 2026, 08:45 p. m.` | `17 set. 2026, 03:45 p. m.` | `17 set. 2026, 08:45 p. m.` |
| React hydration errors | N/A; JavaScript disabled | **1 × error #418** | **0** |
| Matches server fields exactly | Baseline | **No** | **Yes** |

This A/B result isolates the mismatch to timezone-dependent initial rendering:

- `EvidenceReviewClient` uses `new Date(iso).toLocaleDateString("es-PE", ...)` and `toLocaleString("es-PE", ...)` without specifying `timeZone`.
- The locale controls language and formatting conventions; it does not force the Peruvian timezone.
- PostgreSQL `date` values such as `2099-01-01` are parsed by `new Date("2099-01-01")` as UTC midnight. In a UTC-5 browser, they display as the previous calendar day.
- The submitted `timestamptz` value is formatted at 20:45 on the UTC server and 15:45 in the America/Bogota browser.
- React receives different server and client text during the initial hydration and throws #418. On client-side navigation there is no pre-existing server HTML to hydrate, explaining why the original `<Link>` navigation passed and hard refresh failed.
- Forcing the browser to UTC makes every compared field identical to the server HTML and eliminates the hydration error. This rules in timezone-dependent formatting as the cause for this fixture and rules out routing, authentication, RLS, Supabase REST errors, or the packet data itself.

### Local production-build boundary

The workspace HEAD exactly matches deployment commit `3a2203affc7ef4a2809fd69304d43e7bebb47b7c`, and an existing Next.js 16.2.6 production artifact was started locally with server timezone `UTC`. The authenticated route could not be exercised because the production server environment schema requires `SUPABASE_SECRET_KEY`, which is intentionally absent from the local environment. The server recorded the missing-variable Zod error before handling the route.

No production secrets were copied or displayed to bypass that boundary. A request to pull production Vercel environment secrets into a temporary local process was rejected as unnecessarily risky. The deployed-production comparison above directly observes the actual production server HTML and is stronger evidence for the live defect than a reconstructed local response.

### Required remediation verification

The appropriate timezone policy is a product decision, but the technical acceptance criteria are now precise:

- Date-only lease fields must render the same calendar date on server and client; they must not be shifted through an implicit UTC-midnight `Date` conversion.
- Business timestamps must use one explicit approved timezone on server and client, likely `America/Lima` for this Peruvian workflow.
- A production-mode server/client test must compare the formatted output under at least `UTC` and `America/Lima`/`America/Bogota` runtime timezones.
- The unchanged packet fixture must then pass hard refresh in two clean Chrome contexts with zero hydration errors and retained exact-window telemetry.

The diagnostic harness is `scripts/d3-hydration-diagnostic.mjs`; its sanitized artifact is `artifacts/d3-hydration-diagnostic/evidence-2026-09-17T21-58-59-863Z.json`.

## 31. D-004 deterministic date/time implementation — 2026-09-18T00:23Z–00:27:47Z

**Current result: PARTIAL — remediation is implemented and static/unit verification is clean, but production-mode authenticated browser closure is not yet available. Do not record D-004 as PASS.**

The implementation adopts two explicit data contracts for the notary packet-detail boundary:

- PostgreSQL calendar dates remain canonical `YYYY-MM-DD` values. They are validated without converting them to a local instant, then formatted in a fixed UTC calendar frame so `2099-01-01` cannot become `2098-12-31` in a UTC-5 browser.
- Actual timestamps are validated and normalized by the server action to ISO-8601 UTC instants, then rendered by the client with the explicit Peruvian business timezone `America/Lima`.

### 31a. Frontend and backend changes

| Layer | Implemented change |
| --- | --- |
| Shared contract | Added `lib/date-time.ts` with calendar-date validation, instant normalization, and deterministic `es-PE` formatters. |
| Backend boundary | `getPacketEvidenceReview` now normalizes packet, assignment, document, evidence, signature, audit, checklist, duplicate-range, and property-authority dates/timestamps before returning client data. The notary queue's returned timestamps use the same instant normalization. |
| Frontend detail | `EvidenceReviewClient` no longer calls locale date/time methods without `timeZone`; lease/duplicate dates use calendar formatting and all rendered instants use `America/Lima`. |
| Frontend checklist | Both production and demo checklist timestamps use the same explicit Peru formatter. |
| Regression tests | Added five focused tests covering canonical/invalid calendar dates, UTC instant normalization, host-timezone-independent calendar rendering, host-timezone-independent Peru timestamp rendering, and Peru-date rendering for instants. |

### 31b. Verification completed

| Check | Result |
| --- | --- |
| Focused date-contract test | **PASS — 5/5** |
| Full unit suite | **PASS — 33 files, 272/272 tests** |
| TypeScript `tsc --noEmit` | **PASS** |
| ESLint on all changed implementation/test files | **PASS** |
| Diff whitespace check | **PASS** |
| Next.js production compilation | **PASS** — optimized bundle compiled and TypeScript completed |
| Full production build/page-data collection | **BLOCKED** — local `SUPABASE_SECRET_KEY` is intentionally unavailable |
| Authenticated post-fix hard refresh, two clean contexts | **NOT RUN** — the fix is not deployed and the local authenticated production server cannot start without the missing server credential |
| Post-fix exact-window Supabase telemetry | **NOT AVAILABLE** — there was no post-fix authenticated browser window to query |

The timezone regression test compares output after changing the host timezone between UTC, America/Bogota, and Asia/Tokyo. The outputs remain identical for the same semantic value; the Peru timestamp case resolves `2026-09-17T20:45:00.000Z` to `03:45 p. m.` regardless of host timezone. This closes the deterministic formatter behavior at unit scope, not at deployed browser scope.

### 31c. Verification blocker V-004

- **Severity:** Release-verification blocker; not evidence of a new product regression. The changed application compiled successfully, but required authenticated production-mode hydration evidence could not be generated locally.
- **Exact reproduction steps:** (1) At workspace commit `3a2203affc7ef4a2809fd69304d43e7bebb47b7c` plus the uncommitted D-004 remediation, leave the intentionally absent `SUPABASE_SECRET_KEY` unset. (2) Run `npm run build`. (3) Observe successful optimized compilation and TypeScript, followed by failure during page-data collection.
- **Expected versus actual:** Expected a complete production build that can be started for the two-context packet hard-refresh test. Actual compilation and TypeScript passed, but page-data collection stopped because the server environment schema rejected the missing secret.
- **Exact route and UTC:** Local build-time collection for `/auth/mfa`, surfaced by Next.js as failure to collect configuration for `/auth/callback`; observed in the `2026-09-18T00:25Z`–`00:27:47Z` verification window. No authenticated application route was served.
- **Deployment ID:** No deployment ID applies to the un-deployed workspace fix. The last production baseline remains `dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51`, which contains the original D-004 behavior and was not used to claim post-fix success.
- **Sanitized error or stack:** Zod environment validation error at `path: ["SUPABASE_SECRET_KEY"]`, `expected string, received undefined`, while collecting Next.js page data. No secret value, credential, cookie, token, packet identifier, or query was present.
- **Likely failing layer:** Local production-build environment completeness, before route execution. The optimized frontend/backend bundle itself compiled successfully.
- **Second clean context:** Not applicable to the build-time blocker. The required two clean authenticated Chrome contexts were not run; this absence is why the result remains PARTIAL.
- **Recommended next diagnostic:** Deploy this exact scoped change through the normal reviewed pipeline, then rerun `scripts/d3-notary-packet-detail.mjs` against the unchanged synthetic fixture in two clean authenticated notary contexts. Require zero React #418/page errors on hard refresh and query retained exact-window telemetry before changing D-004 to PASS.

### 31d. Acceptance standing

D-004 remains **PARTIAL — implementation verified at unit/type/lint/compile scope; deployed browser and telemetry verification pending**. The existing production fixture remains suitable for the closure rerun. No notification, signing, payment, certification, registry, or workflow side effect was invoked by this implementation work.

## 32. First production remediation deployment and failed closure rerun — 2026-09-18T00:58:50Z–01:03:39Z

**Status: FAIL for the first production remediation; corrective follow-up pending. Do not record D-004 as closed.**

Commit `4281d53` was pushed to `main` and Vercel's Git integration built production deployment `dpl_6D5sbvJgWjNfCuWtBK78iNFsuwbN`. Vercel cloned branch `main` at that exact commit, compiled successfully, completed TypeScript, generated 46/46 static pages, deployed the output, marked it Ready, and attached all six canonical aliases. The build completed at `2026-09-18T00:59:47.813Z`.

The unchanged D3 fixture was then exercised in two independently authenticated clean notary contexts plus a separate wrong-role realtor context. Correct-role authentication, visible detail content, HTTP 200 refresh, Back, Forward, public-route cleanliness, zero HTTP 5xx, and wrong-role denial all succeeded. The closure still failed because React hydration error #418 occurred during hard refresh in both correct-role contexts.

### 32a. Failure D-005

- **Severity:** High for release acceptance. Production remained usable and no authorization failure or protected-data leak was observed, but the required deterministic hard-refresh criterion still failed after the first remediation.
- **Exact reproduction steps:** (1) Open a clean Chrome context. (2) Authenticate `qa-active-notary` on `https://notario.veradoc.pe/auth/login`. (3) click synthetic packet `QA-D3-20260917-01`. (4) Confirm the clean `/paquetes/[packet-id]` route and rendered packet. (5) Hard reload. (6) Observe the browser `pageerror` stream. (7) Repeat in a second independently authenticated clean context.
- **Expected versus actual:** Expected HTTP 200, unchanged correct content, and zero hydration/page errors. Actual HTTP 200 and correct visible content, but one minified React #418 hydration error occurred on refresh in each clean context.
- **Exact route and UTC:** `https://notario.veradoc.pe/paquetes/[packet-id]`; context 1 `2026-09-18T01:02:19.706Z`–`01:02:37.632Z`, with the page error at `01:02:32.684Z`; context 2 `01:02:37.641Z`–`01:02:50.365Z`, with the page error at `01:02:45.896Z`.
- **Deployment ID:** `dpl_6D5sbvJgWjNfCuWtBK78iNFsuwbN` (`Ready`, Production, commit `4281d53`).
- **Sanitized error or stack:** `Error: Minified React error #418` from deployed client chunk `_next/static/chunks/0gnraur0-1std.js`; the harness summarized `Material browser errors or internal notary-prefix leakage were observed.` Inspection confirmed no prefix leakage and no material request failure, leaving the page error as the failing check. Identifiers, credentials, cookies, and tokens are omitted.
- **Likely failing layer:** A remaining client hydration mismatch in the packet-detail render tree. Source audit found `DocumentHashTimeline` still formatting the packet creation/hash timestamp through the old host-timezone-dependent shared formatter. It also found a render-time `new Date()` initializer in the authority form component. Both sit outside the three summary fields corrected by commit `4281d53`.
- **Second clean context:** Yes. The same React #418 page error reproduced once in context 2. The separate wrong-role realtor context passed with zero applicable notary auth cookies, the login gate, no packet content, and zero page errors.
- **Recommended next diagnostic:** Route the hash-timeline timestamp through the explicit `America/Lima` formatter, initialize the authority-form clock only from the user event that opens the form, deploy, and rerun the same two-context harness before querying exact-window telemetry.

### 32b. Corrective follow-up implemented locally

The follow-up changes `DocumentHashTimeline` to use `formatPeruDateTime` and changes the SUNARP form's `checkedAt` initial state from a render-time clock value to an empty deterministic value populated only when the user opens the form. Focused ESLint, the 5/5 date-contract tests, TypeScript, and diff-quality checks pass. Production browser and telemetry status remains **PARTIAL pending redeployment and rerun**.

The failed-run sanitized artifact is `artifacts/d3-notary-packet-detail/evidence-2026-09-18T01-02-19-335Z.json`. The diagnostic comparison process was started afterward, but its monitoring connection was interrupted before a new result was returned; no PASS or diagnostic conclusion is claimed from that interrupted run.

## 33. D-004 corrective production closure — 2026-09-18T01:12:29Z–01:15:17Z

**Overall result: PASS.** This section supersedes the pending/failed D-004 standing in sections 29–32. Required production build, authentication, two-clean-context browser behavior, wrong-role denial, and exact-window telemetry evidence were all available.

### 33a. Git and Vercel production evidence

Corrective commit `914ae30` was pushed to both the working branch and `main`. Vercel's Git integration created production deployment `dpl_B7sZqboSJd79bAWDCdT7oY8eMVmD`, marked it Ready, and attached `veradoc.pe`, `www.veradoc.pe`, `app.veradoc.pe`, `notario.veradoc.pe`, `admin.veradoc.pe`, and `demo.veradoc.pe`.

The deployed correction routes the document-hash timeline timestamp through the explicit `America/Lima` formatter and removes the render-time clock initializer from the SUNARP form. Together with the first remediation's canonical calendar dates and normalized instants, the packet-detail render tree no longer emits different initial server/client text for the fixture.

### 33b. Final browser matrix

The harness ran in standalone Chrome `152.0.7977.83` from `2026-09-18T01:13:57.652Z` through `01:15:17.058Z`.

| Check | Context 1 | Context 2 | Result |
| --- | --- | --- | --- |
| Trusted authentication | 2 secure host-only Supabase cookie chunks; `notary/active` | Same | **PASS** |
| Queue link and initial detail | Synthetic fixture rendered at clean `/paquetes/[packet-id]` | Same | **PASS** |
| Hard refresh | HTTP 200; packet rendered; 0 page errors | HTTP 200; packet rendered; 0 page errors | **PASS** |
| Browser Back / Forward | Queue restored, then detail restored | Same | **PASS** |
| Internal `/notario` prefix leakage | None | None | **PASS** |
| Console errors | 0 | 0 | **PASS** |
| HTTP 5xx | 0 | 0 | **PASS** |
| Material request failures | 0 | 0 | **PASS** |

The independent wrong-role realtor context also passed: direct packet access ended at `https://notario.veradoc.pe/auth/login`, zero notary auth cookies applied, no packet content rendered, and there were zero page errors, HTTP 5xx responses, or material request failures.

### 33c. Exact-window authenticated telemetry

The Supabase Management Logs API returned authenticated HTTP 200 for an aggregate-only query bounded exactly to `2026-09-18T01:13:57.652Z`–`01:15:17.058Z`.

| Counter | Result |
| --- | ---: |
| Retained edge-log rows | 134 |
| `notary_assignments` REST requests | 16 |
| `lease_packets` REST requests | 4 |
| Relevant REST HTTP 4xx/5xx | 0 |
| First retained event | `2026-09-18T01:14:02.917Z` |
| Last retained event | `2026-09-18T01:14:30.415Z` |

Nonzero retained coverage and the expected packet/assignment reads corroborate the authenticated browser activity. No notification, signing, payment, certification, registry, or state-changing workflow action was invoked by the closure run.

### 33d. Final standing

- **D-004 hydration defect: CLOSED — PASS IN PRODUCTION.**
- **Notary packet-detail navigation package: COMPLETE — PASS.**
- Detail rendering, hard refresh, Back/Forward history, clean public routes, and wrong-role denial all pass with required authentication and telemetry evidence.
- The sanitized final artifact is `artifacts/d3-notary-packet-detail/evidence-2026-09-18T01-13-57-652Z.json`; secrets, raw packet identifiers, cookies, tokens, and query contents remain excluded from the committed report.

## 34. Provider-safe end-to-end workflow design and readiness run — 2026-09-18T04:23:40Z–04:27:12Z

**Package result: BLOCKED.** The test was designed and its safe/read-only preflight was executed. No provider-backed or state-changing workflow is marked PASS because the environment, callback, audit, and telemetry prerequisites needed to execute those workflows safely were not available. No product-code change was made.

### 34a. Current release and safe execution evidence

| Field | Verified result |
| --- | --- |
| Environment exercised | Production, read-only preflight only |
| Git commit | `8fcc16bffb902afc65b06eb66ded7a3ceb129feb` |
| Deployment | `dpl_czHsnN2pTCXCtVx8SrMd49cVM759` |
| Deployment status | Ready / Production |
| Vercel build provenance | `main` at commit `8fcc16b`; build compiled, typechecked, generated 46/46 static pages, and completed successfully |
| Attached aliases | Apex, `www`, app, notary, admin, demo, and project aliases |
| Surface probe UTC | `2026-09-18T04:23:40Z` |
| Surface probe result | Apex 200; `www` 307 to apex; app/notary/admin login 200; demo root 200 |
| Browser | Standalone Chrome `152.0.7977.83`, 1280×720, fresh browser context per role |
| Authenticated browser window | `2026-09-18T04:25:53.219Z`–`04:27:12.640Z` |
| Provider actions invoked | None |
| Production mutations invoked | None |

The read-only browser preflight reused the assigned synthetic notary packet from section 33. Two independently authenticated clean notary contexts each reached the clean `/paquetes/[packet-id]` route, rendered the synthetic fixture, survived hard refresh and Back/Forward, retained two secure host-only authentication-cookie chunks, and recorded zero console errors, page errors, HTTP 5xx responses, or material request failures. A separate clean realtor context was denied at the notary login gate with zero notary authentication cookies and no packet content.

This is **PASS for the current-deployment authentication/browser preflight only**. It is not a new packet-detail package closure because this run did not have authenticated exact-window Supabase telemetry. The prior complete closure, including telemetry, remains section 33. The sanitized current artifact is `artifacts/d3-notary-packet-detail/evidence-2026-09-18T04-25-53-219Z.json`.

### 34b. Provider-safety and fixture manifest

| Provider or fixture class | Observed state | Workflow effect |
| --- | --- | --- |
| MercadoPago | Production credentials/mode variables exist; the acceptance guide identifies production payments as unsafe | Payment submission, refund, and success/failure/pending callback tests BLOCKED |
| FirmEasy/signing | Configuration variable names exist, but encrypted values do not prove `sandbox` mode or a safe tenant | Signature submission, provider callback, and replay tests BLOCKED |
| Email | Production variable name exists; no safe sink or captured-message interface declared | Magic-link, confirmation, recovery, and emailed signing-link tests BLOCKED |
| WhatsApp/SMS/OTP | No safe sink or provider-sandbox declaration available | OTP and message-delivery tests BLOCKED |
| Storage | Production Supabase is configured; no isolated test bucket/namespace and cleanup authority declared | Customer upload/download lifecycle BLOCKED |
| Notarial sealing | No enabled safe stub/sandbox declaration available | Certification workflow BLOCKED |
| Tax issuance | No provider configuration is present in the production variable-name inventory; no safe stub owner declared | Any tax-document side effect BLOCKED |
| OAuth | No disposable provider identity, callback capture, or provider-safe tenant declared | Fresh OAuth callback BLOCKED |
| Telemetry | `SUPABASE_ACCESS_TOKEN` with `analytics_logs_read` is unavailable to this run | Exact-window database/auth/provider correlation BLOCKED |
| Audit visibility | No approved audit-log reader or synthetic mutation target supplied | Positive/negative privileged mutation proof BLOCKED |
| Authentication fixtures | Existing active QA roles are available and authorize authentication testing only | Read-only auth preflight available; no workflow mutation authority |
| Workflow artifacts | No fresh landlord/renter link, valid legacy link, expired/consumed token, independently assigned notary packet, demo token pair, or synthetic upload fixture supplied | Token/link/lifecycle cases BLOCKED |

The production environment-variable inventory was read by name only. No encrypted value, credential, cookie, token, code, query string, or personal datum was retrieved or recorded.

### 34c. Executable test design

Every case uses a unique opaque run label, one clean browser context per actor, sanitized route templates, and a UTC window opened before the first action. State-changing phases must run only after the chosen target and the relevant provider class are explicitly confirmed safe. Before/after database and provider snapshots must be aggregate or opaque-ID based, and cleanup must be limited to the named synthetic fixtures.

| ID | Workflow | Required fixtures and safe controls | PASS evidence |
| --- | --- | --- | --- |
| P-E2E-01 | Fresh copied and emailed links | Synthetic realtor packet, safe mail/message sink, captured link metadata | Generated landlord/renter links use the app origin; delivered links match; no raw token enters evidence |
| P-E2E-02 | Confirmation, recovery, magic-link, and OAuth callbacks | Disposable realtor, safe inbox, OAuth sandbox identity, exact callback allowlists | One-time callback establishes a host-scoped session on the intended host; replay is rejected; auth telemetry corroborates the exchange |
| P-E2E-03 | Fresh and legacy signing entry | Fresh landlord/renter links, still-valid apex legacy link, expired and consumed tokens | Fresh and legacy entry stay/canonicalize to app; expired/consumed/replayed tokens fail safely without account or state duplication |
| P-E2E-04 | Customer upload and signing lifecycle | Synthetic PDF visibly marked `SYNTHETIC TEST — NOT A REAL CONTRACT`, isolated storage namespace, safe OTP sink, FirmEasy sandbox/stub | Create packet → upload/download → OTP → account → identity → consent → review → sign → completion succeeds for both parties; refresh/resume/mobile behavior is stable; provider and audit telemetry agree |
| P-E2E-05 | Exclusive-notary certification | Independently assigned synthetic packets, certification stub/sandbox, audit reader | The assigned packet can be certified once; wrong-role, wrong-owner, wrong-state, and replay attempts are denied; audit event and final artifacts correlate |
| P-E2E-06 | Payment redirects | MercadoPago sandbox account/instrument and webhook capture | Success, failure, and pending returns stay on app; webhook signature/idempotency and payment state correlate; no real charge/refund occurs |
| P-E2E-07 | Negative privileged mutations | Harmless synthetic target for each action; clean anonymous, wrong-role, suspended, wrong-host, wrong-owner, wrong-state, demo, unapproved-Origin, and replay contexts | Every attempt fails without state change or cross-host redirect; denial/audit telemetry is present and sanitized |
| P-E2E-08 | Demo/production token separation | Valid demo token plus production-shaped synthetic token with no real packet | Production-shaped token fails on demo; demo token fails on production; neither invokes production tables, storage, providers, messages, or actions |
| P-E2E-09 | Provider API/webhook/action behavior | Provider sandbox credentials, callback endpoints, signed synthetic events, replayable event IDs, action fixtures | Valid events process once, duplicates are idempotent, invalid signatures/payloads fail, Server Actions authorize independently, and exact-window telemetry contains no raw secrets |
| P-E2E-10 | Cleanup and evidence reconciliation | Named fixture owner, safe cleanup authority, retained logs/audit | Synthetic records are removed or retained per policy; provider/database/audit counts reconcile; no unrelated record changed |

Execution order is fixed to limit blast radius: environment attestation → fixture snapshot → callback/link creation → customer lifecycle → notary lifecycle → payment redirects → negative matrix → token separation → webhook/action replay → exact-window telemetry → cleanup reconciliation. A failure stops only the affected provider phase; any possible real-world side effect stops the entire run.

### 34d. Results from this run

| ID | Status | Evidence and boundary |
| --- | --- | --- |
| P-PREFLIGHT-RELEASE | **PASS** | Current commit/deployment identity, Ready status, build provenance, aliases, and six surface responses verified read-only |
| P-PREFLIGHT-AUTH | **PASS** | Two clean authenticated notary contexts plus one clean wrong-role realtor context; scope is read-only authentication/navigation only |
| P-LOCAL-UNIT | **PASS** | 15 focused files, 170/170 tests passed: routing/method rejection, demo action rejection, FirmEasy HMAC/route/idempotency/client behavior, provider-mode parsing, privileged commercial-action gates, workflow hardening, download authorization, notary-seal state and scan validation |
| P-LOCAL-INTEGRATION | **BLOCKED** | 2 suites could not initialize because local Supabase at `127.0.0.1:54321` was unavailable; 46/46 tests skipped before execution |
| P-E2E-01–06 | **BLOCKED** | Provider-safe target, sinks, tokens, packet/upload fixtures, and mutation authorization unavailable |
| P-E2E-07 | **PARTIAL** | Local routing/action negative tests pass; real browser/provider-backed negative mutations were not run because no harmless target, safe environment, or audit evidence was available |
| P-E2E-08 | **BLOCKED** | No valid demo token and production-shaped synthetic token pair supplied |
| P-E2E-09 | **PARTIAL** | Local FirmEasy webhook/API/action contract tests pass; provider-backed callback execution, replay, and exact-window telemetry were not run |
| P-E2E-10 | **BLOCKED** | No state-changing fixture was authorized or created, so provider/database cleanup and audit reconciliation could not run |
| P-TELEMETRY | **BLOCKED** | No authenticated Supabase Logs API token/audit reader for this window; browser observations alone are insufficient |

No provider workflow, callback workflow, upload/signing lifecycle, payment redirect, certification, demo/production token-separation case, or provider-backed negative mutation is marked PASS.

### 34e. Blocker records

#### BLK-PROVIDER-ENV — BLOCKED

- **Severity:** Release-evidence blocker; no demonstrated product regression.
- **Exact reproduction steps:** (1) Inspect the current deployment and production environment-variable names without retrieving values. (2) Compare available evidence to the required provider-safety manifest. (3) Observe that no provider-safe staging origins, sandbox attestations, sink owners, isolated storage namespace, or named harmless mutation targets are available. (4) Stop before the first state-changing browser action.
- **Expected versus actual:** Expected an explicitly identified staging/preview target or per-provider sandbox/stub evidence with allowed synthetic actions. Actual evidence identifies production and encrypted configuration names only; it cannot prove that any side effect is safe.
- **Exact route and UTC:** Preflight covered `veradoc.pe/`, `app.veradoc.pe/auth/login`, `notario.veradoc.pe/auth/login`, `admin.veradoc.pe/auth/login`, and `demo.veradoc.pe/` at `2026-09-18T04:23:40Z`; no token-bearing or mutation route was invoked.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `Provider-safe target and provider-mode attestations unavailable; state-changing execution intentionally not started.`
- **Likely failing layer:** QA environment/provider configuration and authorization, not known product code.
- **Second clean context:** Not applicable to environment attestation. The separate authentication preflight did pass in two clean notary contexts, but does not satisfy provider safety.
- **Recommended next diagnostic:** Name the provider-safe staging/preview environment or explicitly select dedicated synthetic production data, then attest one provider class at a time and supply its safe sink/fixture before that phase runs.

#### BLK-LOCAL-SUPABASE — BLOCKED

- **Severity:** Test-infrastructure blocker; no demonstrated product regression.
- **Exact reproduction steps:** (1) From commit `8fcc16b`, leave `SUPABASE_TEST_URL` unset so the integration harness uses its documented local default. (2) Run `npm run test:integration`. (3) Observe fixture setup attempting `127.0.0.1:54321`. (4) Both suites stop in setup and all 46 tests are skipped.
- **Expected versus actual:** Expected a running disposable local Supabase instance with the repository migrations. Actual connection failed before any integration test body or mutation ran.
- **Exact route and UTC:** Local Supabase Auth setup endpoint at `127.0.0.1:54321`, observed at approximately `2026-09-18T04:25:26Z`; no public route was involved.
- **Deployment ID:** Not applicable to the local integration harness; production baseline is `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `TypeError: fetch failed; connect ECONNREFUSED 127.0.0.1:54321` during synthetic test-user creation. No credential or token value was logged.
- **Likely failing layer:** Local disposable Supabase test infrastructure.
- **Second clean context:** Both independent integration suites hit the same setup blocker; no test context executed.
- **Recommended next diagnostic:** Start a disposable local Supabase stack with the repository migrations, verify its health, then rerun `npm run test:integration`; do not point this harness at production.

#### BLK-TELEMETRY-AUDIT — BLOCKED

- **Severity:** Release-evidence blocker; absence of evidence, not a product failure.
- **Exact reproduction steps:** (1) Run the sanitized two-context browser preflight from `2026-09-18T04:25:53.219Z` to `04:27:12.640Z`. (2) Check approved local inputs for a read-only Supabase Management Logs credential or audit reader. (3) Observe that `SUPABASE_ACCESS_TOKEN` and an approved audit surface are unavailable. (4) Do not infer database/provider success from browser rendering.
- **Expected versus actual:** Expected an authenticated, exact-window aggregate query with retained log coverage plus audit evidence for any mutation. Actual browser authentication evidence is present, but no authenticated database/provider telemetry query can be executed for this window.
- **Exact route and UTC:** `https://notario.veradoc.pe/paquetes/[packet-id]`, `2026-09-18T04:25:53.219Z`–`04:27:12.640Z`.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `SUPABASE_ACCESS_TOKEN with analytics_logs_read and approved audit visibility unavailable.`
- **Likely failing layer:** QA observability access.
- **Second clean context:** Browser behavior reproduced successfully in the second clean context; telemetry remained unavailable for both.
- **Recommended next diagnostic:** Provide the approved read-only telemetry mechanism, then query only aggregate sanitized counters bounded to the exact future workflow window before assigning any end-to-end PASS.

### 34f. Completion-condition impact and next input

This run does not change the transition to complete. Completion condition 8 is removed from product scope. Conditions 3, 4, 7, 10, 11, 13, and 14 remain at most PARTIAL/BLOCKED for the provider-backed scope: fresh generated links and callbacks, fresh/legacy signing, exclusive-notary certification, demo side-effect isolation with real token separation, provider/API/action behavior, the full manual matrix, and correlated production telemetry are not proven end to end. Condition 15 remains BLOCKED on the separately authorized rollback exercise.

The next required input is the target environment decision from the one-question protocol: provider-safe staging/preview, or dedicated synthetic data in production. Selecting production would not by itself authorize provider calls, account/data creation, or mutations; each provider class and named synthetic phase would still require its own safety declaration and authorization.

### 34g. Sanitized decision ledger

| UTC | Decision | Effect |
| --- | --- | --- |
| `2026-09-18T04:59:15Z` | The release owner selected dedicated synthetic data in production as the target environment. | Production remains read-only until each provider class is confirmed safe and the named synthetic mutations are explicitly authorized. This decision does not authorize real messages, payments, signatures, certifications, tax actions, provider callbacks, account creation, or data mutation. |
| `2026-09-18T05:09:08Z` | The release owner explicitly authorized all setup and execution needed for synthetic production testing and confirmed that the product is pre-MVP with zero users. | Clearly labeled synthetic database/storage/browser mutations and cleanup became authorized. Real payment capture and any token/message delivery to an unproven sink remained safety-gated. |

## 35. Authorized synthetic-production provider workflow run — 2026-09-18T05:09:08Z–05:28:43Z

**Package result: PARTIAL, with three release-blocking findings.** This section supersedes section 34's statement that all state-changing workflows were unauthorized. The authorization was expanded, a provider-safe production run was performed, and all temporary fixtures were reconciled. No product code or external-provider configuration was changed.

### 35a. Release, authorization, and cleanup

| Field | Result |
| --- | --- |
| Git commit | `8fcc16bffb902afc65b06eb66ded7a3ceb129feb` |
| Deployment | `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`, Ready / Production |
| Browser | Chrome `152.0.7977.83`, a new browser context for every actor/check |
| Data class | Visibly labeled synthetic contracts, people, addresses, identifiers, phone numbers, and provider test recipients only |
| Temporary prerequisite | One active `LIMA` coverage row for `qa-active-notary`; inserted idempotently and removed at the end |
| External payments | None; no Mercado Pago request was sent |
| External signing/OTP | None; FirmEasy and WhatsApp sends were stopped before invocation |
| Cleanup query | `2026-09-18T05:29Z`: 0 temporary coverage rows, 0 run-created synthetic packets, 0 synthetic signing tokens, and 0 recent document objects |

Resend's documented provider-test recipients were selected for synthetic signer data. They were stored only in short-lived signing fixtures that were deleted; the external invitation send itself was not authorized by the execution safety gate and did not occur.

### 35b. Executed result matrix

| Workflow | Status | Current evidence |
| --- | --- | --- |
| Fresh production signing link | **PASS** | Anonymous `https://app.veradoc.pe/firma/[token]` returned 200 and rendered the unique synthetic property; no auth cookie or browser error |
| Copied link in second clean context | **PASS** | The same fresh link independently rendered the same fixture in a second clean context |
| Legacy apex signing link | **PASS** | Apex `/firma/[token]` returned 307 and settled at the identical app-host token path with the correct legacy fixture |
| Demo/production token separation | **PASS** | Production token failed on demo; known demo token failed on production; known demo token remained usable only on demo |
| Token side effects | **PASS** | Both production tokens remained `pending`, with no OTP verification or consumption; fixtures were deleted afterward |
| Invalid auth callback failure | **PASS** | App, notary, and legacy apex returned 307 to their local `auth/login?error=auth`; admin returned the intentional 404 because admin has no approved callback-based flow |
| Authenticated customer PDF upload | **FAIL — 2/2** | Active realtor authentication succeeded, then valid synthetic PDF upload failed with storage RLS in two independent contexts |
| Full customer upload/signing lifecycle | **BLOCKED** | The step-1 upload FAIL prevents packet creation through the product path; OTP delivery is also unsafe because the active provider logs the raw OTP |
| Fresh emailed signing links / FirmEasy | **BLOCKED** | Current encrypted configuration does not prove a FirmEasy sandbox, and the customer packet cannot be created through the UI |
| OAuth positive callback | **BLOCKED** | No disposable Google sandbox identity or captured one-time callback was available; only invalid-code failure behavior was exercised |
| Payment preparation/redirects | **BLOCKED with schema readiness FAIL** | Upload blocks the browser path; additionally, production lacks the commercial-payment RPC called before Mercado Pago |
| Notary certification | **BLOCKED** | No lifecycle-created, fully signed assigned packet exists because upload/signing cannot complete; no certification mutation or provider action was invoked |
| Negative privileged mutations | **PARTIAL** | Existing wrong-role browser denial and focused local action/RLS tests remain valid; new production mutation attempts were not made without a lifecycle-created harmless target and exact audit/log evidence |
| Provider webhooks/actions | **PARTIAL** | Focused local FirmEasy HMAC, normalization, replay/idempotency, and privileged-action tests pass; no provider-signed production webhook was sent |
| Exact-window telemetry | **PARTIAL** | Authenticated Supabase Management API database queries proved policy/function/fixture state and cleanup; exact-window Auth, Vercel function, email-provider, FirmEasy, and Mercado Pago event telemetry was not available |

The clean PASS artifact for the signing and separation checks is `artifacts/provider-signing-token-production/evidence-2026-09-18T05-28-25-423Z.json`. The customer upload failure artifact is `artifacts/provider-e2e-production/evidence-2026-09-18T05-17-02-865Z.json`. Token paths, raw token values, credentials, cookie values, and UUIDs are sanitized or omitted.

### 35c. Failure P-001 — authenticated realtor upload denied by storage RLS

- **Severity:** Critical / release-blocking. A customer cannot create the first contract packet through the production wizard.
- **Exact reproduction steps:** (1) Start a clean Chrome context. (2) authenticate `qa-active-realtor` at `https://app.veradoc.pe/auth/login`. (3) Open `/agente/nuevo-paquete`. (4) Select a valid PDF whose first page says `SYNTHETIC TEST - NOT A REAL CONTRACT`. (5) Observe the upload toast. (6) Repeat from a second independently authenticated clean context with a separately generated PDF.
- **Expected versus actual:** Expected the private `documents` upload to succeed and step 1 to show `Cargado`. Actual server action response was HTTP 200 but the UI returned `Error al subir: new row violates row-level security policy`; no storage object or packet row was created.
- **Exact route and UTC:** `https://app.veradoc.pe/agente/nuevo-paquete`; context 1 `2026-09-18T05:17:03.097Z`–`05:17:11.451Z`; context 2 `05:17:11.462Z`–`05:17:19.613Z`.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `uploadLeaseDocument -> Supabase Storage upload -> Error al subir: new row violates row-level security policy`. The browser recorded POST 200 and no page exception, HTTP 4xx/5xx, token, credential, or personal datum.
- **Likely failing layer:** Storage authorization/order-of-operations. The deployed `Realtor uploads to own packets` INSERT policy requires `user_owns_packet(packet-id)`, while `uploadLeaseDocument` uploads to `packets/{new-id}/lease_original.pdf` before `createLeasePacket` inserts the corresponding `lease_packets` row. The policy predicate therefore cannot be true for the intended first upload.
- **Second clean context:** Yes; identical failure in context 2.
- **Recommended next diagnostic:** Choose one atomic design: create an authorized draft packet before storage upload, or issue a narrowly scoped server-side/signed upload that binds the object path to the authenticated realtor and then compensates on failure. Add an integration test that proves the initial object and packet ownership transition, rollback/orphan cleanup, wrong-owner denial, and retry idempotency before retesting production.

### 35d. Failure P-002 — production OTP provider logs the raw OTP

- **Severity:** Critical security defect. Invoking production OTP delivery would place an authentication secret and recipient phone number in application logs.
- **Exact reproduction steps:** Safe source-level reproduction only: (1) inspect `sendOtpAction` in `lib/actions/signing.ts`; (2) follow its `getWhatsAppProvider().sendOtp(phone, otp)` call; (3) inspect `DevWhatsAppProvider.sendOtp` in `lib/services/whatsapp-service.ts`; (4) observe the raw interpolation at line 87. The live action was deliberately not invoked.
- **Expected versus actual:** Expected a production-safe WhatsApp provider or a safe sink that never logs raw OTPs. Actual provider selection returns the development provider, whose implementation executes `console.log` with both raw OTP and phone.
- **Exact route and UTC:** Affected route is `https://app.veradoc.pe/firma/[token]/verificar`; source/config review occurred during `2026-09-18T04:40Z`–`05:09Z`. No token-bearing route was opened beyond the safe landing page.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `sendOtpAction -> getWhatsAppProvider -> DevWhatsAppProvider.sendOtp -> console.log("[DEV WhatsApp] OTP [redacted] -> [phone-redacted]")`.
- **Likely failing layer:** Messaging-provider selection and secret-safe logging.
- **Second clean context:** Not run; repeating the live action would intentionally duplicate the secret exposure. The deterministic source path is present once for every invocation.
- **Recommended next diagnostic:** Replace the provider selection with an explicit environment-gated production/sandbox provider, remove all raw-OTP/phone logging, add log-capture assertions that forbid OTP/token values, configure an approved message sink, then run send/verify/replay/rate-limit cases with exact provider and audit telemetry.

### 35e. Failure P-003 — deployed payment schema lacks the RPC required by the application

- **Severity:** High / release-blocking for payment activation.
- **Exact reproduction steps:** (1) Inspect deployed PostgreSQL functions through the authenticated Supabase Management API. (2) confirm legacy `claim_payment_attempt` and `process_payment_success` exist. (3) query for `claim_commercial_payment_attempt` and `process_commercial_payment_success`. (4) inspect `preparePaymentAction` and `confirmPacketPayment`, which call those commercial functions unconditionally. (5) Observe that the commercial migration is intentionally unapplied in production.
- **Expected versus actual:** Expected the RPCs required by the deployed application bundle to exist before the payment UI can prepare an attempt. Actual production has neither commercial RPC; the application would return the PostgREST missing-function error before a Mercado Pago request.
- **Exact route and UTC:** Intended route `https://app.veradoc.pe/agente/nuevo-paquete`, payment step; schema/source comparison executed during `2026-09-18T04:35Z`–`05:09Z`. The live payment button was not reached because P-001 blocks step 1.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `preparePaymentAction -> admin.rpc("claim_commercial_payment_attempt") -> function absent from deployed schema`; `confirmPacketPayment -> admin.rpc("process_commercial_payment_success") -> function absent from deployed schema`.
- **Likely failing layer:** Application/database release compatibility and migration gate, before the external payment provider.
- **Second clean context:** The deployed-schema result is global and was rechecked through independent function inventory/source references; browser reproduction was not possible in either clean context because both stopped at P-001.
- **Recommended next diagnostic:** Resolve the commercial-accounting rollout decision, deploy the application and required migration as one compatible release, verify the RPC signatures from the deployed bundle, then use Mercado Pago test credentials/cards and a webhook capture to test approved/rejected/pending/idempotent outcomes without real funds.

### 35f. Historical/superseded — former blocker P-004

> Superseded on 2026-09-18. Notary invitations were removed from product scope, so this is not a current blocker or acceptance requirement. It is retained only as an accurate record of the earlier test boundary.

- **Severity:** Release-evidence blocker; no product failure is claimed.
- **Exact reproduction steps:** (1) Select the documented Resend provider test recipient. (2) prepare the ordinary admin invitation workflow using the dedicated QA admin and AAL2. (3) Before submission, observe that the action would create a Supabase Auth user and transmit a single-use invitation credential to an external provider-controlled address. (4) The execution safety gate rejects the action; stop without sending.
- **Expected versus actual:** Expected explicit authorization for that exact credential-bearing external send plus a mailbox/provider event sink able to return the message and delivery event. Actual broad production-test authorization was not accepted as sufficiently specific for the single-use token destination, and no readable sink exists.
- **Exact route and UTC:** Proposed `https://admin.veradoc.pe/` invitation tab and `https://notario.veradoc.pe/auth/callback?invitation=[token]`; stopped before route mutation at approximately `2026-09-18T05:19Z`.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `Execution rejected: single-use invitation link would be sent to an external test address while local admin TOTP material is used.` No invitation, Auth user, email, or token was created.
- **Likely failing layer:** Test authorization/evidence-sink boundary, not established product behavior.
- **Second clean context:** Not applicable; no first send was authorized.
- **Recommended next diagnostic:** Explicitly authorize one invitation to the named provider test address after accepting that the provider will receive the single-use token, and provide a safe inbox/event retrieval method. Then prove canonical notary-host callback, host-only session establishment, acceptance, replay denial, audit event, and cleanup.

### 35g. Blocker P-005 — notary certification, provider webhooks, and negative mutation matrix

- **Severity:** Release-evidence blocker; no certification/provider PASS can be claimed.
- **Exact reproduction steps:** (1) Run the customer wizard with a valid synthetic PDF. (2) Observe P-001 at step 1 in both contexts. (3) Inspect prerequisites for a fully signed assigned packet, safe FirmEasy callback, safe notary workflow, and exact audit/log readers. (4) Stop before fabricating a completed lifecycle or invoking a certification/provider mutation that would bypass the failed product path.
- **Expected versus actual:** Expected a product-created paid/signed synthetic packet, provider-safe signatures, an assigned QA notary, and correlated audit/provider telemetry. Actual lifecycle stops before packet creation; FirmEasy sandbox mode and external callback evidence are unproven; no complete packet exists.
- **Exact route and UTC:** Upstream route `https://app.veradoc.pe/agente/nuevo-paquete` at `2026-09-18T05:17:03.097Z`–`05:17:19.613Z`; downstream `https://notario.veradoc.pe/paquetes/[packet-id]` certification route was not invoked.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** `Blocked by P-001 storage RLS; no fully signed packet; provider sandbox/callback and exact mutation-audit evidence unavailable.`
- **Likely failing layer:** Upstream product upload plus QA/provider configuration and observability.
- **Second clean context:** Yes for the upstream blocker; P-001 reproduced in two clean contexts. Certification/provider mutation itself was not run.
- **Recommended next diagnostic:** Fix and deploy P-001 and P-002, activate only an attested FirmEasy sandbox/stub, complete a two-party synthetic packet, then run assigned-notary certification once and attempt wrong-notary, wrong-role, wrong-state, wrong-host, replay, and unsigned-webhook mutations while correlating database audit, function logs, and provider event IDs.

### 35h. Callback and telemetry details

Invalid-code callback probes ran at `2026-09-18T05:20:46.563Z`–`05:20:48.183Z`:

- app callback: 307 to `https://app.veradoc.pe/auth/login?error=auth`;
- historical notary callback with a synthetic invalid invitation value: 307 to `https://notario.veradoc.pe/auth/login?error=auth` (superseded; the retired parameter must now fail closed);
- legacy apex callback: 307 to `https://veradoc.pe/auth/login?error=auth`;
- admin callback: 404, matching the routing policy because admin currently permits password login and MFA only.

These are PASS only for the historical invalid-token failure routing that was observed. Current acceptance requires the retired invitation parameter to fail closed, while magic-link, confirmation, password-recovery, and OAuth exchange remain separate tests.

Database-side evidence was available through the authenticated Supabase Management API: deployed storage policies, function inventory, exact synthetic row counts, unchanged token status, and final cleanup were queried. Exact-window Auth logs, Vercel function logs, provider delivery events, webhook events, and provider action telemetry were not captured for this window. Therefore browser/database checks are reported at their observed scope only, and the overall provider workflow remains **PARTIAL**.

### 35i. Final disposition

- **PASS:** current release/surfaces, focused local suite (170/170), authenticated read-only preflight, invalid callback failure routing, fresh/copy/legacy signing entry, token non-consumption, demo/production token separation, and fixture cleanup.
- **FAIL:** initial authenticated realtor PDF upload (P-001); production OTP secret-safe provider behavior (P-002, source-proven); payment application/schema compatibility (P-003, deployed-schema proven).
- **BLOCKED/PARTIAL:** magic links, confirmation/recovery and positive OAuth, complete customer signing, notary certification, real provider redirects/callbacks/webhooks, new privileged-mutation matrix, and exact-window provider/auth telemetry.
- **No PASS is claimed** for any provider-backed action lacking authentication, provider, audit, or telemetry evidence.

## 36. Historical/superseded appendix — authorized notary invitation submission (2026-09-18T05:40:45Z–05:45:22Z)

> This appendix preserves a mutation that actually occurred and its cleanup evidence. The feature is retired, P-004A is closed by scope removal rather than by a delivery PASS, and none of this section is a current acceptance prerequisite.

**Result: PARTIAL.** The release owner explicitly authorized one Supabase notary invitation containing a single-use token to Resend's documented provider test recipient, using the dedicated QA admin and locally retained QA TOTP seed. The application submission and Supabase acceptance are proven. External provider delivery, message contents, link retrieval, and the positive callback are not proven and are not marked PASS.

### 36a. Executed evidence

| Check | Result |
| --- | --- |
| Recipient preflight | **PASS** — 0 matching Auth users and 0 invitation rows before the run |
| Admin password authentication | **PASS** — `admin/active`, two secure host-only cookie chunks |
| Admin MFA | **PASS** — challenge HTTP 200, verify HTTP 200, resulting JWT `aal2` |
| Privileged Server Action | **PASS at application boundary** — POST 200 and visible `Invitación enviada.` |
| Application invitation row | **PASS** — one `pending` notary invitation for `LIMA`, created `2026-09-18T05:45:22.740955Z`, expiring seven days later |
| Supabase Auth acceptance | **PASS** — one invited user; `invited_at` and `confirmation_sent_at` both `2026-09-18T05:45:22.790737Z` |
| Resend delivery | **PARTIAL / unverified** — no provider delivery event, bounce event, or message sink was readable |
| Message/link contents | **BLOCKED** — no mailbox interface was available; the single-use token was never read or exposed |
| Positive notary callback | **BLOCKED** — no auth code/link was available to open; no callback session was created |
| Exact-window Auth audit table | **NO RETAINED EVIDENCE** — 0 rows from `05:45:08Z` through `05:45:30Z`; database timestamps corroborate creation but do not substitute for delivery/callback telemetry |
| Cleanup | **PASS** — invitation row and never-confirmed, never-signed-in Auth user deleted; both final counts 0 |

The sanitized browser artifact is `artifacts/provider-invitation-production/evidence-2026-09-18T05-45-08-757Z.json`. It contains no password, TOTP seed/code, invitation token, auth code, cookie value, user UUID, or query string.

### 36b. Former blocker P-004A — removed from product scope

- **Severity:** Release-evidence blocker; no delivery or callback product failure is established.
- **Exact reproduction steps:** (1) Start a clean Chrome context. (2) authenticate `qa-active-admin` at `https://admin.veradoc.pe/auth/login`. (3) complete TOTP and prove AAL2. (4) Open the `Invitaciones` tab. (5) submit one invitation for the approved provider test recipient with province/department `LIMA`. (6) observe `Invitación enviada.` (7) query only non-token invitation/Auth timestamps. (8) attempt to correlate a delivery event or retrieve the email; observe that no provider event reader or mailbox exists. (9) delete the pending application invitation and never-confirmed Auth user.
- **Expected versus actual:** Expected application acceptance, provider delivery telemetry, retrievable email contents, a fresh callback link, host-scoped notary session establishment, and replay rejection. Actual application and Supabase acceptance succeeded, but provider delivery, email contents, callback, and replay were unobservable.
- **Exact route and UTC:** `https://admin.veradoc.pe/` from `2026-09-18T05:45:08.757Z` to `05:45:22.492Z`; invitation accepted visibly at `05:45:22.479Z`. Intended callback `https://notario.veradoc.pe/auth/callback?invitation=[token]` was not invoked.
- **Deployment ID:** `dpl_czHsnN2pTCXCtVx8SrMd49cVM759`.
- **Sanitized error or stack:** No application exception. Evidence gap: `Supabase confirmation_sent_at present; provider delivery event and mailbox contents unavailable; positive callback not executed.` Navigation-only `net::ERR_ABORTED` cancellations occurred during login/MFA redirects and were non-material.
- **Likely failing layer:** QA email observability/message-sink access. Application authorization, AAL2 enforcement, invitation insertion, and Supabase Auth invitation acceptance completed successfully.
- **Second clean context:** Not run. The authorization covered one single-use invitation, and duplicating the external token-bearing send would not resolve the missing mailbox/provider-event evidence.
- **Recommended next diagnostic:** Provide read-only Resend event/log access or a controlled inbox that exposes the received message without forwarding secrets into test artifacts. Send one new invitation, open its link in a fresh context, verify the session remains on `notario.veradoc.pe`, complete acceptance, replay the consumed link, correlate Auth/provider/audit events, then clean up the synthetic account.

### 36c. Updated invitation disposition

- **Application invitation mutation:** PASS at authenticated AAL2 and database-acceptance scope.
- **Supabase invitation request acceptance:** PASS based on `invited_at` and `confirmation_sent_at`.
- **Resend delivery:** PARTIAL; no delivery telemetry.
- **Fresh emailed link and positive notary callback:** BLOCKED; email contents were unavailable.
- **Cleanup:** PASS; no matching invitation or Auth user remains.

## 37. Invitation-removal rollout — 2026-09-18T22:31:52Z–23:19:42Z

**Current result: application, Auth-template, and database removal deployed and verified.**

### 37a. Pre-removal and post-deployment gates

- Live pre-removal inventory found exactly one active, confirmed notary profile with a matching Auth user; `profiles.invited_by` was null.
- Invitation counts were zero for every status. There were zero pending invited Auth users without profiles and zero unrecognized notary Auth users.
- The prior provider-test invitation row and never-confirmed Auth user were both absent.
- The latest physical Supabase backup was `COMPLETED` at `2026-09-18T07:38:47.925Z`; PITR was disabled.
- Supabase Auth used `https://app.veradoc.pe` as Site URL and exact app/notary/apex/local callback allowlist entries. The former VeraDoc-specific invite subject/template was inventoried without recording its content.
- Immediately before the schema-removal approval request, production still had zero pending invitations, zero total invitation rows, and zero profileless pending Auth invitees.

### 37b. First deployment and fail-closed verification

Deployment `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU` is Ready/Production and owns the apex, `www`, app, notary, admin, and demo aliases. Its build generated 46 static pages and no `/auth/invite/[token]` route.

For each of apex, app, notary, admin, and demo, both GET and POST requests to `/auth/invite/obsolete` returned 404 with no `Location` and no `Set-Cookie`. Invitation-bearing callbacks on apex, app, and notary also returned 404 with no redirect or cookie. An ordinary invalid app callback retained the expected 307 to `/auth/login?error=auth`.

The read-only authenticated notary harness passed in two clean Chrome contexts: password login, queue/detail rendering, refresh/history navigation, two host-scoped auth-cookie chunks, zero console/page/HTTP-5xx errors, and correct wrong-role denial. The sanitized artifact is `artifacts/d3-notary-packet-detail/evidence-2026-09-18T22-34-42-926Z.json`.

Admin password authentication reached the MFA gate and established two host-scoped cookie chunks. The retained QA TOTP seed did not elevate the new session in three attempts, so current-deployment AAL2 dashboard rendering and the visible absence of the former tab remain **BLOCKED by stale QA factor evidence** rather than claimed PASS. Source, focused tests, the production route manifest, and the prior AAL2 evidence prove the code path removal but do not substitute for a fresh AAL2 browser observation.

### 37c. Repository verification

- Focused removal/routing/callback suite: 44/44 PASS.
- Full Vitest suite after production schema removal and final type reconciliation: 289/289 PASS across 35 files.
- TypeScript: PASS after deleting only stale generated Next.js dev validators and again after synchronizing post-migration database types.
- Changed-file ESLint: zero errors. Repository-wide ESLint is blocked by four unrelated pre-existing untracked `tmp-*.js` parser errors; those files were preserved.
- Production build: PASS with inert process-local placeholders for the three required Supabase variables absent locally. The Vercel production build also passed.
- Local Supabase integration testing is BLOCKED because Docker Desktop/daemon is unavailable on this machine.

### 37d. Approved Auth-template and schema removal

After the release owner explicitly approved the two production mutations, the zero-row gate was repeated and again returned zero pending invitations, zero total invitation rows, and zero profileless pending Auth invitees.

- The Supabase invite subject and body were reset to generic platform content using only `{{ .ConfirmationURL }}`. An immediate production read-back matched both values exactly. SMTP and the confirmation, magic-link, and recovery templates remained present.
- The forward-only migration `20260918230000_remove_notary_invitations.sql` ran as one transaction after the application removal was live. It asserted that no pending invitation existed, then dropped `lookup_invitation(text)`, `invitations`, and `profiles.invited_by` in that order.
- Post-migration catalog checks confirmed that the table, RPC, and column are absent and that no invitation-table policies or grants remain.
- Only version `20260918230000` was marked applied in `supabase_migrations.schema_migrations`; the unrelated pending commercial-accounting migration was not pushed.
- A fresh remote type generation confirmed that the invitation objects are absent. The checked-in file retains the already-tracked forward typings for the intentionally unapplied commercial-accounting migration, while its only diff for this rollout removes the invitation table, `profiles.invited_by`, its relationship, and `lookup_invitation`.
- Final TypeScript, changed-file ESLint, Vitest, and Next.js production build checks passed. The build produced no `/auth/invite/[token]` route.
- A bounded aggregate Supabase edge-log query covering `2026-09-18T22:31:52Z` through `2026-09-18T23:24:37.590Z` returned 322 edge rows, zero `/auth/v1/invite` calls, and zero `/rest/v1/invitations` calls.
- Post-removal production probes repeated the complete five-host GET/POST retired-route matrix and the apex/app/notary invitation-callback matrix; every request returned 404 without `Location` or `Set-Cookie`.

No Resend-side invitation automation could be inspected or removed because no narrow read-only Resend credential or integration is available. The repository contains no deployable invite template or invitation send path, and Supabase's active invite template is now generic; this external-provider inventory remains an evidence limitation rather than a remaining application or database invitation surface.

## 38. Focused magic-link, recovery, and Google OAuth callback acceptance — 2026-09-19

**Overall result: BLOCKED.** The focused non-mutating harness ran against production deployment `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU` from `2026-09-19T00:28:45.901Z` through `2026-09-19T00:28:50.702Z`. It used two direct callback probes, one clean headless Chrome context for Google initiation, and an authenticated read-only Supabase Logs API aggregate. No password, email address, Google credential, auth code, state, token, cookie, or full query string was persisted.

Sanitized artifact: `artifacts/auth-callback-acceptance/2026-09-19T00-28-45-901Z/report.md`.

| Case | Result | Evidence |
| --- | --- | --- |
| Invalid callback baseline | **PASS** | `https://app.veradoc.pe/auth/callback` with a synthetic invalid code and with no code both returned HTTP 307 to the app login error route, with no `Set-Cookie`. |
| Positive Google OAuth callback | **BLOCKED** | Chrome `152.0.7977.83` reached the Supabase authorization endpoint from the app login page, but no disposable Google sandbox identity or one-time callback capture was available. No exchange or session was claimed. |
| Positive magic-link callback | **BLOCKED** | No controlled mailbox/message retrieval surface or disposable magic-link identity was available. The link was not retrieved or opened. |
| Positive password-recovery callback | **BLOCKED** | No controlled mailbox/message retrieval surface or disposable recovery identity was available. The link was not retrieved or opened. |
| Exact-window callback telemetry | **PARTIAL** | The Management API credential authenticated, but the exact run window returned zero retained edge-log rows. Callback correlation is therefore unproven. |

### C-AUTH-01-GOOGLE-POSITIVE — BLOCKED

- **Severity:** Release-evidence blocker; no development defect is established.
- **Exact reproduction steps:** (1) Open `https://app.veradoc.pe/auth/login` in a new Chrome context. (2) Click `Continuar con Google`. (3) Authenticate with the disposable Google sandbox identity. (4) Capture the one-time provider callback in the same context without recording its code or query string. (5) Verify return to `app.veradoc.pe`, intended host-scoped session creation, and expected new-user profile-completion routing. (6) Repeat in a second clean context and correlate the bounded Auth/edge telemetry window.
- **Expected versus actual behavior:** Expected: one Google OAuth code exchange on `app.veradoc.pe`, intended session, and new-realtor profile-completion routing. Actual: only initiation was observed; the browser reached the sanitized provider route `https://fyfcslzgahfbyezsnpxl.supabase.co/auth/v1/authorize`. The disposable identity and positive callback were unavailable.
- **Exact route and UTC:** `https://fyfcslzgahfbyezsnpxl.supabase.co/auth/v1/authorize` at `2026-09-19T00:28:47.221Z`.
- **Deployment ID:** `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU`.
- **Sanitized error or stack:** No application exception. Evidence boundary: provider initiation completed; one-time identity/callback evidence unavailable.
- **Likely failing layer:** QA Google sandbox identity and callback-capture boundary; product behavior is not established as failing.
- **Whether it reproduces in a second clean context:** Not run; a second initiation without a sandbox identity would not produce the required exchange evidence.
- **Recommended next diagnostic:** Provide the disposable Google sandbox identity, confirm the Supabase/Google callback allowlist, capture the callback only in memory in two fresh contexts, and correlate Auth/edge telemetry for the exact run window.

### C-AUTH-02-MAGIC-POSITIVE — BLOCKED

- **Severity:** Release-evidence blocker.
- **Exact reproduction steps:** (1) Create/select the disposable magic-link identity. (2) Trigger the supported email flow. (3) Retrieve the message through the controlled mailbox/message sink. (4) Open the one-time link in a clean context and verify the app-host exchange, session, and sanitized evidence. (5) Replay the link and verify safe rejection. (6) Repeat in a second clean context and correlate Auth/provider/edge telemetry.
- **Expected versus actual behavior:** Expected: delivered message, one successful callback exchange on `app.veradoc.pe`, host-scoped session, replay denial, and correlated telemetry. Actual: no mailbox/message retrieval surface or disposable identity was available; no link, exchange, replay, or positive telemetry was observable.
- **Exact route and UTC:** Intended `https://app.veradoc.pe/auth/callback` at run completion `2026-09-19T00:28:50.702Z`; no positive callback request was invoked.
- **Deployment ID:** `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU`.
- **Sanitized error or stack:** `Required mailbox/message retrieval and disposable identity evidence unavailable.`
- **Likely failing layer:** QA fixture/message-sink observability boundary, not established product behavior.
- **Whether it reproduces in a second clean context:** Not run; without a retrievable one-time message, a second context cannot execute the positive exchange.
- **Recommended next diagnostic:** Provision the disposable identity and controlled mailbox/API retrieval, trigger one message, open the link in two fresh contexts, verify replay denial, and correlate Supabase Auth plus provider/edge telemetry without retaining the link or code.

### C-AUTH-03-RECOVERY-POSITIVE — BLOCKED

- **Severity:** Release-evidence blocker.
- **Exact reproduction steps:** (1) Create/select the disposable password-recovery identity. (2) Trigger the supported recovery email flow. (3) Retrieve the message through the controlled mailbox/message sink. (4) Open the one-time link in a clean context and verify the app-host exchange, recovery state, and sanitized evidence. (5) Replay the link and verify safe rejection. (6) Repeat in a second clean context and correlate Auth/provider/edge telemetry.
- **Expected versus actual behavior:** Expected: delivered recovery message, one successful callback exchange on `app.veradoc.pe`, recovery session/state, replay denial, and correlated telemetry. Actual: no mailbox/message retrieval surface or disposable identity was available; no link, exchange, replay, or positive telemetry was observable.
- **Exact route and UTC:** Intended `https://app.veradoc.pe/auth/callback` at run completion `2026-09-19T00:28:50.702Z`; no positive callback request was invoked.
- **Deployment ID:** `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU`.
- **Sanitized error or stack:** `Required mailbox/message retrieval and disposable identity evidence unavailable.`
- **Likely failing layer:** QA fixture/message-sink observability boundary, not established product behavior.
- **Whether it reproduces in a second clean context:** Not run; without a retrievable one-time message, a second context cannot execute the positive exchange.
- **Recommended next diagnostic:** Provision the disposable identity and controlled mailbox/API retrieval, trigger one recovery message, open the link in two fresh contexts, verify replay denial and password-reset state, and correlate Supabase Auth plus provider/edge telemetry without retaining the link or code.

### C-AUTH-TELEMETRY — PARTIAL

- **Severity:** High; required callback correlation evidence is unavailable.
- **Exact reproduction steps:** (1) Run `npm run test:auth-callbacks` with the read-only Supabase Management API credential. (2) Query project `fyfcslzgahfbyezsnpxl` through the Logs API for `2026-09-19T00:28:45.901Z`–`2026-09-19T00:28:50.702Z`. (3) Aggregate only edge-log coverage and callback request/status counts; do not retrieve raw query strings, cookies, or tokens.
- **Expected versus actual behavior:** Expected: retained authenticated edge-log coverage sufficient to correlate callback requests/statuses. Actual: authenticated query returned zero edge-log rows, with callback count 0; retention coverage is unproven.
- **Exact route and UTC:** `https://app.veradoc.pe/auth/callback` at `2026-09-19T00:28:45.901Z`–`2026-09-19T00:28:50.702Z`.
- **Deployment ID:** `dpl_58qbvGJKQeeZrgCNXM54Lqm464dU`.
- **Sanitized error or stack:** `The exact window returned zero edge-log rows; retention coverage is unproven.`
- **Likely failing layer:** Supabase Logs API retention/analytics visibility, not established application callback behavior.
- **Whether it reproduces in a second clean context:** Telemetry is window-scoped; no second positive browser exchange was run.
- **Recommended next diagnostic:** Repeat with a read-only token having `analytics_logs_read`, allow a retention delay if required, and rerun the same bounded aggregate over a window containing a completed positive exchange.

This run does not close the requested positive callback gates. The invalid-code behavior remains the only callback behavior directly verified in this focused run; Google initiation is evidence of provider reachability only, not OAuth success.
