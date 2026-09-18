# H1 Supabase telemetry Puppeteer check

This script closes only the H1 payout-query telemetry gap described in section
26c of the subdomain browser acceptance report. It performs two independent
checks:

1. Two new Chrome browser contexts authenticate as the dedicated QA notary and
   render `https://notario.veradoc.pe/ganancias`.
2. An authenticated, read-only Supabase Management API query aggregates the
   exact historical window `2026-09-17T05:53:09Z`–`05:53:34Z`.

The telemetry query returns aggregate counters only. It does not request event
messages, headers, identities, cookies, tokens, or query strings.

## Prerequisites

- Chrome installed at the default path, or `H1_CHROME_PATH` set to its location.
- The dedicated active QA notary credentials.
- A Supabase Management API token with `analytics_logs_read` permission for
  project `fyfcslzgahfbyezsnpxl`.

Do not paste any of these values into chat, source control, reports, or command
arguments. Set them as process environment variables from a secure prompt:

```powershell
$secure = Read-Host 'Supabase read-only Management API token' -AsSecureString
$env:SUPABASE_ACCESS_TOKEN = [System.Net.NetworkCredential]::new('', $secure).Password

$secure = Read-Host 'QA notary email' -AsSecureString
$env:H1_NOTARY_EMAIL = [System.Net.NetworkCredential]::new('', $secure).Password

$secure = Read-Host 'QA notary password' -AsSecureString
$env:H1_NOTARY_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
```

Run headless Chrome:

```powershell
npm run test:h1-telemetry
```

Or watch the browser:

```powershell
npm run test:h1-telemetry -- --headed
```

Clear the process environment afterward:

```powershell
Remove-Item Env:SUPABASE_ACCESS_TOKEN, Env:H1_NOTARY_EMAIL, Env:H1_NOTARY_PASSWORD
```

## Result rules

- `PASS` and exit code `0`: both clean browser contexts pass; the Logs API is
  authenticated; the exact window contains retained edge-log coverage; and
  both `payout_request_count` and `payout_400_count` are zero.
- `FAIL` and exit code `1`: observed evidence contradicts the expected product
  behavior, such as a payout query, a payout 400, or an authenticated route
  rendering failure.
- `PARTIAL` or `BLOCKED` and exit code `2`: credentials, authenticated
  telemetry, retained coverage, Chrome, or another required evidence source is
  unavailable. This result must not be reported as a pass.

Sanitized `report.md` and `report.json` files are written under
`artifacts/h1-telemetry/<run-UTC>/`. Generated artifacts are git-ignored. Each
failure or blocker contains severity, exact reproduction steps, expected and
actual behavior, exact route and UTC, deployment ID, a sanitized error/stack,
the likely failing layer, second-clean-context status, and the recommended next
diagnostic.
