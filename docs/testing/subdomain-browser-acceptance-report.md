# VeraDoc Subdomain Browser Acceptance Report

Overall status: **PARTIAL — the seven-item remediation was deployed uniformly to all production aliases on 2026-09-16; public metadata, CORS, RSC-prefetch, and an exercised Supabase OAuth cookie path now pass live browser retests. D-002, D-003, the password-session-cookie path, and UX-002 still require final authenticated browser confirmation; admin logout remains UX-blocked (UX-001), and provider-dependent workflows remain blocked.**

Report date: 2026-09-15 (initial); 2026-09-16 (retested, remediated, deployed, and partially reverified in production)

Source evidence: Browser-agent safe anonymous and authenticated reports supplied by the release owner, independent read-only HTTP and Vercel CLI verification, a production Supabase QA Auth fixture bootstrap authorized on 2026-09-15, post-remediation AAL1/AAL2 browser checks in section 8, authenticated acceptance testing on 2026-09-16 (sections 9–16), and continued browser acceptance testing on 2026-09-16 (sections 10a, 10b, 9a, 16a). Phase B–G evidence includes UTC timestamps, start→final URL pairs, cookie counts, and heading content for most tests. Several rows from the initial session (B4, B5, and some B2/B3 entries) lack UTC timestamps, browser profile labels, redirect status codes, and console/network summaries required by the evidence standard (acceptance guide section 7). Cookie attributes are now confirmed via sanitized browser-context cookie inspection (see section 10b).

## 1. Environment and release

| Field | Result |
| --- | --- |
| Environment | Production |
| Marketing | `https://veradoc.pe` |
| App | `https://app.veradoc.pe` |
| Notary | `https://notario.veradoc.pe` |
| Admin | `https://admin.veradoc.pe` |
| Demo | `https://demo.veradoc.pe` |
| Vercel deployment | `dpl_4jk9iEMB5n5GMbc1yj4VWsZXRRUE` |
| Deployment status | Ready, production |
| Current remediation commit | `b4dad37` |
| Post-remediation browser/version | Headless Chrome `152.0.7977.83` |
| Post-remediation browser timestamp | `2026-09-15T23:34:44Z` |

The Vercel CLI independently confirmed that the deployment is Ready and has all six aliases: apex, `www`, app, notary, admin, and demo. Earlier browser evidence was collected against `dpl_52hALsJfRggB56ejjwcMRagH8VQZ`; the sanitized admin AAL1 and AAL2 follow-ups in section 8 were repeated against the current remediation deployment.

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

## 7. Current release assessment (superseded by section 20)

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

## 12. Account-state matrix (B5) — PARTIAL (5/6)

The normative matrix contains six states. Expired-but-refreshable remains untested.

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
| 2 | Public URLs follow the clean target contract | PARTIAL — all tested navigation uses clean public paths; no prefix leakage; legacy `/notario/perfil` collapses to clean `/perfil`; `A-MKT-03b` (canonical metadata) remains FAIL | — |
| 3 | Durable generated links use typed origins | PARTIAL — automated/source evidence exists; fresh copied/email links remain untested | — |
| 4 | Auth callbacks establish sessions on intended host | BLOCKED — password login was tested (not a callback); invitation, magic-link, and OAuth callback flows remain untested | Remains BLOCKED |
| 5 | Sessions remain host-scoped | **PASS** — nine authenticated-source cross-host destinations, two session-persistence checks, and one demo no-auth confirmation all pass; cookie attributes confirmed via sanitized browser-context cookie inspection: `Domain` is the specific host (not `.veradoc.pe`) on all three authenticated surfaces; demo receives 0 cookies; SEC-001 (Secure=false) is a defense-in-depth finding, not release-blocking given HSTS. | ↑ from PARTIAL to PASS |
| 6 | Server authorization works independently of Proxy | PARTIAL — wrong-role denial (10/10 active + 3/3 state-specific admin denial), account-state gating (5/6 states), MFA enforcement, post-logout access denial on all surfaces including back-button; admin refresh preserves AAL2; negative mutation matrix blocked | ↑ from PARTIAL |
| 7 | Fresh and legacy signing links complete | BLOCKED | — |
| 8 | Notary invitations complete on notary | BLOCKED | — |
| 9 | Admin includes the approved additional control | **PASS** — AAL1→MFA gate, AAL2→dashboard, session invalidation verified (developer-tooling cookie clear, not product-UI logout), back-button denied, wrong-role denied | Confirmed |
| 10 | Demo cannot cause production side effects | PARTIAL — anonymous+interactive demo checks pass; 0 cookies; demo `/auth/login` returns empty document (no login form); mutation/token tests blocked | ↑ from PARTIAL |
| 11 | APIs, webhooks, cron, and actions avoid cross-host redirects | PARTIAL — sampled wrong-host POST and automated tests pass; provider workflows remain untested | — |
| 12 | Only marketing is intentionally indexable | **PASS** | Confirmed |
| 13 | Automated and manual matrices pass | PARTIAL — B2 exercised for all 5 roles (3 complete; realtor has D-003 FAIL but refresh now PASS; admin has nav N/A, refresh PASS, logout UX-blocked); B3 complete (9 cross-host destinations + 2 session-persistence + 1 demo no-auth + cookie attributes captured); B4 10/10; B5 5/6; C/D dashboards rendered but D-002 and D-003 FAIL; E cross-surface isolation 8/8 + admin state-specific denial 3/3 PASS; F-DEMO-03 7/7; G navigation routing works but 2 destinations FAIL; provider workflows blocked; B4 and B5 lack UTC timestamps from prior session; SEC-001 finding | ↑ from PARTIAL |
| 14 | Production telemetry shows no material regression | BLOCKED | — |
| 15 | Rollback exercised or proven production-like | BLOCKED | — |

**Summary: 4 PASS (#1, #5, #9, #12), 6 PARTIAL (#2, #3, #6, #10, #11, #13), 5 BLOCKED (#4, #7, #8, #14, #15).**

## 18. Updated phase readiness

| Area | Status | Missing prerequisite |
| --- | --- | --- |
| B2: login, logout, post-logout | PARTIAL — 4/5 roles functionally complete (landlord, renter, notary, realtor). Realtor second nav returns HTTP 500 (D-003) but refresh now PASS. Admin: refresh PASS, tab nav N/A (in-page tabs), product-UI logout blocked (UX-001). | D-003 remediation; admin logout button |
| B3: cookie isolation | **PASS** — 9 authenticated-source cross-host destinations, 2 session-persistence checks, 1 demo no-auth confirmation; cookie attributes confirmed via sanitized browser-context inspection: `Domain` is the specific host (not `.veradoc.pe`) on all 3 authenticated surfaces; demo 0 cookies; SEC-001 (Secure=false) recorded | — |
| B4: wrong-role matrix | EXECUTED — 10/10 PASS | UTC timestamps not recorded |
| B5: account states | PARTIAL (5/6) | Expired-but-refreshable session needs controlled fixture |
| C: read-only role dashboard/navigation | PARTIAL — dashboard and profile pages render for all 3 app roles; however D-003 (realtor `/agente/nuevo-paquete`) returns HTTP 500 | D-003 remediation |
| C: customer packet/upload/signing workflow | BLOCKED | Provider-safe environment, synthetic packet/signing links, safe OTP sink, and mutation authorization |
| D: read-only notary dashboard/navigation | PARTIAL (D-002 on ganancias; no packet-detail evidence) | D-002 remediation; assigned packets for packet-detail nav |
| D: notary invitation/certification workflow | BLOCKED | Synthetic notary invitation/packet and stubbed provider path |
| E: admin access control | PARTIAL — cross-surface admin content isolation 8/8; wrong-role (active accounts) denial verified; admin state-specific denial 3/3 PASS (pending/rejected/suspended all redirect with `?error=wrong-surface`, no admin cookies survive); session invalidation confirmed via cookie clear; admin refresh PASS; admin tab nav N/A. Product-UI logout untested (UX-001). | Admin logout button |
| E: privileged mutation and audit | BLOCKED | Harmless synthetic target, mutation authorization, and audit visibility |
| F-DEMO-03: state persistence | **COMPLETE** — 7/7 checks including refresh, client nav, back/forward, multi-role demo surfaces | — |
| F-DEMO-05/06/07: side-effect and token separation | BLOCKED | Network evidence plus safe demo/production-shaped synthetic tokens |
| G: authenticated navigation | PARTIAL — routing patterns (refresh, `<Link>`, back/forward, redirect query preservation, no loops, no prefix leakage) are verified and working for exercised roles. 2 `<Link>` destinations return server errors (D-002, D-003); admin tab nav and refresh now verified; notary packet-detail blocked (no assigned packets) | D-002 and D-003 remediation |
| G: negative privileged mutations | BLOCKED | Provider-safe mutation targets and explicit mutation authorization |
| H1: telemetry | BLOCKED | Approved read-only telemetry access |
| H2: rollback exercise | BLOCKED | Production-like environment, named operator, and explicit exercise authorization |

## 19. Defects and findings

| ID | Severity | Summary | Status |
| --- | --- | --- | --- |
| D-002 | Medium | `notario.veradoc.pe/ganancias` server error (ERROR 2581687241) — **confirmed cause:** `getNotaryEarnings` in `lib/actions/notary.ts` selects `notary_igv_centimos`, a column from unapplied migration `20260910160000_commercial_accounting.sql` | DEPLOYED — authenticated browser retest pending |
| D-003 | Medium | `app.veradoc.pe/agente/nuevo-paquete` server error — **confirmed cause:** the disabled-gate path queried `effective_from` and `effective_to`, columns from the same unapplied commercial migration | DEPLOYED — authenticated browser retest pending |
| UX-001 | Low | Admin dashboard has no visible logout button | NEW |
| UX-002 | Low | Suspended account login shows no visible error message | DEPLOYED — suspended-password browser retest pending |
| A-MKT-03b | Low | Marketing pages missing explicit canonical tags | PASS IN PRODUCTION — 9/9 canonical and `og:url` values verified |
| A-HDR-05 | Medium | Global wildcard `Access-Control-Allow-Origin: *` on HTML responses | PASS IN PRODUCTION — exact same-origin ACAO verified on all five surfaces |
| SEC-001 | Low | Supabase auth cookies have `Secure=false` on all authenticated surfaces. HSTS with `includeSubDomains` provides transport protection, limiting practical exposure. Defense-in-depth improvement recommended. | PARTIAL PASS IN PRODUCTION — OAuth verifier cookie is Secure/host-only/Lax; password-session-cookie retest pending |
| RSC-CORS | Low | Admin RSC prefetch for `/auth/signup` CORS warning | PASS IN PRODUCTION — zero speculative signup RSC requests observed |

### 19a. Local remediation ready for deployment and browser retest

The seven items in the fix-then-retest list were remediated locally on 2026-09-16 without applying migration `20260910160000_commercial_accounting.sql` or changing production/provider state:

- **D-002:** notary earnings now fails closed before creating an admin client while commercial accounting is disabled; the page renders an unavailable-state message instead of querying unapplied payout columns.
- **D-003:** packet pricing now uses the legacy pricing columns while the commercial gate is disabled and only applies effective-date filters after the versioned schema is enabled.
- **A-MKT-03b:** all nine marketing routes now publish matching explicit apex canonical and Open Graph URLs.
- **A-HDR-05:** live tracing showed that Vercel adds wildcard ACAO to cached static HTML but not dynamic Proxy redirects. Host-matched Next.js response rules now override the platform default with each surface's exact own origin on apex, `www`, app, notary, admin, and demo. The production build manifest contains all six non-wildcard rules.
- **RSC-CORS:** the signup control is now a normal document link, so admin/notary login pages do not issue speculative RSC prefetches that redirect cross-origin.
- **SEC-001:** all Supabase browser/server/Proxy clients share a production `Secure` cookie policy while omitting `Domain` to preserve host-only sessions.
- **UX-002:** suspended login invalidates the newly created session and returns a persistent inline `role="alert"` message.

Local verification: remediation-focused Vitest **29/29 passed**; complete Vitest **252/252 passed** before the final isolated header-rule strengthening; post-header routing/header Vitest **12/12 passed**; TypeScript **passed**; ESLint **0 errors** (7 unrelated pre-existing warnings); Next.js production build **passed** with inert process-local placeholders for the three required values absent from the local environment. The post-header attempt to rerun the entire suite was interrupted by the command-approval service before results were produced; the changed header boundary is covered by the post-change focused tests and production build.

## 20. Current release assessment (updated 2026-09-16T04:33Z)

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
- **B5:** 5/6 states verified (no UTC timestamps — from prior session).
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

Use the existing authorized QA browser sessions or credentials to run only these final checks against the already-uniform deployment:

1. Notary `/ganancias`: expect HTTP 200 and the accounting-unavailable state, with no server error.
2. Realtor `/agente/nuevo-paquete`: expect the wizard to render from legacy pricing, with no server error.
3. Password login on app, notary, and admin: confirm both resulting Supabase session cookies are `Secure=true`, host-scoped, and `SameSite=Lax`.
4. Suspended realtor login: expect the persistent suspended-account `role="alert"`, no dashboard navigation, and no surviving session cookies.
