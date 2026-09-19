# VeraDoc Subdomain Transition — Agent Execution Guide

Status: Proposed implementation guide
Audience: Coding agents, reviewers, security reviewers, and release operators
Applies to: The `veradoc` Next.js application and its Vercel deployment
Last reviewed against repository state: 2026-09-14

## 1. Purpose and authority

This document is the normative execution guide for transitioning VeraDoc from a path-only application served primarily from `veradoc.pe` to a hostname-aware application with these public surfaces:

- `veradoc.pe`: public marketing and legal website.
- `app.veradoc.pe`: realtor, landlord, renter, document-upload, evidence, and signing workflows.
- `notario.veradoc.pe`: notary dashboard and notarial review/certification workflows.
- `admin.veradoc.pe`: internal VeraDoc administration and developer operations.
- `demo.veradoc.pe`: simulated product demonstration.

This is an instruction and planning artifact. It does not itself authorize an agent to modify application code, Supabase settings, Vercel settings, DNS, identity-provider settings, production data, or third-party webhook configuration. An agent must receive implementation authorization for the relevant work package before making those changes.

The repository-level `AGENTS.md` remains authoritative. In particular, this project uses Next.js 16. Agents must read the relevant documents in `node_modules/next/dist/docs/` before writing Next.js code and must follow current bundled guidance rather than relying on remembered behavior from earlier Next.js versions.

When instructions conflict, apply this order:

1. The current user request and platform safety requirements.
2. `AGENTS.md`.
3. This guide.
4. Existing planning documents.
5. Local conventions inferred from nearby implementation.

Normative terms in this guide have their conventional meanings:

- **MUST** and **MUST NOT** are release-blocking requirements.
- **SHOULD** and **SHOULD NOT** require a documented reason to deviate.
- **MAY** identifies an acceptable option.

## 2. Executive architecture decision

The initial transition SHOULD retain one Git repository, one Next.js application, and one Vercel production project. Hostname-aware routing will present separate product surfaces while reusing the current App Router filesystem routes.

This decision deliberately separates public URL design from deployment isolation:

- A hostname is a product and navigation boundary.
- A hostname is not, by itself, an authorization boundary.
- Proxy routing is an early request filter, not the final authorization layer.
- Supabase Row Level Security, server-side role checks, ownership checks, Server Action checks, and Route Handler checks remain authoritative.
- `demo` and `admin` have explicit gates for later or immediate deployment isolation.

Do not split all five surfaces into independent applications during the first routing change. That would combine a URL migration with build decomposition, environment separation, session redesign, and deployment orchestration. Those are separate decisions and should be made after hostname behavior is proven.

### 2.1 Target public URL contract

The desired public paths avoid redundant prefixes where a hostname already establishes the surface.

| Surface | Public URL examples | Existing internal App Router destination |
| --- | --- | --- |
| Marketing | `https://veradoc.pe/`, `/precios`, `/como-funciona`, `/privacidad`, `/terminos`, `/devoluciones`, `/libro-de-reclamaciones`, `/evidencia`, `/posicionamiento-legal` | Existing marketing routes with the same pathname |
| Customer application | `https://app.veradoc.pe/agente`, `/arrendador`, `/arrendatario`, `/firma/{token}`, `/auth/...` | Existing routes with the same pathname |
| Notary | `https://notario.veradoc.pe/`, `/perfil`, `/paquetes/{packetId}`, `/historial`, `/ganancias`, `/auth/...` | `/notario`, `/notario/perfil`, `/notario/paquetes/{packetId}`, `/notario/historial`, `/notario/ganancias`, `/auth/...` |
| Admin | `https://admin.veradoc.pe/`, `/auth/...`, and future clean admin-relative paths | `/admin`, `/auth/...`, and `/admin/...` |
| Demo | `https://demo.veradoc.pe/`, `/registro`, `/agente`, `/arrendador`, `/arrendatario`, `/notario`, `/firma/{token}` | `/demo`, `/demo/registro`, `/demo/agente`, `/demo/arrendador`, `/demo/arrendatario`, `/demo/notario`, `/demo/firma/{token}` |

`www.veradoc.pe` SHOULD have one canonical redirect to `https://veradoc.pe`. No authenticated application surface should be served from `www`.

The internal destination is an implementation detail. Browser-visible links, email links, callback URLs, canonical metadata, analytics, and user-facing copy MUST use the public URL contract.

### 2.2 Why customer roles remain together

Realtors, landlords, renters, and signing participants share a transaction lifecycle. They SHOULD remain on `app.veradoc.pe` because:

- Signing links move parties into the same evidence packet.
- Account creation can occur during the signing flow.
- Document upload, review, identity, consent, signing, completion, and later dashboard access are connected steps.
- Keeping these steps on one origin avoids unnecessary cookie, storage, callback, CORS, and navigation transitions.

Do not introduce `agente.veradoc.pe`, `arrendador.veradoc.pe`, or `arrendatario.veradoc.pe` as part of this work.

## 3. Current repository baseline

Agents MUST confirm this baseline before implementing a work package because the repository may evolve after this guide is written.

At the time of this guide:

- The application uses Next.js `16.2.6` and React `19.2.4`.
- The project has one root `proxy.ts`.
- Route groups under `app/(dashboard)` and `app/(signing)` do not appear in public URLs.
- Production dashboard roots are `/admin`, `/agente`, `/notario`, `/arrendador`, and `/arrendatario`.
- Signing routes are under `/firma/[token]`.
- Demo routes are under `/demo`.
- Authentication routes are under `/auth`.
- `lib/auth/constants.ts` maps each production role to a pathname, not to a hostname-and-path target.
- `proxy.ts` performs path-based optimistic authentication and role routing.
- `proxy.ts` currently matches selected dashboard and auth paths rather than all hostname-routed pages.
- `lib/supabase/proxy.ts` copies Supabase cookie options but does not deliberately set a parent-domain cookie.
- Several services derive one base URL from `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, or `VERCEL_URL`.
- Production signing links are built from a single site URL.
- Notary packet links are built for the notary surface.
- Some browser copy-link behavior uses `window.location.origin`.
- Vercel currently associates the requested subdomains with the same latest production deployment.

Known URL-generation hotspots include, but are not limited to:

- `lib/env/server.ts`
- `lib/utils/url.ts`
- `lib/auth/actions.ts`
- `lib/admin/actions.ts`
- `lib/actions/agente-actions.ts`
- `lib/services/notifications.ts`
- `app/auth/callback/route.ts`
- `components/agente/wizard-client.tsx`
- `app/demo/agente/nuevo-paquete/page.tsx`
- `components/signing/use-signer-context.ts`
- Any component containing hard-coded `/admin`, `/notario`, `/demo`, `/firma`, `/agente`, `/arrendador`, or `/arrendatario` links.

Before changing code, run read-only inventory commands such as:

```powershell
git status --short
rg --files app lib components __tests__
rg -n "SITE_URL|NEXT_PUBLIC_SITE_URL|VERCEL_URL|window\.location\.origin|redirectTo|emailRedirectTo" app lib components
rg -n "'/admin|\"/admin|'/notario|\"/notario|'/demo|\"/demo|'/firma|\"/firma" app lib components
```

Never print `.env.local`, Vercel tokens, Supabase secret keys, webhook secrets, signing tokens, or cookies during inventory.

## 4. Required vocabulary and conceptual model

Agents MUST use these concepts consistently.

### 4.1 Origin

An origin is scheme, hostname, and port. `https://app.veradoc.pe` and `https://notario.veradoc.pe` are different origins even though they are same-site subdomains.

Browser storage, CORS, service workers, and many redirect rules are origin-specific. Cookie behavior depends on cookie attributes and is not equivalent to local-storage behavior.

### 4.2 Surface

A surface is one of:

```text
marketing | app | notary | admin | demo | preview | local | unknown
```

Surface classification MUST be performed by a pure, deterministic function that is separately unit tested. Do not scatter string comparisons against hostnames throughout Proxy, Server Actions, and components.

### 4.3 Public path

The browser-visible path for a surface. For example, the public notary dashboard path is `/`, not `/notario`.

### 4.4 Internal path

The filesystem-facing destination used by an internal rewrite. For example, public `https://notario.veradoc.pe/paquetes/123` maps internally to `/notario/paquetes/123`.

### 4.5 Canonical target

A typed pair of surface and public path:

```ts
type Surface = "marketing" | "app" | "notary" | "admin" | "demo";

type PublicTarget = {
  surface: Surface;
  path: `/${string}`;
};
```

Role-based navigation MUST resolve to a `PublicTarget`, not just a pathname.

### 4.6 Rewrite versus redirect

- A rewrite changes the internal route without changing the browser URL.
- A redirect tells the browser to navigate to a different URL.
- Use internal rewrites to remove redundant internal prefixes from public notary, admin, and demo URLs.
- Use redirects to canonicalize a request that arrived on the wrong hostname or on a legacy public path.

Do not use redirects for wrong-host mutation requests. Next.js uses 307/308 redirects, which preserve the HTTP method and body. A cross-host POST redirect can unintentionally replay a mutation against a different origin.

## 5. Non-negotiable invariants

Every implementation and review MUST verify these invariants.

### SD-INV-001 — Marketing isolation

`veradoc.pe` serves public marketing/legal content and explicitly supported infrastructure endpoints. It MUST NOT render authenticated dashboards, signing pages, demo pages, or authentication forms as successful page responses.

Legacy GET/HEAD requests may redirect to the proper hostname during migration. Non-idempotent requests MUST fail closed.

### SD-INV-002 — Customer application scope

`app.veradoc.pe` may serve:

- `/agente/**`
- `/arrendador/**`
- `/arrendatario/**`
- `/firma/**`
- Customer-relevant `/auth/**`
- Explicitly approved application APIs and assets

It MUST NOT render the admin, production notary, or demo route trees.

### SD-INV-003 — Notary scope

`notario.veradoc.pe` exposes clean public paths that rewrite internally to `/notario/**`, plus the notary-relevant authentication flow. It MUST NOT expose customer dashboards, admin pages, or demo pages.

### SD-INV-004 — Admin scope

`admin.veradoc.pe` exposes only the internal administration surface, its authentication requirements, and explicitly approved supporting endpoints. It MUST NOT become a general alternate hostname for the full application.

### SD-INV-005 — Demo isolation

`demo.veradoc.pe` exposes only demo behavior and safe static dependencies. Demo requests MUST NOT:

- Mutate production business tables.
- Charge or refund real payments.
- Send real email, WhatsApp, or SMS messages.
- Invoke production FirmEasy or other signing-provider operations.
- Perform real notarial sealing or tax-document issuance.
- Consume a real production signing token.
- Invoke privileged production Server Actions merely because the code shares a deployment.

### SD-INV-006 — Host-scoped sessions

Authentication cookies MUST remain host-scoped unless a separately approved security design changes this policy.

Do not set `Domain=.veradoc.pe` on authentication cookies. A parent-domain cookie would be sent to every subdomain, including `demo.veradoc.pe`, and a browser cannot exclude one child subdomain from a parent-domain cookie.

### SD-INV-007 — Proxy is not authorization

Proxy checks are optimistic routing and early rejection only. Every Server Action, Route Handler, data-access function, storage operation, and privileged RPC MUST perform its own authentication, status, role, packet-ownership, and business-state authorization as applicable.

### SD-INV-008 — Absolute URLs are typed by surface

No production email, callback, signing link, payment redirect, webhook registration, or copied user link may derive from a generic site URL when the destination surface is known.

### SD-INV-009 — Tokens are never logged

Raw signing tokens, OAuth codes, password-recovery codes, cookie values, authorization headers, and complete query strings on token-bearing routes MUST NOT be logged.

### SD-INV-010 — Unknown hosts fail closed

An unrecognized production hostname MUST receive a non-sensitive failure response. It MUST NOT silently fall back to the marketing site or application.

Localhost and Vercel preview behavior must be explicit and environment-aware rather than implemented as a permissive unknown-host fallback.

### SD-INV-011 — Canonical host decisions are method-aware

- GET and HEAD may receive canonical redirects.
- POST, PUT, PATCH, and DELETE on the wrong host MUST NOT be redirected across hosts.
- Wrong-host mutations SHOULD return `404` to minimize route disclosure, or a documented `421 Misdirected Request` if operational diagnostics require it.
- Server Actions MUST still authorize themselves even when the originating page was correctly routed.

### SD-INV-012 — Signing links survive migration; retired notary invites fail closed

Previously issued production signing links MUST continue to work for at least their maximum valid lifetime plus a documented safety margin. Retired `/auth/invite/**` URLs and callbacks containing an obsolete `invitation` parameter MUST return a non-sensitive failure before session exchange, cookie creation, or cross-host redirect.

## 6. Hostname and route policy

Implement one central route policy. The precise module names may vary, but the recommended structure is:

```text
lib/routing/
  origins.ts          validated origin configuration
  surfaces.ts         Surface types and host classification
  policy.ts           allowed public path families by surface
  rewrites.ts         public-to-internal path mapping
  targets.ts          role and business-event PublicTarget builders
  legacy.ts           old-path to canonical-host migration map
  index.ts            narrow public exports
proxy.ts              request orchestration and Supabase refresh
```

Keep `proxy.ts` small. Next.js supports one root Proxy file, but its logic can and should be split into testable modules.

### 6.1 Host normalization

The classifier MUST:

1. Read the framework-normalized request hostname where possible.
2. Lowercase it.
3. Remove a development port only when parsing a valid host-and-port value.
4. Reject invalid host syntax.
5. Handle an optional trailing DNS dot consistently.
6. Match exact production hosts.
7. Match explicitly configured local-development hosts.
8. Recognize Vercel preview hosts only in preview/development environments.
9. Return `unknown` for everything else.

Do not trust an arbitrary client-supplied `x-forwarded-host` in a self-hosted environment. On Vercel, use the request representation documented for the installed Next.js version. If deployment architecture changes, re-evaluate the trusted proxy boundary.

### 6.2 Recommended route decision order

The request pipeline SHOULD follow this order:

1. Normalize method, hostname, pathname, and environment.
2. Allow Next.js static assets needed by all valid surfaces.
3. Handle well-known infrastructure paths explicitly.
4. Classify APIs separately from page routing.
5. Reject unknown production hosts.
6. Detect a legacy or wrong-host page request.
7. Redirect only if the request is GET or HEAD.
8. Reject wrong-host non-idempotent requests without redirecting.
9. Rewrite clean notary/admin/demo public paths to internal filesystem paths.
10. Create the Supabase-aware response used for session refresh.
11. Apply optimistic authentication and role navigation.
12. Preserve all `Set-Cookie` headers when converting the response into a redirect or rewrite.
13. Return the final response with surface-appropriate security and indexing headers.

The implementation MUST account for Next.js execution order: configured headers and redirects run before Proxy; Proxy runs before configured rewrites and filesystem routing. Do not create overlapping rules in `next.config.ts` and `proxy.ts` without tests that prove precedence.

Authorization routing MUST evaluate the derived surface and canonical internal destination, not only the browser-visible pathname. For example, `/paquetes/123` on `notario.veradoc.pe` requires the notary role even though the original pathname does not begin with `/notario`. Compute one request-routing context and reuse it through canonicalization, rewrite selection, and optimistic role checks so these stages cannot disagree.

### 6.3 Matchers

Hostname classification cannot work reliably if Proxy only matches the current protected path prefixes. The transition will probably require a broader constant matcher that excludes only carefully reviewed framework/static resources.

Matcher values MUST be compile-time constants. Agents MUST test:

- The exact matcher coverage for every page surface.
- `_next/static` and `_next/image` behavior.
- Icons, manifests, robots, sitemap, and public files.
- API paths.
- RSC and prefetch requests.
- Server Action POSTs on protected routes.

Do not assume excluding `_next/data` or a visual page path removes all security-relevant framework requests. Use the testing utilities bundled with the installed Next.js release.

### 6.4 Public-to-internal rewrites

Rewrites SHOULD preserve query parameters and MUST preserve dynamic path segments exactly.

Examples:

```text
notario.veradoc.pe/                         -> internal /notario
notario.veradoc.pe/perfil                   -> internal /notario/perfil
notario.veradoc.pe/paquetes/abc             -> internal /notario/paquetes/abc
notario.veradoc.pe/paquetes/abc/certificar  -> internal /notario/paquetes/abc/certificar

admin.veradoc.pe/                           -> internal /admin

demo.veradoc.pe/                            -> internal /demo
demo.veradoc.pe/agente                      -> internal /demo/agente
demo.veradoc.pe/firma/example-token         -> internal /demo/firma/example-token
```

The router MUST avoid double-prefix results such as `/notario/notario/...` or `/demo/demo/...`. It MUST also define what happens when a user explicitly requests an internal prefix on its canonical host. The recommended behavior is a GET/HEAD redirect to the clean public path and a failure for non-idempotent methods.

### 6.5 Legacy path redirects

During migration, preserve old public paths:

```text
veradoc.pe/agente/**       -> app.veradoc.pe/agente/**
veradoc.pe/arrendador/**   -> app.veradoc.pe/arrendador/**
veradoc.pe/arrendatario/** -> app.veradoc.pe/arrendatario/**
veradoc.pe/firma/**        -> app.veradoc.pe/firma/**
veradoc.pe/notario         -> notario.veradoc.pe/
veradoc.pe/notario/**      -> notario.veradoc.pe/**
veradoc.pe/admin           -> admin.veradoc.pe/
veradoc.pe/admin/**        -> admin.veradoc.pe/**
veradoc.pe/demo            -> demo.veradoc.pe/
veradoc.pe/demo/**         -> demo.veradoc.pe/**
veradoc.pe/auth/login      -> app.veradoc.pe/auth/login
veradoc.pe/auth/signup     -> app.veradoc.pe/auth/signup
```

Do not put `/auth/callback` into this generic redirect table. It may contain single-use credentials and origin-bound state; follow the compatibility requirements in section 7.4.1. Retired `/auth/invite/**` paths are rejected on every host.

Start migration redirects as temporary `307` responses unless product and operations explicitly approve permanent caching. Promote stable GET/HEAD mappings to `308` only after:

- Authentication callbacks work on every destination.
- All email and message templates emit new URLs.
- Old signing links have been tested.
- Analytics show no unexplained redirect loops or failures.
- Rollback no longer depends on browsers forgetting a permanent redirect.

Preserve path segments and query parameters. Do not include sensitive query values in logs or metrics.

## 7. Authentication and session design

Authentication is the highest-risk part of this transition.

### 7.1 Chosen session policy

Use host-scoped Supabase session cookies. Do not create a domain-wide SSO cookie during this transition.

This means a session established on `app.veradoc.pe` is not automatically available on `notario.veradoc.pe` or `admin.veradoc.pe`. The UX and auth actions MUST be designed around this property.

### 7.2 Login surface policy

Each privileged role should authenticate on its canonical surface:

| Role | Canonical login origin | Canonical dashboard target |
| --- | --- | --- |
| `admin` | `admin.veradoc.pe` | `admin.veradoc.pe/` |
| `notary` | `notario.veradoc.pe` | `notario.veradoc.pe/` |
| `realtor` | `app.veradoc.pe` | `app.veradoc.pe/agente` |
| `landlord` | `app.veradoc.pe` | `app.veradoc.pe/arrendador` |
| `renter` | `app.veradoc.pe` | `app.veradoc.pe/arrendatario` |

Do not authenticate a user on one origin and then simply redirect them to another origin; the host-scoped session cookie will not follow.

For password login, choose and document one of these safe behaviors:

1. Prevent role-inappropriate login on the current surface, sign out any just-created session, and direct the user to reauthenticate on the correct origin.
2. Implement a short-lived, single-use, server-generated cross-origin session handoff that is cryptographically bound to destination, user, nonce, and expiry, and is redeemed server-side on the destination.

Option 1 is the required initial behavior. Option 2 is a separate security project and MUST NOT be improvised inside this migration.

Auth routes MUST be allowlisted per surface rather than granting every hostname the entire `/auth/**` tree:

| Surface | Initially allowed auth routes |
| --- | --- |
| Application | `/auth/login`, `/auth/signup`, `/auth/callback`, `/auth/pending-approval`, `/auth/rejected`, and only other customer flows proven necessary |
| Notary | `/auth/login`, `/auth/callback`, and only other notary flows proven necessary |
| Admin | `/auth/login`; `/auth/callback` only if the approved admin identity mechanism requires it |
| Marketing | No canonical auth UI; ordinary legacy GET/HEAD auth pages may redirect to the application surface during migration |
| Demo | No production authentication routes |

Do not expose public realtor signup on the notary or admin hostname merely because the same filesystem route exists.

### 7.3 Role navigation must become cross-origin aware

The current `getDashboardForRole()` returns only a pathname. Introduce a typed role target abstraction before enabling host enforcement.

Conceptually:

```ts
const ROLE_TARGETS = {
  admin: { surface: "admin", path: "/" },
  notary: { surface: "notary", path: "/" },
  realtor: { surface: "app", path: "/agente" },
  landlord: { surface: "app", path: "/arrendador" },
  renter: { surface: "app", path: "/arrendatario" },
} satisfies Record<ProfileRole, PublicTarget>;
```

Do not mechanically replace all path-returning functions. Distinguish:

- Internal route destinations used after rewrites.
- Same-origin relative navigation.
- Absolute cross-origin navigation.
- Email/message URLs.
- Auth-provider callback URLs.

### 7.4 Supabase redirect allowlist

Before cutover, configure exact production redirect URLs required by real flows. At minimum, inventory and validate:

```text
https://app.veradoc.pe/auth/callback
https://notario.veradoc.pe/auth/callback
https://admin.veradoc.pe/auth/callback   # only if admin uses a callback-based flow
```

Production should use exact callback paths rather than a broad `https://*.veradoc.pe/**` wildcard. Preview and local-development patterns, if needed, must be separate and narrowly scoped.

The Supabase Site URL SHOULD represent the default end-user auth surface, normally `https://app.veradoc.pe`. Every flow that belongs on another surface MUST supply its explicit `redirectTo` or `emailRedirectTo`.

External dashboard configuration is a state-changing operation. An agent MUST obtain explicit authorization before changing it and must record the before/after allowlist without exposing secrets.

#### 7.4.1 Legacy auth callback compatibility

Legacy `/auth/callback` URLs require their own migration design. They are not ordinary pages. Retired `/auth/invite/[token]` URLs are no longer compatible routes and always fail closed.

If a Supabase code is exchanged on `veradoc.pe`, the resulting host-scoped cookies belong to `veradoc.pe`; redirecting afterward to `notario.veradoc.pe` or `app.veradoc.pe` does not move those cookies. Conversely, redirecting an unexchanged code to a different host may fail when the auth flow depends on a PKCE verifier or other browser state stored for the original origin. Agents MUST NOT assume either strategy works.

Before enforcing marketing-only apex behavior:

1. Determine whether unexpired emails contain apex callback URLs.
2. Classify each legacy flow: realtor confirmation, OAuth, password recovery, or signer account flow.
3. Determine whether that flow uses PKCE or other origin-bound browser state.
4. Reproduce the real legacy link in a production-like environment.
5. Choose an approved compatibility strategy.

Acceptable strategies include:

- Keep a narrowly scoped legacy callback compatibility route on the apex until all issued links expire, then require a fresh login on the canonical surface.
- Build the separately reviewed single-use session handoff described in section 7.2.

A generic apex-to-subdomain redirect carrying an auth code is not an acceptable untested strategy. Callback query strings must remain excluded from logs throughout compatibility handling.

### 7.5 Exclusive notary provisioning

VeraDoc has one exclusive notary account provisioned operationally outside the product. The product MUST expose no invitation UI, email, public route, callback branch, API, or database mechanism for adding a notary. Adding or replacing the account requires a separately authorized operational procedure or future product change.

The existing notary continues to use password login on `notario.veradoc.pe`. Requests to `/auth/invite/**` and callbacks containing `invitation` MUST fail closed before any Supabase exchange and MUST NOT create cookies or redirect credentials between hosts.

### 7.6 Realtor signup and OAuth

Realtor signup, confirmation, and OAuth return to `app.veradoc.pe`. Pending-approval and rejected states also live on the application origin unless product later creates surface-specific versions.

Every `redirectTo` and `emailRedirectTo` call MUST identify the intended surface explicitly. A generic base URL fallback is not acceptable in production.

### 7.7 Signer account creation

Landlord and renter account creation remains inside `app.veradoc.pe/firma/{token}/...`. The signing token state machine must not be reset or duplicated because of host routing.

Test at least:

- A fresh signing link.
- Resume at every supported signing state.
- OTP verification.
- Account creation.
- Consent.
- Identity capture.
- Review.
- Signature submission.
- Completion redirect.
- An expired token.
- A consumed token.
- A token copied from a legacy apex URL.

### 7.8 Authorization remains close to data

Next.js Proxy may reject a route early, but secure authorization must remain in the data-access and mutation layers. Reviewers MUST reject a change that says a Server Action is safe only because the page is unavailable on the wrong hostname.

For every privileged Server Action or Route Handler, verify:

1. A valid server-verified session exists.
2. Account status is active where required.
3. The role is authorized.
4. The user owns or is assigned to the target resource.
5. The packet/workflow state permits the transition.
6. Supabase RLS or an equivalent database guard provides defense in depth.
7. Host/origin validation is applied if the operation is surface-sensitive.

## 8. Origin configuration and URL construction

### 8.1 Replace ambiguous URL variables

The current repository contains both `SITE_URL` and `NEXT_PUBLIC_SITE_URL` patterns, plus `VERCEL_URL` fallbacks. The transition MUST establish one validated source of truth.

Recommended server environment schema:

```text
PUBLIC_ORIGIN=https://veradoc.pe
APP_ORIGIN=https://app.veradoc.pe
NOTARY_ORIGIN=https://notario.veradoc.pe
ADMIN_ORIGIN=https://admin.veradoc.pe
DEMO_ORIGIN=https://demo.veradoc.pe
HOST_ROUTING_MODE=off|shadow|enforce
```

Requirements:

- Parse each configured value with `new URL()` and schema validation.
- Require HTTPS in production.
- Reject credentials, fragments, query strings, and non-root pathnames in origin variables.
- Normalize trailing slashes once.
- Mark server-only configuration modules with `server-only`.
- Avoid exposing every origin as `NEXT_PUBLIC_*`; browser code should prefer relative navigation.
- If browser code must navigate across origins, provide a minimal validated public configuration or render the destination from the server.
- Never use `VERCEL_URL` to create durable production user links. It may be an explicit preview fallback only.

### 8.2 Typed URL builder

Create one URL builder that requires a destination surface:

```ts
buildAbsoluteUrl({ surface: "app", path: `/firma/${token}` })
buildAbsoluteUrl({ surface: "notary", path: `/paquetes/${packetId}` })
buildAbsoluteUrl({ surface: "admin", path: "/" })
```

The builder MUST:

- Accept only known surfaces.
- Require a leading-slash path.
- Resolve using the URL API, not string concatenation.
- Prevent a path beginning with `//` from replacing the intended hostname.
- Preserve only explicitly supplied query parameters.
- Encode query parameter values with `URLSearchParams`.
- Avoid decoding and re-encoding opaque raw tokens unnecessarily.
- Never accept a user-controlled absolute destination.

Create specialized helpers for high-risk links, such as:

```text
buildSigningEntryUrl(rawToken)
buildSigningCompletionUrl(rawToken)
buildNotaryPacketUrl(packetId)
buildAdminDashboardUrl()
```

These helpers make the intended surface reviewable at each call site.

### 8.3 Generated URL inventory

Agents MUST inventory and migrate all of these classes:

- Email links.
- WhatsApp links.
- Copy-to-clipboard links.
- QR-code payloads.
- Supabase auth redirects.
- Payment success/failure/pending redirects.
- FirmEasy redirect/callback links.
- Signing links.
- Dashboard notifications.
- Open Graph and canonical metadata.
- Webhook registration URLs.
- Cron invocation assumptions.
- Test fixtures and snapshots.

Search results are not proof of completeness. Add tests around the centralized builders so future call sites fail typechecking or linting if they use deprecated generic helpers.

## 9. Demo safety model

Demo is a trust boundary problem even when it is visually just another route tree.

### 9.1 Initial same-deployment requirements

If demo remains in the production deployment, all of these MUST be true before `demo.veradoc.pe` is promoted publicly:

- Demo state is synthetic and namespaced.
- Demo components do not import production mutation actions.
- Demo payment behavior is stubbed and cannot use production credentials.
- Demo messaging is stubbed or routed only to an explicit safe sink.
- Demo signing never submits to production providers.
- Demo uploads cannot enter production evidence buckets.
- Demo token shapes cannot be mistaken for production signing tokens.
- Host-aware server checks reject demo-origin requests to production-only mutations.
- The demo banner is always visible on demo workflows.
- Demo is `noindex, nofollow`.
- Analytics identify it as demo traffic without recording document or token data.

### 9.2 Mandatory split-deployment gate

Create a separate Vercel project and separate non-production backend before public launch if any of these are true:

- Demo needs service-role database access.
- It shares production storage buckets in a way that cannot be strongly namespaced.
- A demo action can trigger real external side effects.
- Product wants demo-specific release timing or intentionally unstable features.
- Sales demonstrations require persistent synthetic accounts or reusable credentials.
- The team cannot prove host-based action denial with automated tests.

If split, retain `demo.veradoc.pe` as the public contract and move the domain assignment only during an approved release window with a tested rollback.

## 10. Admin security model

`admin.veradoc.pe` is an address, not an access control.

Before exposing material admin functionality, require:

- A dedicated `admin` role stored only in trusted server-controlled metadata.
- Active-status verification on every privileged operation.
- Mandatory MFA or an external identity gate.
- A narrowly controlled admin membership process.
- Audit events for approvals, role changes, suspensions, refunds, signing overrides, evidence access, and configuration changes.
- Re-authentication or step-up verification for highly destructive operations.
- No client-provided role, user ID, packet owner, or approval status trusted without server verification.
- Rate limits for authentication and sensitive mutations.
- `noindex, nofollow` and an explicit `robots.txt` policy.
- A restrictive `frame-ancestors` CSP policy.

Consider moving admin to a separate Vercel project when it acquires any of the following:

- Secret or integration management.
- Database migrations or arbitrary support queries.
- User impersonation.
- Bulk exports of identity or document data.
- Destructive platform-wide actions.
- A release cadence distinct from the customer product.

Deployment separation reduces blast radius, but it does not replace application authorization or database policy.

## 11. APIs, webhooks, cron, and Server Actions

### 11.1 Do not route infrastructure blindly by page hostname

The repository currently contains webhook Route Handlers and a Vercel cron route. Page-host canonicalization MUST NOT accidentally redirect third-party POST requests.

Inventory every `app/api/**/route.ts` and classify it as:

- Public webhook with cryptographic verification.
- Vercel cron/internal endpoint with secret verification.
- Authenticated browser API.
- Private internal API.
- Unused or transitional endpoint.

Each endpoint MUST have an explicit host policy. If an existing provider is configured to call `veradoc.pe`, keep that host valid until the provider configuration is deliberately migrated.

### 11.2 Webhook requirements

Webhook handlers MUST:

- Avoid redirects.
- Verify signatures against the unmodified body when required.
- Be idempotent.
- Reject invalid content types and unreasonable payload sizes.
- Return stable response codes.
- Avoid logging secrets or entire payloads containing personal data.
- Not depend on a browser session cookie.

Changing a webhook URL requires explicit external-system authorization and a replay/rollback plan.

### 11.3 Cron requirements

The `/api/internal/notification-outbox/process` schedule in `vercel.json` must continue to resolve after Proxy matcher changes. The handler must authenticate using its expected cron secret/headers and must not rely solely on hostname.

### 11.4 Server Actions

Server Actions are handled as POST requests associated with the route that uses them. Matcher or route-tree changes can silently change Proxy coverage. Every action MUST authorize internally and SHOULD validate expected origin/host for sensitive surface-bound operations.

Never cross-host redirect a Server Action POST. Return a controlled error and let the client perform a fresh GET navigation if recovery is appropriate.

## 12. Security headers, browser behavior, and indexing

### 12.1 Baseline headers

Review and test, rather than blindly copy, a baseline containing:

- `Strict-Transport-Security` after confirming every included subdomain is HTTPS-only.
- `X-Content-Type-Options: nosniff`.
- A conservative `Referrer-Policy`.
- A `Permissions-Policy` denying unneeded browser capabilities.
- Content Security Policy with explicit `frame-ancestors`.

Signing and token-bearing routes SHOULD use the most restrictive viable referrer policy, normally `no-referrer`, to prevent token-bearing paths from being sent to third-party resources.

Do not add permissive wildcard CORS headers merely because the application now has subdomains. Same-site does not mean same-origin. Cross-origin browser requests should be exceptional, documented, narrowly allowed, and tested with credentials behavior.

### 12.2 Indexing policy

Only intentional marketing content should be indexable.

| Surface/path | Indexing policy |
| --- | --- |
| Marketing pages | Index according to product SEO policy |
| `app` dashboards and auth | `noindex, nofollow` |
| Signing routes | `noindex, nofollow` |
| Notary surface | `noindex, nofollow` |
| Admin surface | `noindex, nofollow` |
| Demo surface | `noindex, nofollow` unless product explicitly approves a public showcase page |

Canonical metadata MUST never identify an internal rewrite path such as `/notario/paquetes/...` as a public canonical URL.

### 12.3 Service workers and local storage

Service workers and local storage do not cross origins. If the application adds offline support, install prompts, cached PDF state, or browser-persisted workflow state, test each hostname independently.

Do not use local storage to transfer authentication or signing secrets between surfaces.

## 13. Implementation work packages

Agents SHOULD implement one work package per reviewable change. Do not combine the entire migration into one large patch.

### WP-0 — Baseline, decisions, and observability

Goal: Establish evidence before behavior changes.

Tasks:

1. Confirm all five Vercel domains and SSL status.
2. Capture current production routes and redirect behavior without recording personal data.
3. Inventory auth provider redirect allowlists.
4. Inventory issued-link maximum lifetimes.
5. Confirm retired notary invitation URLs and callback parameters fail closed.
6. Inventory webhooks, payment callbacks, cron, and third-party return URLs.
7. Decide whether demo remains same-deployment for phase one.
8. Decide initial admin MFA/access gate.
9. Define `HOST_ROUTING_MODE=off|shadow|enforce` semantics.

Exit criteria:

- No unresolved owner for Supabase, Vercel, payment, FirmEasy, and messaging configuration.
- Signing compatibility window is documented.
- Rollback owner and release window are named.

### WP-1 — Typed origins and URL builders

Goal: Remove the one-base-URL assumption without changing incoming routing.

Tasks:

1. Add validated server-only origin configuration.
2. Add `Surface`, `PublicTarget`, and typed URL builders.
3. Add role-to-public-target mapping while retaining internal pathname helpers where needed.
4. Migrate durable generated URLs one category at a time.
5. Deprecate generic production base URL helpers.
6. Update environment examples with placeholders only.

Required tests:

- All origins normalize correctly.
- Non-HTTPS production origins fail validation.
- Paths beginning `//` are rejected.
- Each role maps to the correct surface and path.
- Signing links always use `APP_ORIGIN`.
- Notary packet links always use `NOTARY_ORIGIN`.
- Preview fallbacks cannot leak into production links.

Exit criteria:

- Repository search finds no unauthorized durable-link use of generic `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`, or `window.location.origin`.
- Existing path-only runtime behavior still works.

### WP-2 — Pure hostname policy and shadow mode

Goal: Add testable classification and decisions before enforcement.

Tasks:

1. Implement pure host normalization and surface classification.
2. Implement route allowlists and public-to-internal mappings.
3. Implement method-aware canonical decisions.
4. Add local and preview behavior.
5. In `shadow` mode, preserve current responses while emitting safe aggregate decision telemetry.

Telemetry may include:

- Surface.
- Path family, not raw token-bearing path.
- Decision: allow, rewrite, redirect, reject.
- Reason code.
- HTTP method.
- Deployment environment.

Telemetry MUST NOT include raw query strings, cookies, tokens, request bodies, or document identifiers.

Exit criteria:

- Decision tests cover the full host/path/method matrix.
- Shadow telemetry shows no unexplained unknown-host production traffic.

### WP-3 — Application and signing cutover

Goal: Make `app.veradoc.pe` canonical for customer roles and active workflow.

Tasks:

1. Configure exact Supabase application callbacks.
2. Emit new signing links from all channels.
3. Canonicalize customer dashboards to `app`.
4. Canonicalize `/firma/**` to `app`.
5. Preserve legacy apex links.
6. Prove the approved legacy application callback behavior.
7. Test uploads and every signing-state transition.
8. Confirm payment/signing-provider redirects return to `app` where appropriate.

Exit criteria:

- Fresh and legacy signing links complete successfully.
- No cross-host POST redirect occurs.
- Renter, landlord, and realtor sessions remain stable through their workflows.

### WP-4 — Notary cutover

Goal: Make `notario.veradoc.pe` canonical with clean public paths.

Tasks:

1. Configure the exact notary auth callback required by supported non-invitation flows.
2. Prove retired invite paths and invitation-bearing callbacks fail closed on every host.
3. Add notary public-to-internal rewrites.
4. Migrate notary links and navigation to public paths.
5. Redirect legacy apex notary dashboard GET/HEAD routes.
6. Exercise password login, packet queue, detail, certification, history, profile, and earnings flows.

Exit criteria:

- The exclusive notary establishes a password session on the notary hostname.
- Notary navigation never exposes a redundant `/notario` prefix.
- Notary actions remain server-authorized.

### WP-5 — Admin cutover and hardening

Goal: Make `admin.veradoc.pe` canonical and materially harden privileged access.

Tasks:

1. Add admin clean-path rewrites.
2. Add role-appropriate login behavior.
3. Enforce MFA or approved identity gate.
4. Add/verify privileged audit events.
5. Redirect legacy admin GET/HEAD routes.
6. Deny admin routes on every other hostname.
7. Test suspended, inactive, and wrong-role accounts.

Exit criteria:

- No admin mutation depends solely on Proxy or hidden UI.
- Wrong-host and wrong-role tests pass.
- Audit evidence is available for every privileged state change in scope.

### WP-6 — Demo cutover or isolation

Goal: Serve only demonstrative behavior from `demo.veradoc.pe`.

Tasks:

1. Complete the demo safety gate in section 9.
2. Add clean demo rewrites.
3. Convert demo navigation and copied links to public demo paths.
4. Deny demo routes on all other hosts.
5. Deny production mutations from demo origin.
6. Apply noindex and unmistakable demo labeling.
7. Split deployment first if any mandatory isolation criterion is met.

Exit criteria:

- Automated negative tests prove demo cannot trigger production side effects.
- Demo signing tokens cannot enter the production signing flow.

### WP-7 — Apex cleanup and canonicalization

Goal: Make the marketing surface unambiguous.

Tasks:

1. Confirm all generated links use new origins.
2. Keep compatibility redirects for the approved duration.
3. Redirect `www` to the chosen apex canonical host.
4. Verify canonical metadata and robots behavior.
5. Move stable temporary redirects to permanent only after rollback approval.

Exit criteria:

- Apex serves no authenticated page successfully.
- Search and analytics show expected canonical behavior.
- No valid outstanding link class is stranded.

### WP-8 — Optional deployment separation

Goal: Split admin and/or demo only when justified by the gates above.

This requires a separate architecture decision covering:

- Repository/monorepo layout.
- Shared package boundaries.
- Environment and secret ownership.
- Supabase project and schema strategy.
- Domain reassignment order.
- Independent build/deploy pipelines.
- Cross-project callbacks and webhook ownership.
- Rollback.

Do not perform WP-8 opportunistically while fixing hostname routing.

## 14. Required automated test matrix

### 14.1 Pure unit tests

Add table-driven tests for:

- Host normalization.
- Surface classification.
- Localhost with ports.
- Preview host classification.
- Unknown and malicious host forms.
- Public-to-internal rewrites.
- Internal-prefix cleanup.
- Legacy canonical targets.
- Method-aware redirect/reject behavior.
- Role-to-surface mapping.
- Absolute URL construction.

### 14.2 Proxy tests

Use the utilities available in the installed Next.js version, including `unstable_doesProxyMatch`, rewrite inspection, and redirect inspection where appropriate.

Test at minimum:

| Host | Path | Method | Expected result |
| --- | --- | --- | --- |
| `veradoc.pe` | `/precios` | GET | Marketing response |
| `veradoc.pe` | `/firma/t` | GET | Temporary redirect to `app` |
| `veradoc.pe` | `/firma/t` | POST | Reject, never redirect |
| `app.veradoc.pe` | `/agente` | GET | App route plus auth policy |
| `app.veradoc.pe` | `/admin` | GET | Reject or canonical redirect according to policy; never render admin |
| `notario.veradoc.pe` | `/` | GET | Rewrite to `/notario` |
| `notario.veradoc.pe` | `/paquetes/p` | GET | Rewrite to `/notario/paquetes/p` |
| `notario.veradoc.pe` | `/notario/paquetes/p` | GET | Redirect to clean path |
| `admin.veradoc.pe` | `/` | GET | Rewrite to `/admin` |
| `demo.veradoc.pe` | `/firma/t` | GET | Rewrite only to `/demo/firma/t` |
| Unknown production host | any | GET | Fail closed |

Also verify that every redirect/rewrite response preserves Supabase refresh cookies written earlier in the request pipeline.

### 14.3 Auth integration tests

Test each role against each surface:

- Anonymous.
- Correct active role.
- Wrong active role.
- Pending approval.
- Rejected.
- Suspended.
- Authenticated user with missing role metadata.
- Expired/refreshable session.
- Invalid session.

The test oracle must include both response navigation and absence of protected data.

### 14.4 End-to-end browser tests

Vitest is suitable for pure policy and synchronous code, but async Server Components and real browser cookie behavior require end-to-end coverage. Add or use an approved browser test runner before production enforcement.

E2E coverage MUST verify:

- Host-only cookie behavior across `app`, `notario`, `admin`, and `demo`.
- Login and logout on each real auth surface.
- Cross-host navigation does not falsely appear authenticated.
- Redirect query preservation.
- No redirect loop.
- Copy-link output.
- Email callback landing.
- Old link compatibility.
- Direct refresh on internally rewritten pages.
- Client-side `<Link>` navigation after a rewrite.
- RSC/prefetch navigation.
- File upload and download.
- Mobile viewport signing.

### 14.5 Negative security tests

For every privileged mutation, include cases for:

- No cookie.
- Cookie from a different host.
- Wrong role.
- Suspended account.
- User assigned to another packet.
- Wrong workflow state.
- Demo origin.
- Forged `Host` or forwarding headers in unit/integration context.
- Cross-origin request with an unapproved `Origin`.
- Replayed token or webhook.

## 15. Manual verification checklist

Run manual checks in a clean browser profile and in a second profile representing a different role.

### Marketing

- [ ] Apex home and public pages render.
- [ ] `www` canonicalization is correct.
- [ ] Dashboard and signing paths do not render on apex.
- [ ] Canonical tags reference only public marketing URLs.

### Application

- [ ] Realtor login and dashboard work.
- [ ] Landlord and renter signing entry works from fresh messages.
- [ ] Upload, OTP, account creation, consent, identity, review, sign, and completion work.
- [ ] Copied links use `app.veradoc.pe`.
- [ ] Old apex signing links still resolve safely.

### Notary

- [ ] Exclusive-notary password login establishes a notary-host session.
- [ ] Retired invite paths and invitation-bearing callbacks fail closed without cookies or redirects.
- [ ] Queue, packet, certification, history, profile, and earnings paths use clean URLs.
- [ ] Customer and admin paths do not render.

### Admin

- [ ] MFA/access gate is enforced.
- [ ] Wrong roles cannot authenticate into admin.
- [ ] Privileged actions are authorized and audited.
- [ ] Admin pages do not render through other hosts.

### Demo

- [ ] Demo banner is persistent.
- [ ] Demo uses only synthetic state.
- [ ] No real message, payment, signing, storage, notary, or tax side effect occurs.
- [ ] Production tokens fail on demo.
- [ ] Demo tokens fail on production signing routes.

## 16. Rollout plan

### 16.1 Preconditions

Do not enable enforcement until:

- All required domains have valid TLS.
- Origin environment variables exist in Production and relevant Preview environments.
- Supabase exact redirect URLs are configured.
- Third-party callbacks have been inventoried.
- WP-1 tests pass.
- Host policy tests pass.
- Signing compatibility is proven.
- A named operator can roll back immediately.

### 16.2 Recommended sequence

1. Deploy typed origins and URL builders with host routing off.
2. Begin emitting new durable links while old routes still serve normally.
3. Deploy hostname policy in shadow mode.
4. Observe unknown hosts and route-decision metrics.
5. Enable application/signing enforcement.
6. Validate production with synthetic test accounts.
7. Enable notary enforcement.
8. Enable admin enforcement after its access gate is ready.
9. Enable demo only after its safety gate passes.
10. Keep legacy redirects temporary throughout the stabilization window.
11. Promote stable redirects only in a later release.

### 16.3 Avoiding a flag dead end

`HOST_ROUTING_MODE` must be server-side, validated, and documented:

- `off`: current path behavior; typed URL generation may still be active.
- `shadow`: compute and record safe decisions but do not enforce them.
- `enforce`: apply canonical redirects, rewrites, and rejections.

The flag MUST NOT disable server-side authorization. It controls hostname routing only.

## 17. Rollback plan

Rollback MUST be possible without removing DNS records or domains.

Primary rollback:

1. Set hostname routing mode to `off` using the approved Vercel procedure.
2. Redeploy or promote the last known-good production deployment as required.
3. Keep all hostnames assigned so previously issued new links still reach the application.
4. Keep typed origin configuration intact unless it caused the incident.
5. If new link generation is the problem, stop the affected notification job/channel before reverting data or deleting links.
6. Verify signing, auth callback, webhook, and cron health.

Never roll back by immediately deleting subdomains. Signing messages may already contain those hosts.

If a permanent 308 was shipped, browser caches may outlive the server rollback. This is why the first migration stage uses temporary redirects.

## 18. Observability and incident diagnostics

Create stable reason codes rather than free-form request logging. Example codes:

```text
HOST_UNKNOWN
HOST_PATH_ALLOWED
HOST_PATH_REWRITE
HOST_PATH_LEGACY_REDIRECT
HOST_PATH_WRONG_SURFACE
HOST_METHOD_REJECTED
AUTH_MISSING
AUTH_WRONG_ROLE
AUTH_INACTIVE
AUTH_REDIRECT_CANONICAL
```

Recommended metrics:

- Requests by surface and path family.
- Rewrite/redirect/reject counts by reason code.
- Redirect-loop detection.
- Auth callback failure rate by surface.
- Signing-entry and signing-completion conversion by source-host class.
- Unknown-host rate.
- Wrong-host mutation rejection count.
- Demo production-action rejection count.

Sanitize paths before logging. Convert token-bearing signing routes to templates such as `/firma/[token]`. Hashing a token for logs is not automatically safe; omit it unless a security design explicitly requires correlation and defines keying and retention.

## 19. Agent operating procedure

Every agent implementing a work package MUST follow this procedure.

### Before editing

1. Read `AGENTS.md`.
2. Read this guide completely.
3. Read `AUTH_ONBOARDING_FRAMEWORK.md` for current role and provisioning semantics.
4. Read the relevant bundled Next.js 16 docs, at minimum the Proxy guide and API reference for routing work.
5. Inspect `git status --short` and preserve unrelated user changes.
6. Re-run targeted repository searches; do not assume the hotspot list is current.
7. State the exact work package and non-goals.
8. Identify external settings required, but do not change them without authorization.

### While editing

1. Use pure functions for host, surface, path, and target decisions.
2. Keep framework orchestration thin.
3. Make one conceptual change at a time.
4. Preserve Supabase `Set-Cookie` headers across all response conversions.
5. Keep relative navigation within a surface.
6. Use typed absolute builders only for cross-surface or out-of-band links.
7. Add tests with each behavior change.
8. Do not weaken existing action, RPC, storage, or RLS authorization.
9. Never expose secrets in output, fixtures, snapshots, or commits.
10. Do not alter Vercel, Supabase, DNS, OAuth, payment, signing-provider, or messaging configuration unless explicitly authorized.

### Verification

At minimum, run:

```powershell
npm run lint
npm run test
npm run build
```

Also run targeted integration and browser tests required by the work package. If a command cannot run because credentials or external services are unavailable, report exactly what remains unverified. Do not describe an unrun check as passing.

### Handoff

Every handoff must include:

- Work package completed.
- Files changed.
- Behavior added or changed.
- Invariants covered.
- Commands run and exact result summary.
- Manual checks performed.
- External settings still required.
- Known risks.
- Rollback action.
- Follow-up work explicitly out of scope.

## 20. Review checklist

A reviewer MUST reject the change if any answer below is unclear.

### Architecture

- [ ] Does each public URL have exactly one canonical surface?
- [ ] Are internal rewrite paths absent from public link generation?
- [ ] Are unknown production hosts rejected?
- [ ] Are preview and local hosts explicit?

### Auth

- [ ] Are cookies still host-scoped?
- [ ] Does login occur on the role's intended origin?
- [ ] Are Supabase callbacks exact and surface-specific?
- [ ] Does every privileged mutation authorize close to the data?
- [ ] Are Proxy checks described only as optimistic checks?

### Routing

- [ ] Are GET/HEAD redirects distinguished from mutation handling?
- [ ] Are redirect loops impossible by construction and tested?
- [ ] Are query parameters preserved intentionally?
- [ ] Are Supabase refresh cookies preserved on rewrites and redirects?
- [ ] Are API/webhook/cron routes explicitly classified?

### URLs

- [ ] Do signing links always use `app`?
- [ ] Do retired notary invite URLs fail closed on every host?
- [ ] Do admin links always use `admin`?
- [ ] Is `VERCEL_URL` excluded from durable production links?
- [ ] Are user-controlled absolute redirects rejected?

### Demo and admin

- [ ] Can demo trigger zero real side effects?
- [ ] Is demo prevented from receiving domain-wide auth cookies?
- [ ] Is admin protected by more than hostname obscurity?
- [ ] Is deployment splitting triggered when its gate conditions are met?

### Testing and rollout

- [ ] Are host/path/method/role combinations table-tested?
- [ ] Is real browser cookie behavior tested?
- [ ] Are old issued links covered?
- [ ] Is the rollout reversible without deleting domains?
- [ ] Were temporary redirects used before permanent redirects?

## 21. Explicit non-goals

Unless separately approved, this transition does not include:

- Redesigning dashboards.
- Changing the underlying role taxonomy.
- Replacing Supabase Auth.
- Rewriting the signing state machine.
- Changing packet ownership rules.
- Changing database RLS merely to accommodate routing.
- Moving all routes into new filesystem directories.
- Splitting the repository into multiple applications.
- Adding role-specific subdomains beyond the five approved surfaces.
- Migrating external providers without a provider-specific plan.
- Making the demo production-capable.

## 22. Completion definition

The subdomain transition is complete only when all of the following are true:

1. Each hostname serves only its approved surface.
2. Public URLs follow the target contract without redundant internal prefixes.
3. All durable generated links use typed surface-specific origins.
4. Auth callbacks establish sessions on the intended host.
5. Sessions remain host-scoped.
6. Server-side authorization remains effective independently of Proxy.
7. Fresh and legacy signing links complete successfully.
8. Retired notary invite URLs and callback parameters fail closed without session creation.
9. Admin access includes the approved additional control.
10. Demo cannot cause production side effects.
11. APIs, webhooks, cron, and Server Actions never depend on cross-host redirects.
12. Marketing is the only intentionally indexable surface.
13. Automated and manual matrices pass.
14. Production telemetry shows no material unknown-host, redirect-loop, callback, or signing regression.
15. Rollback has been exercised or proven in a production-like environment.

Until every applicable condition is satisfied, agents must describe the migration as partial and identify the remaining work packages.

## Appendix A — Required local references

Before implementing a related work package, agents must read the relevant current repository files and the documentation bundled with the installed Next.js version. The following paths were relevant when this guide was authored:

```text
AGENTS.md
AUTH_ONBOARDING_FRAMEWORK.md
package.json
next.config.ts
proxy.ts
vercel.json
lib/auth/constants.ts
lib/auth/guards.ts
lib/supabase/proxy.ts
lib/supabase/server.ts
lib/env/server.ts
lib/utils/url.ts
lib/auth/actions.ts
lib/admin/actions.ts
lib/actions/agente-actions.ts
lib/services/notifications.ts
app/auth/callback/route.ts

node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
node_modules/next/dist/docs/01-app/02-guides/authentication.md
node_modules/next/dist/docs/01-app/02-guides/multi-tenant.md
node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
```

Paths and APIs may change after dependency upgrades. Re-discover the bundled documentation instead of assuming this list remains complete.

## Appendix B — Decision record template

Any deviation from this guide or resolution of an identified decision gate should be recorded in the implementing change using this template:

```text
Decision ID:
Date:
Owner:
Work package:
Problem:
Chosen option:
Rejected options:
Security impact:
Authentication/cookie impact:
Generated-link impact:
External-system impact:
Migration compatibility:
Observability:
Rollback:
Required tests:
Follow-up date or trigger:
```

At minimum, create decision records for:

- Keeping demo in the production deployment or splitting it.
- The approved admin MFA or identity-gate mechanism.
- The host policy for every webhook and cron endpoint.
- The duration of legacy signing redirects.
- Any cross-origin session handoff proposal.
- Any parent-domain cookie proposal, which is prohibited unless this guide is explicitly superseded by an approved security design.
