# VeraDoc Auth and Onboarding Framework

This document explains the login and onboarding framework that currently exists in the VeraDoc application. It covers the business reason for the flow, the account types, the implemented routes, and the technical security model behind the build.

## Business Case

VeraDoc is not a generic self-serve signing product. The platform coordinates rental lease packets between realtors, contracted notaries, landlords, and renters. The auth model therefore has to control who can enter the system, who can create business activity, and who can participate only after being invited into a specific lease packet.

The onboarding rules are different for each party:

- **Notaries** have special contracts with VeraDoc. They cannot create accounts publicly. VeraDoc or an admin-created process invites them, and they complete onboarding from that invitation.
- **Realtors** are the paying clients and distribution channel. They can request an account, but they must be approved before they can operate. This matters because notaries operate provincially in Peru, and VeraDoc must prevent realtors from creating or sending lease packets in provinces where the company does not have contracted notarial coverage.
- **Landlords and renters** do not create accounts before a transaction exists. They enter VeraDoc through a signing link created from a realtor's lease packet. Their account is tied to that signing invitation.
- **Admins** exist to control approvals, invitations, and platform access. The current build includes the role and protected admin route foundation, but not a full management UI.

This keeps VeraDoc's commercial and legal exposure under control. Realtors cannot start sending documents until approved, notaries remain a contracted partner class, and signers only enter the platform in the context of a real lease packet.

## Account Roles

The auth layer uses `ProfileRole`, defined in `lib/auth/types.ts`, as the production role set:

- `admin`
- `notary`
- `realtor`
- `landlord`
- `renter`

The existing demo/domain `UserRole` remains separate so adding `admin` does not break demo UI maps that expect only user-facing product roles.

Every account also has a status:

- `active`
- `pending_approval`
- `rejected`
- `suspended`

Role and status are stored in two places:

- `auth.users.app_metadata`, used for fast auth decisions and route redirects.
- `public.profiles`, used as the application profile and audit record.

Client code never sets trusted role or status metadata. All trusted metadata is set by server actions through the Supabase admin client.

## Implemented Login and Onboarding Flows

### Realtor Signup

Route: `/auth/signup`

Realtors can submit a public signup form. The server action validates the payload, creates a Supabase auth user, writes trusted `app_metadata`, and inserts a profile row with:

- `role = realtor`
- `status = pending_approval`
- profile fields such as full name, DNI, province, department, company, RUC, license number, and phone

After signup, the realtor is not active. They are sent to `/auth/pending-approval` until an admin approves them.

Approval is handled by `approveRealtor` in `lib/auth/actions.ts`. That action requires the caller to be an active admin, updates the profile to `active`, records `approved_by` and `approved_at`, and updates `app_metadata` to:

```json
{
  "role": "realtor",
  "status": "active",
  "province": "..."
}
```

Rejected realtors are sent to `/auth/rejected`.

### Notary Invitation

Routes:

- `/auth/callback`
- `/auth/invite/[token]`

Notaries are invited instead of self-registering. The `invitations` table stores pending notary invitations. The invitation token belongs to VeraDoc's application layer, while Supabase also uses its own auth callback token for the magic-link session.

The implemented flow separates those two tokens:

1. A notary receives a Supabase magic link that redirects through `/auth/callback`.
2. The callback preserves the VeraDoc invitation token in the redirect.
3. The notary lands on `/auth/invite/[token]` with a Supabase session.
4. The invite page calls `acceptNotaryInvite`.
5. The server action validates the invitation server-side, sets the password, writes trusted role metadata, inserts the notary profile, and marks the invitation accepted.

The proxy intentionally allows authenticated users without role metadata through `/auth/invite/[token]`, because that is the expected state during notary invite acceptance.

### Signer Account Creation

Role names:

- Domain concept: signer
- Auth roles: `landlord` or `renter`

Landlords and renters do not sign up directly. They receive a secure signing link from a realtor-created packet. The current auth framework provides the account-creation foundation through `signing_tokens`.

The `signing_tokens` table stores the signer email, WhatsApp number, DNI, full name, packet ID, role in lease, status, expiration, and eventual linked auth user. The raw token is not stored. Instead, the database stores a SHA-256 `token_hash`.

`createSignerAccount` performs the account creation after the signer has reached the required token state:

1. Validate input with Zod.
2. Hash the submitted token.
3. Atomically claim the token through `claim_signing_token`.
4. Require the token to be in `otp_verified` status.
5. Confirm the submitted email matches the token's signer email.
6. Create the Supabase auth user through the admin client.
7. Set trusted metadata with role `landlord` or `renter`.
8. Insert the profile row.
9. Finalize the signing token as `account_created`.
10. Sign the user in with password so the browser receives a session.

The token claim is atomic to prevent double account creation from concurrent submissions.

### Login

Route: `/auth/login`

The login action validates email and password, signs the user in with Supabase, reads trusted `app_metadata`, and returns the correct redirect:

- `admin` -> `/admin`
- `realtor` -> `/agente`
- `notary` -> `/notario`
- `landlord` -> `/arrendador`
- `renter` -> `/arrendatario`
- missing role or pending realtor -> `/auth/pending-approval`
- rejected realtor -> `/auth/rejected`

## Route Structure

Production dashboard routes are grouped under `app/(dashboard)/`, but the route group does not appear in URLs.

Implemented dashboard roots:

- `/admin`
- `/agente`
- `/notario`
- `/arrendador`
- `/arrendatario`

Implemented auth routes:

- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `/auth/invite/[token]`
- `/auth/pending-approval`
- `/auth/rejected`

The dashboard pages currently exist as protected placeholders. They prove the role gates and redirect behavior, but they do not yet contain the final business dashboards.

## Technical Architecture

### Supabase Clients

The framework uses four Supabase client helpers:

- `lib/supabase/client.ts`: browser client for client components.
- `lib/supabase/server.ts`: server client for Server Components, Route Handlers, and Server Actions.
- `lib/supabase/proxy.ts`: proxy client that can refresh sessions and write cookies on the response.
- `lib/supabase/admin.ts`: service-role client for privileged operations.

`lib/supabase/admin.ts` imports `server-only`, so the service-role client cannot accidentally be bundled into client code.

### Server Actions

Auth mutations live in `lib/auth/actions.ts`:

- `login`
- `logout`
- `signupRealtor`
- `acceptNotaryInvite`
- `approveRealtor`
- `rejectRealtor`
- `createSignerAccount`

Every action validates input with schemas from `lib/auth/schemas.ts` before calling Supabase. The actions use parsed values after validation.

The actions also include compensation paths for partial failures. For example, if user creation succeeds but profile insertion fails, the auth user is deleted. If signer token claiming succeeds but account creation fails, the token is reset to `otp_verified` so the signer can retry.

### Guards

Server-side page guards live in `lib/auth/guards.ts`:

- `requireAuth()` redirects unauthenticated users to login.
- `requireRole(...roles)` requires one of the allowed roles.
- `requireApproved(...roles)` requires both the role and `active` status.

Dashboard placeholder pages call these guards directly.

### Proxy

The root `proxy.ts` implements Next.js 16 route protection. It:

- Refreshes Supabase sessions.
- Preserves refreshed cookies when redirecting.
- Allows `/auth/callback` through.
- Handles `/auth/invite/[token]` separately from ordinary login/signup routes.
- Redirects pending and rejected realtors to the correct holding pages.
- Redirects active users away from the wrong dashboard and toward their own role dashboard.

Protected route prefixes are:

- `/admin`
- `/agente`
- `/notario`
- `/arrendador`
- `/arrendatario`

## Database Model

The migration lives at `supabase/migrations/00001_auth_onboarding.sql`.

### `profiles`

The canonical application profile table. It stores:

- auth user ID
- role
- status
- full name
- unique email
- phone
- DNI
- company and RUC fields
- realtor license number
- notary accreditation number
- province and department
- invitation and approval audit fields

RLS allows users to read their own profile and active admins to read or update all profiles.

### `invitations`

Used for notary invitations. It stores:

- invited email
- notary role
- inviter
- VeraDoc invitation token
- status
- expiration
- accepted timestamp
- metadata

Direct public reads are revoked. Admins can manage invitations. Invite lookup is performed through the `lookup_invitation` RPC.

### `signing_tokens`

Used for landlord and renter account creation from signing links. It stores:

- hashed token
- packet ID
- signer email
- signer WhatsApp
- signer DNI
- signer full name
- lease role, either landlord or renter
- token status
- OTP verification timestamp
- linked auth user ID
- expiration
- consumed timestamp

Direct public reads are revoked. Token claiming is performed through the `claim_signing_token` RPC using the service-role client.

## RLS and RPC Security

The migration avoids direct `using (true)` policies on PII-bearing tables. It also avoids recursive admin policies by using `public.is_active_admin()`, a `SECURITY DEFINER` helper that checks whether the current user is an active admin.

RPCs:

- `lookup_invitation(p_token)` returns only pending, unexpired invitations and is granted to authenticated users.
- `claim_signing_token(p_token_hash)` atomically moves a token from `otp_verified` to `claiming` and is granted only to `service_role`.

The signing token flow uses `UPDATE ... WHERE status = 'otp_verified' RETURNING ...`, which prevents two concurrent requests from claiming the same token.

## Current Boundaries

This framework intentionally builds the auth and route-protection foundation. It does not yet include every business UI.

Currently included:

- Auth pages.
- Realtor public signup.
- Notary invite acceptance.
- Signer account creation action.
- Admin role and protected admin route placeholder.
- Dashboard route placeholders for every role.
- Hardened database schema, RLS, and RPCs.

Still expected in later product work:

- Full admin management UI for realtor approvals and notary invitations.
- Province coverage tables that map contracted notaries to supported provinces.
- Actual lease packet creation and signer invitation generation in production data.
- Background reconciliation for signing tokens stuck in `claiming`.
- Final production dashboards for each role.

## Verification Status

At the time this framework was reviewed:

- `npm run build` passed on Next.js `16.2.6`.
- `npm run lint` still failed on pre-existing demo code, not on the auth/onboarding framework.

Known existing lint issues:

- `app/demo/firma/[token]/page.tsx`: synchronous `setState` inside an effect.
- `lib/services/signer-service.ts`: unused `CorrectionScope` import.
