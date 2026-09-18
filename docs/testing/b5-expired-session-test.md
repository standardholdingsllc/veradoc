# B5 expired-but-refreshable session test

This production-safe browser harness exercises the sixth B5 account state
without changing Supabase, Vercel, DNS, OAuth, provider, or application data.
It deliberately waits for two genuine server-issued access tokens to expire;
it does not edit JWT claims, forge signatures, or invalidate refresh tokens.

For each of two independently authenticated realtor sessions, the harness:

1. Logs in through `https://app.veradoc.pe/auth/login` in a new Chrome context.
2. Retains the host-scoped cookie only in process memory, closes the context,
   and waits until the signed JWT's real `exp` time plus a safety buffer.
3. Restores that context's own unmodified cookie into another clean context and
   requests `/agente`.
4. Requires both access-token and refresh-token rotation, a new future expiry,
   unchanged user identity, HTTP 200 protected content, and same-host routing.
5. Requires every auth cookie to remain `Secure`, host-only to
   `app.veradoc.pe`, and `SameSite=Lax`; `admin.veradoc.pe` must receive zero
   auth cookies.
6. Requests the landlord route and requires realtor role enforcement back to
   `/agente`, with no redirect loop, page error, material failed request, or
   HTTP 5xx. Chromium `net::ERR_ABORTED` cancellations caused by deliberate
   navigation/redirects are recorded but are not treated as product failures.

The local ignored QA credential table is used by default. Alternatively, set
`B5_APP_EMAIL` and `B5_APP_PASSWORD`. Secret values are never printed or
written to the sanitized report.

```powershell
npm run test:b5-expired-session
```

The run normally takes about one hour because real expiry is part of the test
oracle. Sanitized `report.md` and `report.json` outputs are written below
`artifacts/b5-expired-session/<run-UTC>/`.

Verdicts are strict:

- `PASS` / exit 0 requires every check in both clean contexts.
- `FAIL` / exit 1 means observed production behavior contradicted the oracle.
- `BLOCKED` or `PARTIAL` / exit 2 means authentication evidence, the second
  context, Chrome, credentials, or another prerequisite was unavailable. Such
  a result must never be reported as PASS.

Each failure or blocker includes severity, exact reproduction steps, expected
and actual behavior, exact route and UTC, deployment ID, sanitized error/stack,
likely failing layer, second-clean-context result, and next diagnostic.
