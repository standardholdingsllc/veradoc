# Mercado Pago Payments API Integration Plan

Status: implementation-ready plan  
Target: VeraDoc payment step, cards, Yape, 3DS, webhooks, refunds, and reconciliation  
Provider API: Mercado Pago Checkout API through the Payments API (`/v1/payments`)  

## 1. Goal

Replace the demo-only payment step with a production-safe Mercado Pago integration while preserving VeraDoc's existing provider-neutral payment primitives.

The implementation must:

- Accept credit and debit cards through MercadoPago.js CardForm.
- Accept Yape through browser-side phone/OTP tokenization.
- Support the Payments API 3DS challenge flow.
- Treat Mercado Pago's API as the authoritative source for payment status.
- Process direct responses, polling results, webhooks, and reconciliation through one transition service.
- Never unlock the signing step until a payment is actually approved and captured.
- Preserve immutable attempt and refund history needed for audit and reconciliation.
- Send the existing payment-confirmation email idempotently without delaying webhook acknowledgement.
- Keep the demo payment path available only when explicitly enabled outside production.

## 2. Non-goals

- Orders API
- Checkout Pro
- Checkout Bricks
- Mercado Pago account-balance payments
- Split Payments or marketplace payouts
- Recurring payments
- Invoice generation
- A general-purpose job queue

Do not copy request shapes, status names, 3DS fields, or endpoints from the Orders API.

## 3. Required implementation invariants

These are hard requirements, not suggestions:

1. The browser never sends an amount, currency, description, external reference, notification URL, realtor ID, or idempotency key that the server trusts.
2. The browser sends only tokenization output, non-sensitive payer fields needed by Mercado Pago, the local payment ID, and the Device ID.
3. Raw PAN, expiry, CVV, Yape phone, and Yape OTP never reach VeraDoc's server, database, logs, analytics, or error responses.
4. A Mercado Pago `authorized` payment is not paid. It is waiting for capture and must not complete VeraDoc's payment step.
5. VeraDoc completes payment only for an authoritative `status === "approved"` result where `captured !== false`, after provider, provider payment ID, external reference, amount, currency, environment, packet, and realtor all match.
6. The first provider response, including pending/rejected responses, binds the Mercado Pago payment ID to the local attempt. Later results with a different provider ID must be rejected as conflicts.
7. Client-side 3DS completion is only a polling signal. It never marks a payment approved.
8. Direct API responses, 3DS polling, webhooks, and admin reconciliation all call the same transition service.
9. All local state changes use database locking or compare-and-set rules. A stale response must never downgrade `completed`, `partially_refunded`, `refunded`, or `charged_back` state.
10. Idempotency keys remain server-side and are stable for one provider request. A new payment attempt or refund gets a new key.
11. Refund amounts are integers in centimos inside VeraDoc. Convert to PEN decimal units only at the Mercado Pago boundary.
12. Invalid webhook signatures return `401`. Retryable processing failures return `500`. Successfully processed or deliberately ignored notifications return `200`.

## 4. Authoritative provider status mapping

Implement this mapping in exactly one place: `lib/services/mercadopago/transition.ts`.

| Mercado Pago result | Local result | Complete payment? | Notes |
|---|---|---:|---|
| `approved`, `captured !== false` | `completed` | Yes | Call the atomic success RPC. |
| `approved`, `status_detail = partially_refunded` | `partially_refunded` | Already completed | Sync refund records before changing state. |
| `authorized`, usually `pending_capture` | `processing` | No | Never release signing. Automatic capture is requested, but the response remains authoritative. |
| `pending`, `pending_challenge` | `requires_action` | No | Persist provider ID and 3DS data only in the constrained action response. |
| Other `pending` | `processing` | No | Wait for webhook/polling. |
| `in_process` | `processing` | No | Wait for webhook/reconciliation. |
| `rejected` | `failed` | No | Persist sanitized `status_detail`; allow a new attempt. |
| `cancelled` | `cancelled` | No | Never convert client timeout alone into cancellation. |
| `refunded` | `refunded` | No new completion | Sync the refund ledger. |
| `charged_back` | `charged_back` | No | Record and surface to operations. |
| `in_mediation` | `in_mediation` | No | Preserve the dispute state; do not treat as a new payable attempt. |
| Unknown status | No state mutation | No | Log a sanitized diagnostic and return an explicit unsupported outcome. |

## 5. Final request flow

### Card or Yape creation

1. Wizard calls `preparePaymentAction(packetId)`.
2. Server authenticates the realtor, reads authoritative pricing, and calls `claim_payment_attempt`.
3. Server returns only `paymentId`, `amountCentimos`, `currency`, and `existingStatus`.
4. Browser tokenizes card data through CardForm or Yape data through `mp.yape(...).create()`.
5. Browser calls the matching process action with the local payment ID, provider tokenization output, and Device ID.
6. Server loads the payment, owner, price, currency, stored idempotency key, packet, and profile email.
7. Server builds `external_reference`, metadata, and `notification_url` itself.
8. Server creates the Mercado Pago payment.
9. Server passes the parsed response to `recordPaymentResult`.
10. The browser advances only when the constrained result is `approved`.

### Webhook or reconciliation

1. Validate and deduplicate the notification or authenticate the admin operation.
2. Fetch `GET /v1/payments/{providerPaymentId}`.
3. Parse the authoritative response.
4. Resolve the local payment from the UUID embedded in `external_reference`.
5. Verify every binding and the environment.
6. Call `recordPaymentResult`.
7. Commit webhook processing state.
8. Schedule idempotent confirmation delivery after the HTTP response when appropriate.

## 6. Phase 1 — Database migration

Create `supabase/migrations/00019_mercadopago_payment_state.sql`.

### 6.1 Extend `payments`

Add:

- `external_reference text`
- `provider_status text`
- `provider_status_detail text`
- `provider_live_mode boolean`
- `provider_captured boolean`
- `provider_created_at timestamptz`
- `provider_updated_at timestamptz`
- `attempt_number integer NOT NULL DEFAULT 1`

Constraints/indexes:

- Unique `(payment_provider, external_reference)` when external reference is not null.
- `attempt_number > 0`.
- Extend the payment status constraint with `in_mediation`.
- The one-payment-per-packet guard must also cover post-payment financial states: `completed`, `partially_refunded`, `refunded`, `charged_back`, and `in_mediation`. A refunded or disputed packet must not silently become payable again through the creation wizard.

Update `claim_payment_attempt`:

- Continue locking the packet.
- Treat all active and post-payment financial states as an existing payment.
- Assign `attempt_number = max(attempt_number for packet) + 1` for a genuinely new attempt.
- Return `payment_id`, `existing_status`, `amount_centimos`, `currency`, `attempt_number`, and `claimed`.
- Do not return the idempotency key.
- A failed/cancelled attempt may be followed by a new row with a new idempotency key.

### 6.2 Add `payment_refunds`

Create a ledger rather than storing refund totals only on `payments`:

```sql
CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  provider text NOT NULL,
  provider_ref text,
  amount_centimos integer NOT NULL CHECK (amount_centimos > 0),
  currency text NOT NULL CHECK (currency = 'PEN'),
  status text NOT NULL CHECK (status IN ('prepared', 'processing', 'approved', 'rejected', 'cancelled')),
  reason text NOT NULL,
  requested_by uuid REFERENCES public.profiles(id),
  idempotency_key text NOT NULL UNIQUE,
  provider_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
```

Enable RLS. Only `service_role` may insert/update; authorized admin queries may be exposed through server actions.

### 6.3 Add atomic provider-state RPC

Create `apply_payment_provider_result(...)` as the database convergence primitive.

It must:

- Lock the local payment row.
- Validate provider, provider payment ID binding, amount, currency, external reference, and expected environment.
- Bind `payment_provider_ref` on the first valid provider result, including pending or rejected results.
- Reject a later result carrying a different provider payment ID.
- Store sanitized provider status fields and provider timestamps.
- Apply only allowed forward transitions.
- For `approved`, require `captured IS DISTINCT FROM false`, set `completed`, set `paid_at`, and write `payment_completed` audit exactly once.
- Return one of:
  - `completed`
  - `already_completed_same_payment`
  - `state_updated`
  - `stale_ignored`
  - `provider_mismatch`
  - `provider_payment_conflict`
  - `amount_mismatch`
  - `currency_mismatch`
  - `external_reference_mismatch`
  - `environment_mismatch`
  - `not_captured`
  - `invalid_transition`
  - `unsupported_status`

Keep `process_payment_success` for the existing demo path unless replacing it is necessary. Do not make the demo path depend on Mercado Pago fields.

### 6.4 Add atomic refund claiming

Create `claim_payment_refund(...)` that:

- Requires a completed or partially refunded Mercado Pago payment.
- Locks the payment row.
- Calculates approved plus in-flight refunds.
- Rejects a requested amount above the remaining refundable balance.
- Inserts and returns one `prepared` refund row with its server-generated idempotency key.

This prevents two concurrent partial refunds from exceeding the payment amount.

### 6.5 Generated types

After applying the migration locally, regenerate `lib/supabase/database.types.ts` with the existing `db:types` script. Do not hand-maintain RPC/table types if generation is available.

Database acceptance criteria:

- Two concurrent prepares produce one active attempt.
- A rejected attempt can be followed by a new attempt with a different key and attempt number.
- A completed payment cannot be replaced by a second provider payment.
- An old rejected result cannot downgrade a completed payment.
- Concurrent refunds cannot exceed the original payment.

## 7. Phase 2 — Environment configuration

Edit:

- `lib/env/server.ts`
- `lib/env/public.ts`
- `.env.example`

Server variables:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_ENVIRONMENT=test|production`

Public variable:

- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`

Rules:

- Explicitly map the public key in `public.ts`; Next.js cannot safely rely on dynamic public environment lookup.
- `isMercadoPagoConfigured()` is true only when the access token, webhook secret, and public key are all present.
- `validateMercadoPagoConfig()` must fail startup when environment is `production` and any required credential is missing.
- Production Mercado Pago configuration must reject `DEMO_PAYMENTS_ENABLED=true`.
- There is no alternate Mercado Pago API base URL for test mode. Both modes use `https://api.mercadopago.com`; credentials and returned `live_mode` distinguish them.
- Never log credential values.

Page wiring:

- Compute `mercadoPagoConfigured` in the server page from the complete configuration.
- Do not show the real checkout merely because the public key exists.

## 8. Phase 3 — Mercado Pago boundary types

Create `lib/services/mercadopago/types.ts`.

Use strict Zod schemas at VeraDoc-controlled request boundaries and tolerant schemas for provider responses.

### Required response fields

The payment response schema must retain:

- `id` normalized to string
- `status`
- `status_detail`
- `transaction_amount`
- `currency_id`
- `payment_method_id`
- `captured`
- `live_mode`
- `external_reference`
- `metadata`
- `three_ds_info.external_resource_url`
- `three_ds_info.creq`
- `date_created`
- `date_approved`
- `date_last_updated`
- `payer.email` where present
- `refunds[]` fields needed for reconciliation

Also define:

- Create-payment request types
- Mercado Pago error/cause types
- Webhook body schema
- Refund response schema
- Constrained action result discriminated unions

Do not require `issuer_id` when CardForm does not return one. Omit undefined optional provider fields rather than sending empty strings.

## 9. Phase 4 — HTTP service

Create:

- `lib/services/mercadopago/service.ts`
- `lib/services/mercadopago/index.ts`

Use direct `fetch` so Payments API shapes remain explicit.

Implement:

```ts
createPayment(params): Promise<MercadoPagoPaymentResponse>
getPayment(providerPaymentId, options?): Promise<MercadoPagoPaymentResponse>
createRefund(providerPaymentId, amountCentimos, idempotencyKey): Promise<MercadoPagoRefundResponse>
```

Service requirements:

- Base URL is fixed to `https://api.mercadopago.com`.
- Send `Authorization: Bearer ...` only from the server.
- Send `X-Idempotency-Key` for payment and refund mutations.
- Send `X-meli-session-id` when a validated Device ID is available.
- Convert centimos to decimal PEN at the final request boundary.
- Use `three_d_secure_mode: "optional"`, `capture: true`, and `binary_mode: false` for card payments.
- Use `payment_method_id: "yape"` and `installments: 1` for Yape.
- Construct `notification_url` from trusted `SITE_URL`.
- Parse every response with Zod, including non-2xx error responses.
- Redact tokens, credentials, payer identifiers, and raw response bodies from logs.
- Direct checkout timeout: at most 25 seconds.
- Webhook/reconciliation fetch timeout option: 12–15 seconds so the route can return within Mercado Pago's 22-second window.
- On transport timeout, retain the attempt as `processing`; the result is ambiguous and must be recovered with the same idempotency key, webhook, or reconciliation.

Do not retry a mutation automatically with a new idempotency key.

## 10. Phase 5 — Transition service

Create `lib/services/mercadopago/transition.ts`.

Public API:

```ts
recordPaymentResult(
  admin,
  localPaymentId,
  providerPayment,
  expectedEnvironment,
): Promise<PaymentTransitionOutcome>
```

Do not accept `realtorId`, amount, currency, packet ID, or external reference as trusted caller arguments. Load them from the local payment and packet.

The service must:

1. Normalize provider amount to centimos using a single tested helper.
2. Build the expected external reference from local UUIDs.
3. Validate `live_mode` against `MERCADOPAGO_ENVIRONMENT`.
4. Validate provider metadata as defense in depth.
5. Map the provider status using the table in Section 4.
6. Call `apply_payment_provider_result`.
7. Return a constrained outcome without raw provider data.
8. Set `shouldSendConfirmation=true` for both `completed` and `already_completed_same_payment` when confirmation has not been sent.

The transition service must not send email itself. Callers schedule delivery after payment state is safely committed.

## 11. Phase 6 — Server actions

Create `lib/actions/payment-actions.ts` with `"use server"`.

### `preparePaymentAction(packetId)`

- Validate UUID input.
- Authenticate the user.
- Verify the packet belongs to the user and is in `draft`.
- Read `pricing_config` server-side.
- Generate a cryptographically random idempotency key.
- Call `claim_payment_attempt` with provider `mercadopago`.
- Return only local attempt details; never return the idempotency key.

### `processCardPaymentAction(input)`

Accept only:

- `paymentId`
- `token`
- `paymentMethodId`
- optional `issuerId`
- `installments`
- payer identification type/number when required
- optional `deviceSessionId`

Then:

- Authenticate and verify ownership.
- Load authoritative profile email, payment row, packet, price, currency, and stored idempotency key.
- Allow `prepared`; handle a duplicate `processing` request idempotently.
- Atomically move `prepared -> processing` before the provider mutation.
- Build the provider request server-side.
- Call `createPayment`.
- Call `recordPaymentResult`.
- Schedule idempotent confirmation delivery with `after()` only after committed success.
- Return one of `approved`, `requires_action`, `processing`, or `rejected` with an allowlisted user-facing error code.

### `processYapePaymentAction(input)`

Accept only `paymentId`, the one-use token, and optional Device ID. Use the authenticated profile email. Do not accept phone or OTP.

Use the same state, idempotency, transition, and confirmation rules as cards.

### `pollPaymentStatusAction(paymentId)`

- Authenticate and verify ownership.
- Require provider `mercadopago` and a stored provider reference.
- Rate-limit or debounce polling per payment.
- Fetch authoritative status with the short timeout.
- Route through `recordPaymentResult`.
- Schedule confirmation after committed success.
- Return only the constrained status.

Do not re-export these actions through `agente-actions.ts` unless there is a concrete import-compatibility reason. Import them from their own module.

## 12. Phase 7 — Client components

Create:

- `components/payment/mercadopago-card-form.tsx`
- `components/payment/mercadopago-yape.tsx`
- `components/payment/three-ds-challenge.tsx`
- `components/payment/payment-method-selector.tsx`
- A small client-side type declaration for the MercadoPago.js globals

### CardForm

- Use a Client Component.
- Load `https://sdk.mercadopago.com/js/v2` once with `next/script`.
- Instantiate `new window.MercadoPago(publicKey)` only after the script is ready.
- Mount CardForm with `iframe: true`.
- Destroy/unmount the CardForm instance during cleanup and before remounting.
- Keep PAN, expiry, and CVV in Mercado Pago-hosted fields.
- Disable submission after the first click until a terminal/retryable UI state is reached.
- Never log CardForm data or provider tokens.
- Use the documented `window.MP_DEVICE_SESSION_ID` produced by MercadoPago.js unless the installed SDK is proven to expose another supported API.

### Yape

- Keep phone and six-digit OTP in browser-only component state.
- Validate the Peruvian phone format and numeric OTP.
- Call `mp.yape({ otp, phoneNumber }).create()`.
- Immediately discard phone/OTP state after token generation or failure.
- Send only the token, payment ID, and Device ID to the server.

### 3DS challenge

- Render the documented POST form into a named iframe using `external_resource_url` and hidden `creq`.
- Listen on `window` for a `message` whose parsed payload has `status === "COMPLETE"`.
- Do not use iframe `load` as the completion signal.
- Debounce duplicate messages.
- On completion, poll immediately and then with bounded backoff because provider status updates are not instantaneous.
- Stop when approved, rejected, cancelled, or the roughly five-minute challenge window expires.
- A client timeout shows recovery UI but does not mark the server payment failed.
- On page reload, recover `requires_action` or `processing` state from the server rather than creating a second payment.

### Selector and wizard

Wizard Step 5 behavior:

```text
demo enabled              -> existing Simular pago flow
Mercado Pago configured   -> prepare attempt, then render selector
neither configured        -> payment unavailable message; no active pay button
```

Do not advance to Step 6 for `authorized`, `processing`, `requires_action`, iframe completion, or client timeout. Advance only after the server returns `approved` from an authoritative result.

## 13. Phase 8 — Webhook signature and route

Create:

- `lib/services/mercadopago/webhook-verify.ts`
- `app/api/webhooks/mercadopago/route.ts`

### Signature verification

- Read `x-signature`, `x-request-id`, and query parameter `data.id`.
- Parse all `ts` and `v1` fields defensively.
- Build the documented manifest:

```text
id:{data.id};request-id:{x-request-id};ts:{ts};
```

- Compute HMAC-SHA256 with the webhook secret.
- Compare signatures with a constant-time comparison.
- Reject missing/malformed components.

### Route algorithm

1. Read the exact raw request text once.
2. Parse JSON with the webhook schema.
3. Require query `data.id` to equal body `data.id`.
4. Verify signature before any database or provider mutation.
5. Ignore unsupported topics/actions with `200` after valid signature.
6. Hash the raw body and call `claim_webhook_processing`.
7. If already finalized or currently owned elsewhere, return `200`.
8. Fetch the authoritative payment with the 12–15 second timeout.
9. Resolve and verify the local payment binding.
10. Call `recordPaymentResult`.
11. Mark the webhook event `processed`, `ignored`, `retryable_failure`, or `permanent_failure`.
12. If confirmation is needed, use `after(() => sendPaymentConfirmation(...))` after all required values have been loaded.
13. Return `200` for processed/ignored, `401` for invalid signature, and `500` for retryable provider/database failure.

Never acknowledge a retryable failure with `200`, or Mercado Pago will stop retrying that delivery.

## 14. Phase 9 — Confirmation delivery

Keep `sendPaymentConfirmation` idempotent.

Required behavior:

- Invoke it for both transition outcomes `completed` and `already_completed_same_payment`.
- Direct actions and webhook routes may schedule it with stable Next.js `after()` after the response-critical payment mutation is committed.
- The callback receives already-resolved scalar values; it must not depend on client state.
- Preserve `payment_confirmation_sent_at`, claim timeout, attempts, and error recording.
- Add an admin/internal retry path that scans completed payments with no `payment_confirmation_sent_at` and a stale/no claim. This provides recovery if post-response work or email delivery fails.
- Email failure must never roll back an approved payment or change the action response from approved to failed.

## 15. Phase 10 — Refunds and reconciliation

Create `lib/actions/admin-payment-actions.ts`.

### `refundPaymentAction(paymentId, amountCentimos, reason)`

- Require approved admin access.
- Validate UUID, positive integer centimos, and a non-empty bounded reason.
- Load the local payment and Mercado Pago provider reference.
- Fetch Mercado Pago first and reconcile amount, currency, status, environment, and prior refunds.
- Enforce the documented 90-day refund window using provider approval time.
- Call `claim_payment_refund` to reserve refundable balance and create the idempotency key.
- Call `/v1/payments/{id}/refunds` with empty body for a full remaining refund or `{ amount }` for a partial refund.
- Persist provider refund ID and status in `payment_refunds`.
- Re-fetch the payment when the refund response is ambiguous.
- Update the payment through the same reconciliation/transition path.
- Write an audit entry containing local refund ID, provider refund ID, amount, reason, and actor; never store raw credentials or payer data.

### `reconcilePaymentAction(paymentId)`

- Require approved admin access.
- Fetch the authoritative provider payment.
- Verify all bindings.
- Sync provider payment state and refund ledger.
- Route state through `recordPaymentResult`.
- Retry confirmation delivery when the payment is completed but confirmation is unsent.
- Return a before/after summary suitable for an admin UI and audit log.

Do not directly set `refunded` or `partially_refunded` based only on the requested refund amount. Use provider-confirmed state and refund records.

## 16. Testing requirements

Add tests as part of implementation, not as follow-up work.

### Unit tests

- Zod parsing of approved, pending challenge, authorized, rejected, refunded, partially refunded, charged-back, malformed, and unknown responses.
- Amount/centimos conversion including `89.00`, `89.90`, and rounding rejection cases.
- Status mapping, especially `authorized -> processing`.
- External-reference creation/parsing.
- Environment/live-mode validation.
- Webhook manifest construction, valid signature, invalid signature, malformed header, query/body ID mismatch, and constant-time comparison path.
- Error sanitization: tokens and credentials must not appear in output.

### Database tests

- Concurrent payment attempt claim.
- Retry after rejection creates a new attempt/key.
- Provider payment ID binds on pending state.
- Conflicting provider ID is rejected.
- Stale failure cannot downgrade completion.
- Duplicate approval is idempotent.
- Amount/currency/environment mismatch cannot mutate state.
- Concurrent refund claims cannot exceed remaining balance.

### Action/service tests with mocked fetch

- Card approval/rejection.
- Yape approval/rejection.
- 3DS pending then approval, rejection, and timeout.
- Transport timeout followed by recovery using the same idempotency key.
- Duplicate process submission.
- Webhook approval after direct-action timeout.
- Webhook retryable failure returns `500`.
- Duplicate webhook is harmless.
- Email failure does not change payment success and can be retried.
- Full refund, multiple partial refunds, over-refund rejection, and refund reconciliation.
- Chargeback and mediation updates.

### Manual provider tests

- Test card frictionless approval.
- Documented 3DS challenge success and failure cards.
- Documented Yape test phone/OTP outcomes.
- Webhook simulator with valid signature.
- Browser reload during 3DS and processing.
- One controlled low-value production payment and full refund before launch.

## 17. Observability and security checks

Structured logs may contain:

- Local payment UUID
- Packet UUID
- Provider payment ID
- Provider status/status detail
- Transition outcome
- Webhook event UUID
- Refund UUID/provider refund ID
- Duration and sanitized error code

Logs must never contain:

- Access token or webhook secret
- Card/Yape token
- PAN, expiry, or CVV
- Yape phone or OTP
- Full payer identification number
- Raw Authorization or signature headers
- Unsanitized provider response bodies

Add metrics or searchable logs for:

- Payment create latency/failure
- Payments stuck in `processing` or `requires_action`
- Signature validation failures
- Webhook retryable failures
- Approved provider payments not completed locally
- Completed payments with unsent confirmation
- Refund mismatches and chargebacks

## 18. File checklist

### New

- `supabase/migrations/00019_mercadopago_payment_state.sql`
- `lib/services/mercadopago/types.ts`
- `lib/services/mercadopago/service.ts`
- `lib/services/mercadopago/transition.ts`
- `lib/services/mercadopago/webhook-verify.ts`
- `lib/services/mercadopago/index.ts`
- `lib/actions/payment-actions.ts`
- `lib/actions/admin-payment-actions.ts`
- `components/payment/mercadopago-card-form.tsx`
- `components/payment/mercadopago-yape.tsx`
- `components/payment/three-ds-challenge.tsx`
- `components/payment/payment-method-selector.tsx`
- `app/api/webhooks/mercadopago/route.ts`
- Focused unit/integration test files matching the modules above

### Edit

- `lib/env/server.ts`
- `lib/env/public.ts`
- `.env.example`
- `lib/supabase/database.types.ts` via generation
- `components/agente/wizard-client.tsx`
- `app/(dashboard)/agente/nuevo-paquete/page.tsx`
- `lib/services/payment-confirmation-delivery.ts` only if retry behavior needs correction

### Preserve

- Existing demo `confirmPacketPayment` behavior when demo mode is explicitly enabled
- Existing pricing source and provider-neutral primitives where compatible
- Existing payment-confirmation template and delivery idempotency

## 19. Recommended implementation order

Implement and verify in this order:

1. Migration, RPC tests, and regenerated database types.
2. Environment validation and configuration flag.
3. Provider Zod schemas and fixtures.
4. HTTP service and sanitized error handling.
5. Transition service and mapping tests.
6. Prepare/process/poll server actions.
7. Webhook verification and route tests.
8. CardForm and Yape components.
9. 3DS message listener and polling recovery.
10. Wizard integration and reload recovery.
11. Confirmation scheduling and retry path.
12. Refund ledger/actions and reconciliation.
13. Full automated suite, provider sandbox tests, then controlled production smoke test.

Do not start client UI work before the database and transition contracts are stable.

## 20. Definition of done

The integration is complete only when:

- Demo mode and real mode are mutually exclusive in production.
- Cards, Yape, and 3DS pass provider sandbox tests.
- Only approved/captured payments advance the wizard.
- Pending/rejected responses store the provider ID for recovery.
- Webhooks validate signatures and finish within the provider acknowledgement window.
- Duplicate actions/webhooks cannot double-charge or corrupt state.
- Refunds have a durable ledger and cannot exceed the paid amount.
- Chargeback, mediation, partial refund, and full refund states reconcile correctly.
- Confirmation delivery is idempotent and retryable.
- No sensitive payment material appears in logs, database payloads, analytics, or user-visible errors.
- Automated tests, typecheck, lint, and production build pass.
- A controlled production payment/refund has been reconciled across Mercado Pago, VeraDoc, audit logs, and email delivery.

## 21. Official references

- Checkout API overview: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/overview
- CardForm: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/integration-configuration/card/integration-via-cardform
- Yape: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/integration-configuration/yape
- 3DS: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/how-tos/integrate-3ds
- Payment statuses: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/response-handling/query-results
- Webhooks: https://www.mercadopago.com.pe/developers/es/docs/your-integrations/notifications/webhooks
- Refunds: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-payments/payment-management/cancellations-and-refunds
- Refund endpoint: https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-api-payments/create-refund/post

Before implementing framework-specific details, use the documentation shipped with this repository's installed Next.js version under `node_modules/next/dist/docs/`. For post-response work, the relevant installed guide is `01-app/03-api-reference/04-functions/after.md`.
