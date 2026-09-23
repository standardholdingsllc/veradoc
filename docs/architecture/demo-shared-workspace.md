# Shared demo workspace deployment

The demo is a separately deployed VeraDoc surface. Its shared workspace state
uses a dedicated Upstash Redis resource connected only to the `veradoc-demo`
Vercel project. It must never receive production Supabase credentials, payment
credentials, signing-provider credentials, or production storage credentials.

## Deployment configuration

The Upstash resource is provisioned on the Free plan in `iad1` with automatic
upgrades disabled. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
into the demo project. Configure the demo deployment with:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the Vercel integration
- `DEMO_ISOLATED_DEPLOYMENT=true`
- `DEMO_TOKEN_ENCRYPTION_KEY`
- `DEMO_CONTROL_SECRET`
- `DEMO_EMAIL_API_KEY` and `DEMO_EMAIL_FROM` only when sandbox email is enabled
- the ordinary typed origins, with `DEMO_ORIGIN=https://demo.veradoc.pe`

Configure the admin deployment with `DEMO_CONTROL_ORIGIN` and the same
`DEMO_CONTROL_SECRET`. The secret is used only by the authenticated, MFA-gated
admin server action; it is never exposed to browser JavaScript.

`demo.veradoc.pe` is assigned to the isolated demo project. Its
`veradoc-demo.vercel.app` alias remains available for staging and recovery;
preview and development origins still use that alias rather than the public
canonical hostname.

The demo project's Git production branch currently defaults to `main`, where
the shared-demo implementation has not yet been merged. Its project-level
Ignored Build Step skips `main` builds so an unrelated main push cannot replace
the public demo. Production releases use an explicit verified deployment until
the code is merged; remove that guard when branch tracking is corrected.

Generate independent random values for the encryption and control secrets. Do
not reuse any production provider secret.

Seed `veradoc:demo:v1:control` once with
`{"enabled":true,"updatedAt":"1970-01-01T00:00:00.000Z","updatedBy":null}`.
The demo fails closed if this key is missing. Workspace, capability, delivery,
and rate-limit keys expire in Redis. Expiration is also checked in application
code, so an expired capability is unusable even before Redis removes its key.

The same codebase still contains production routes. The demo deployment uses
`DEMO_ISOLATED_DEPLOYMENT=true`, which allows it to build without production
Supabase credentials; those routes cannot access production data there.

## Email boundary

The only permitted recipients are:

- `jonahllarson@gmail.com`
- `Kimberlydayanara08@gmail.com` (normalized case-insensitively)

The UI limits selection to those recipients and the server enforces the same
allowlist. Deliveries are idempotent and limited to five per recipient per
workspace in a rolling 15-minute window. The sandbox email key must be distinct
from `EMAIL_API_KEY`.

## Kill switch

An active admin who satisfies the configured MFA requirement can use the
`Demo` tab in the admin dashboard. Disabling the demo updates the isolated
control row through the authenticated server-to-server channel. Demo layouts
and every demo API check that row and return a non-sensitive 404 while disabled.

If the demo backend or control row is unavailable, the public demo fails closed.
