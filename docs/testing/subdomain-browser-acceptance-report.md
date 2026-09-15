# VeraDoc Subdomain Browser Acceptance Report

Overall status: **PARTIAL — authenticated and workflow gates blocked**

Report date: 2026-09-15

Source evidence: Browser-agent safe anonymous interim report supplied by the release owner, plus independent read-only HTTP and Vercel CLI verification.

## 1. Environment and release

| Field | Result |
| --- | --- |
| Environment | Production |
| Marketing | `https://veradoc.pe` |
| App | `https://app.veradoc.pe` |
| Notary | `https://notario.veradoc.pe` |
| Admin | `https://admin.veradoc.pe` |
| Demo | `https://demo.veradoc.pe` |
| Vercel deployment | `dpl_52hALsJfRggB56ejjwcMRagH8VQZ` |
| Deployment status | Ready, production |
| Expected application commit | `2fd1a82042650b9c267113bb121f45dedef5f503` |
| Browser/version | Not supplied in interim evidence |
| Browser run timestamp | Not supplied in interim evidence |

The Vercel CLI independently confirmed that the deployment is Ready and has all six aliases: apex, `www`, app, notary, admin, and demo. The browser agent's final report still needs its browser version, profile labels, timestamps, and sanitized evidence references.

## 2. Reconciliation of interim findings

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

## 3. Safe anonymous results

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

## 4. Blocked and not-run phases

| Area | Status | Missing prerequisite |
| --- | --- | --- |
| B2–B5: login, cookie isolation, role/status matrix | BLOCKED | Secure synthetic role credentials and state fixtures |
| C: customer packet/upload/signing workflow | BLOCKED | Provider-safe environment, synthetic packet/signing links, safe OTP sink, and mutation authorization |
| D: notary invitation/certification workflow | BLOCKED | Synthetic notary invitation/packet and stubbed provider path |
| E: admin MFA and audit | BLOCKED | Dedicated synthetic admin, secure TOTP access, harmless synthetic target, and audit visibility |
| F-DEMO-05/06/07: side-effect and token separation | BLOCKED | Network evidence plus safe demo/production-shaped synthetic tokens |
| G: authenticated navigation and negative security | BLOCKED | Role/status fixtures and provider-safe mutation targets |
| H1: telemetry | BLOCKED | Approved read-only telemetry access |
| H2: rollback exercise | BLOCKED | Production-like environment, named operator, and explicit exercise authorization |

## 5. Completion-condition standing

| # | Completion condition | Standing |
| --- | --- | --- |
| 1 | Each hostname serves only its approved surface | PARTIAL — anonymous matrix passes; authenticated data isolation remains unproven in a browser |
| 2 | Public URLs follow the clean target contract | PARTIAL — sampled routing passes; canonical metadata is absent and authenticated flows remain untested |
| 3 | Durable generated links use typed origins | PARTIAL — automated/source evidence exists; fresh copied/email links remain untested in a browser |
| 4 | Auth callbacks establish sessions on intended host | BLOCKED |
| 5 | Sessions remain host-scoped | BLOCKED |
| 6 | Server authorization works independently of Proxy | PARTIAL — automated evidence exists; browser negative matrix is blocked |
| 7 | Fresh and legacy signing links complete | BLOCKED |
| 8 | Notary invitations complete on notary | BLOCKED |
| 9 | Admin includes the approved additional control | PARTIAL — TOTP AAL2 is implemented; real-browser proof is blocked |
| 10 | Demo cannot cause production side effects | PARTIAL — anonymous UI/cookie checks pass; mutation/token tests are blocked |
| 11 | APIs, webhooks, cron, and actions avoid cross-host redirects | PARTIAL — sampled wrong-host POST and automated tests pass; provider workflows remain untested |
| 12 | Only marketing is intentionally indexable | PASS for sampled browser/header evidence |
| 13 | Automated and manual matrices pass | PARTIAL |
| 14 | Production telemetry shows no material regression | BLOCKED |
| 15 | Rollback exercised or proven production-like | BLOCKED |

## 6. Current release assessment

The production hostname transition is functioning for the anonymous routing surface. There is no evidence in this run of redirect loops, wrong-surface rendering, demo authentication exposure, or wrong-host mutation replay.

The migration cannot be called complete. There are two newly documented response/metadata gaps and eight authenticated, workflow, telemetry, or rollback areas still blocked.

The next one-question-at-a-time prompt remains:

> Should the authenticated and workflow tests run in a provider-safe staging environment or against dedicated synthetic data in production?

Provider-safe staging is the recommended choice. Production is read-only by default, and MercadoPago is known to be configured for production.
