# VeraDoc Subdomain Browser Acceptance Report

Overall status: **PARTIAL — admin AAL2 is verified; provider workflows, telemetry, rollback, and remaining authenticated matrices are incomplete**

Report date: 2026-09-15

Source evidence: Browser-agent safe anonymous and authenticated reports supplied by the release owner, independent read-only HTTP and Vercel CLI verification, a production Supabase QA Auth fixture bootstrap authorized on 2026-09-15, and the post-remediation AAL1/AAL2 browser checks recorded in section 8.

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

## 5. Remaining phase readiness

| Area | Status | Missing prerequisite |
| --- | --- | --- |
| B2–B4: login, cookie isolation, wrong-role matrix | READY TO TEST | Dedicated credentials now available |
| B5: pending, rejected, suspended, and missing-role states | READY TO TEST | Dedicated state fixtures now available |
| B5: expired-but-refreshable and invalid session | PARTIAL | Invalid session can be browser-created safely; expired/refreshable timing still needs a controlled fixture |
| C: customer packet/upload/signing workflow | BLOCKED | Provider-safe environment, synthetic packet/signing links, safe OTP sink, and mutation authorization |
| C: read-only role dashboard/navigation checks | READY TO TEST | Active realtor, landlord, and renter credentials available |
| D: read-only notary dashboard/navigation checks | READY TO TEST | Active notary credential available |
| D: notary invitation/certification workflow | BLOCKED | Synthetic notary invitation/packet and stubbed provider path |
| E: admin login, MFA enrollment/AAL2, wrong-role denial | PARTIAL | Admin password login, MFA enrollment, AAL2, host-scoped cookies, and dashboard rendering are verified; the wrong-role browser denial matrix remains untested |
| E: privileged mutation and audit | BLOCKED | Harmless synthetic target, mutation authorization, and audit visibility |
| F-DEMO-05/06/07: side-effect and token separation | BLOCKED | Network evidence plus safe demo/production-shaped synthetic tokens |
| G: authenticated navigation | READY TO TEST | Role/status fixtures available |
| G: negative privileged mutations | BLOCKED | Provider-safe mutation targets and explicit mutation authorization |
| H1: telemetry | BLOCKED | Approved read-only telemetry access |
| H2: rollback exercise | BLOCKED | Production-like environment, named operator, and explicit exercise authorization |

## 6. Completion-condition standing

| # | Completion condition | Standing |
| --- | --- | --- |
| 1 | Each hostname serves only its approved surface | PARTIAL — anonymous matrix passes; authenticated data isolation remains unproven in a browser |
| 2 | Public URLs follow the clean target contract | PARTIAL — sampled routing passes; canonical metadata is absent and authenticated flows remain untested |
| 3 | Durable generated links use typed origins | PARTIAL — automated/source evidence exists; fresh copied/email links remain untested in a browser |
| 4 | Auth callbacks establish sessions on intended host | BLOCKED |
| 5 | Sessions remain host-scoped | PARTIAL — verified for the production admin AAL2 session; other authenticated roles remain untested |
| 6 | Server authorization works independently of Proxy | PARTIAL — automated evidence exists; browser negative matrix is blocked |
| 7 | Fresh and legacy signing links complete | BLOCKED |
| 8 | Notary invitations complete on notary | BLOCKED |
| 9 | Admin includes the approved additional control | PASS — AAL1 fails closed at the TOTP gate, AAL2 succeeds, and the post-remediation dashboard renders without querying the unapplied commercial schema |
| 10 | Demo cannot cause production side effects | PARTIAL — anonymous UI/cookie checks pass; mutation/token tests are blocked |
| 11 | APIs, webhooks, cron, and actions avoid cross-host redirects | PARTIAL — sampled wrong-host POST and automated tests pass; provider workflows remain untested |
| 12 | Only marketing is intentionally indexable | PASS for sampled browser/header evidence |
| 13 | Automated and manual matrices pass | PARTIAL |
| 14 | Production telemetry shows no material regression | BLOCKED |
| 15 | Rollback exercised or proven production-like | BLOCKED |

## 7. Current release assessment

The production hostname transition is functioning for the anonymous routing surface. There is no evidence in this run of redirect loops, wrong-surface rendering, demo authentication exposure, or wrong-host mutation replay.

The migration cannot be called complete. There are two documented response/metadata gaps, while the newly provisioned QA suite now unblocks role login, host-scoped cookie, account-state, and read-only dashboard browser checks. Admin MFA is verified through AAL2. Provider-backed workflows, telemetry, and rollback remain blocked.

The browser agent may proceed immediately with B2–B4, the provisioned portions of B5, read-only C/D checks, E-ADMIN-01–05, and authenticated navigation in G. The next blocking question after those checks is:

> Which provider-safe environment and synthetic packet/signing fixtures should be used for the state-changing customer workflow?

Provider-safe staging remains the recommended choice. Production is read-only by default, and MercadoPago is known to be configured for production.

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
