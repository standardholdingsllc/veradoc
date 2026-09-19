# VeraDoc subdomain transition decisions

## SD-DEC-001 — Demo remains in the shared deployment for phase one

- Date: 2026-09-14
- Owner: VeraDoc engineering
- Work package: WP-6
- Problem: Decide whether `demo.veradoc.pe` can safely share the production Next.js deployment.
- Chosen option: Keep one deployment. Demo state remains synthetic and browser-local, production authentication cookies remain host-scoped, and Proxy rejects every non-GET/HEAD request on the demo hostname.
- Rejected options: An immediate second Vercel project, because the present demo does not require service-role access, production storage, or real provider mutations.
- Security impact: Demo cannot submit Server Actions, webhook requests, payments, uploads, or provider mutations through its hostname.
- Authentication/cookie impact: No parent-domain cookies and no production auth routes on demo.
- Generated-link impact: Demo links use clean paths on `demo.veradoc.pe`.
- External-system impact: None.
- Migration compatibility: Legacy `/demo/**` GET/HEAD paths temporarily redirect to the demo hostname.
- Observability: Host-routing decisions use sanitized path families only.
- Rollback: Set `HOST_ROUTING_MODE=off` and promote the preceding deployment. Keep the domain assigned.
- Required tests: Demo rewrites, internal-prefix cleanup, production-token isolation, and mutation rejection.
- Follow-up trigger: Split the deployment before demo gains service-role access, persistent accounts, production storage, or any real provider integration.

## SD-DEC-002 — Admin uses Supabase TOTP AAL2

- Date: 2026-09-14
- Owner: VeraDoc engineering
- Work package: WP-5
- Problem: The admin hostname is not an authorization control.
- Chosen option: Require the trusted active `admin` role plus Supabase TOTP assurance level `aal2` for admin page data and privileged mutations when `ADMIN_MFA_REQUIRED=true`.
- Rejected options: Hostname obscurity and a domain-wide deployment password.
- Security impact: Admin password compromise alone is insufficient for privileged access.
- Authentication/cookie impact: The AAL2 session remains host-scoped to `admin.veradoc.pe`.
- Generated-link impact: Admin role navigation targets `https://admin.veradoc.pe/`.
- External-system impact: Existing admins must enroll a TOTP authenticator.
- Migration compatibility: The enforcement flag is disabled for local examples and enabled in production.
- Observability: MFA failures return non-sensitive user-facing errors.
- Rollback: Set `ADMIN_MFA_REQUIRED=false` only as an incident action, then redeploy.
- Required tests: Admin route isolation, role mismatch, and AAL2 guard tests.
- Follow-up trigger: Consider a separate deployment before adding impersonation, bulk export, arbitrary support queries, or secret management.

## SD-DEC-003 — Infrastructure endpoints stay on the apex

- Date: 2026-09-14
- Owner: VeraDoc engineering
- Work package: WP-2 / WP-7
- Problem: Existing webhook and cron POSTs must not be cross-host redirected.
- Chosen option: Keep `/api/webhooks/firmeasy`, `/api/webhooks/mercadopago`, and `/api/internal/notification-outbox/process` on `veradoc.pe`; also permit exact Vercel deployment hosts for platform cron execution. Reject APIs on app, notary, admin, and demo hosts.
- Rejected options: Blindly redirecting APIs to the apex.
- Security impact: Provider signature and cron-secret validation remain authoritative in each Route Handler.
- Authentication/cookie impact: None.
- Generated-link impact: None.
- External-system impact: No provider URL changes are required for this phase.
- Migration compatibility: Existing webhook registrations remain valid.
- Observability: Wrong-host mutations receive a non-sensitive 404.
- Rollback: Set `HOST_ROUTING_MODE=off`.
- Required tests: API host matrix and no-redirect mutation assertions.
- Follow-up trigger: Revisit only with a provider-specific migration and replay plan.

## SD-DEC-004 — Temporary legacy redirects remain for 30 days

- Date: 2026-09-14
- Owner: VeraDoc engineering
- Work package: WP-3 / WP-4 / WP-7
- Problem: Signing links and the former notary invitation links required migration compatibility when this decision was adopted.
- Chosen option: Use 307 redirects for ordinary legacy signing GET/HEAD paths for 30 days and retain narrowly scoped apex callback compatibility. The invitation portion of this decision is superseded by SD-DEC-007; retired invite URLs no longer redirect. Never redirect wrong-host mutations.
- Rejected options: Immediate removal and permanent 308 redirects.
- Security impact: Token-bearing query strings are neither logged nor emitted in telemetry.
- Authentication/cookie impact: Legacy apex callbacks may require a fresh login on the canonical host because sessions remain host-scoped.
- Generated-link impact: All newly generated links use typed canonical origins immediately.
- External-system impact: Supabase exact callback allowlisting remains a release prerequisite.
- Migration compatibility: Signing tokens receive more than a three-week safety margin. Historical invitation compatibility ended only after production inventory confirmed no pending invitation rows or profileless invited users.
- Observability: Redirect reason codes omit raw paths for token-bearing families.
- Rollback: Set `HOST_ROUTING_MODE=off`; do not remove domains.
- Required tests: Fresh links, legacy links, callback handling, query preservation, and no cross-host POST redirects.
- Follow-up date or trigger: Review removal on 2026-10-14 after outstanding-link and callback metrics are clear.

## SD-DEC-005 — No cross-origin session handoff or parent-domain cookie

- Date: 2026-09-14
- Owner: VeraDoc engineering
- Work package: WP-3 / WP-4 / WP-5
- Problem: Sessions do not follow redirects between app, notary, and admin origins.
- Chosen option: Keep host-only Supabase cookies. If a user authenticates on the wrong portal, sign out the just-created session and direct them to authenticate on the correct origin.
- Rejected options: A parent-domain cookie and an improvised session handoff token.
- Security impact: Demo never receives production authentication cookies.
- Authentication/cookie impact: Users authenticate separately on their role's canonical portal.
- Generated-link impact: Role targets include both surface and public path.
- External-system impact: Supabase must allow the exact app and notary callback URLs.
- Migration compatibility: Legacy callback compatibility is time-bounded by SD-DEC-004.
- Observability: Wrong-surface errors contain no credentials or token values.
- Rollback: Set `HOST_ROUTING_MODE=off`.
- Required tests: Role-to-surface routing and host-only browser-cookie checks.
- Follow-up trigger: Any SSO request requires a separate reviewed security design.

## SD-DEC-006 — Commercial accounting remains gated until its schema rollout

- Date: 2026-09-15
- Owner: VeraDoc engineering
- Work package: WP-5
- Problem: The production admin dashboard loaded commercial-accounting queries whose required migration was not applied, causing the entire post-MFA Server Component to fail.
- Chosen option: Add a server-only, default-off `COMMERCIAL_ACCOUNTING_ENABLED` gate. While disabled, the admin dashboard skips the unsupported payout and finance queries, hides payout, finance, and refund controls, and rejects their Server Actions after admin/MFA authorization but before any RPC or provider call.
- Rejected options: Applying `20260910160000_commercial_accounting.sql` as an emergency admin fix, because it changes pricing, production data, refund and payout behavior, finance authority, and archival policy.
- Security impact: Hiding controls is not treated as authorization; every dependent Server Action independently fails closed while the gate is disabled.
- Authentication/cookie impact: None. The existing active-admin and TOTP AAL2 requirements remain unchanged.
- Generated-link impact: None.
- External-system impact: None while disabled. The migration and enabling the flag require a separate approved production rollout.
- Migration compatibility: The gate may be enabled only after the migration is deliberately reviewed, applied, and verified in the target environment.
- Observability: Disabled actions return a stable non-sensitive unavailable message. No schema error details or provider credentials are exposed.
- Rollback: Promote the preceding application deployment. No database rollback is needed because this decision does not apply the migration.
- Required tests: Default-off environment parsing, hidden commercial tabs, skipped schema queries, and fail-closed payout, finance, refund, and reconciliation actions.
- Follow-up trigger: Review the full migration with database backup, data-impact validation, provider safety, and a forward-recovery plan before enabling commercial accounting.

## SD-DEC-007 — Exclusive notary is operationally provisioned

- Date: 2026-09-18
- Owner: VeraDoc engineering
- Work package: WP-4 / WP-5 / WP-7
- Problem: The MVP has one exclusive notary, so a product mechanism for inviting additional notaries conflicts with the operating model and expands the authentication attack surface.
- Chosen option: Retire the notary invitation UI, email, actions, acceptance route, callback parameter, database table, RPC, and `profiles.invited_by`. The exclusive account remains password-authenticated and operationally provisioned. Adding or replacing it requires separately authorized operations or a future product change.
- Rejected options: Keeping a hidden admin action, retaining legacy redirects, or relying on Supabase's generic invite-user capability as a VeraDoc workflow.
- Security impact: `/auth/invite/**` and callbacks containing `invitation` fail closed before session exchange, cookie creation, or cross-host redirect.
- Authentication/cookie impact: Existing notary password login is unchanged and remains host-scoped.
- Generated-link impact: No notary onboarding link exists. Notary packet links continue to target `notario.veradoc.pe`.
- External-system impact: Remove the custom invitation template and invitation-specific Resend automation while preserving SMTP, confirmation, magic-link, and recovery flows.
- Migration compatibility: Deploy application removal first with the legacy schema retained; after production stability, apply a forward-only schema removal. Rollback after the schema migration means redeploying the first removal release.
- Observability: Retired paths return a generic 404 and no token or query string is logged.
- Rollback: Before schema removal, redeploy the preceding application. After schema removal, redeploy the first removal release; restoring invitations requires database restoration and an approved product reversal.
- Required tests: Host/method matrix for retired routes, callback pre-exchange rejection, absence of cookies/redirects, existing notary password login, and schema-object absence.
- Follow-up trigger: Any request for a second or replacement notary requires explicit product, security, operations, and migration review.
