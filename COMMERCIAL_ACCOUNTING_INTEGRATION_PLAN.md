# VeraDoc Commercial and Accounting Integration Plan

**Status:** Product implementation completed locally; database deployment and external acceptance pending  
**Last updated:** 2026-09-10  
**Scope:** Pricing, included services, tax presentation, agency billing, revenue recognition, electronic comprobantes, refunds, case-by-case promo codes, direct costs, notary payouts, packet margin, abandonment, and archival.  
**Primary commercial reference:** `Contrato Notario VeraDoc_SACS_ESFINALLL.docx`, especially clauses 8-11 and Annex 1.

## Implementation record — 2026-09-10

Implemented in the product and canonical migration:

- Effective-dated S/199 pricing with IGV, included/excluded-service catalog, and immutable per-payment commercial snapshots.
- Private, hashed promo codes with server-side validation and reservation/redemption; no customer credit or stored-balance model.
- Successful-capture revenue events, separate durable CPE preparation, actual Mercado Pago fee capture, append-only packet costs, and per-packet contribution-margin reporting.
- Evidence-backed exceptional-refund claiming on top of the existing CPE, idempotency, cumulative-cap, provider-reconciliation, and credit-note controls.
- Contractual 40% MND notary terms, actual-fee prerequisite, separately itemized VeraDoc promo top-up, notary comprobante/IGV evidence, and prepare/approve/pay maker-checker stages.
- Ninety-day service windows, durable day-60/75/85 reminders, authorized archival holds, idempotent soft archival, signing-token expiry, and customer/admin visibility. Mutations are rollout-gated by `COMMERCIAL_ARCHIVAL_MUTATIONS_ENABLED=false` until staging acceptance is recorded.

Deployment acceptance still requires applying `20260910160000_commercial_accounting.sql` to a reset/staging database, regenerating types from that database, exercising provider sandboxes, and obtaining the legal/accounting approvals listed below. Local database execution could not be completed on 2026-09-10 because the Docker-backed Supabase environment was unavailable.

---

## 1. Goal

Integrate VeraDoc's approved commercial rules across every product surface and operational workflow without making payment, revenue, CPE, packet, and notary-payout state depend on one another incorrectly.

The implementation must:

- Charge a flat final price of S/199 for each primary document processed as a packet.
- State exactly what the price includes and quote out-of-scope services separately before incurring them.
- Snapshot the commercial terms applied to every payment so later pricing changes do not alter history.
- Record revenue at successful payment capture independently of signing, notarial completion, and CPE processing state.
- Issue the factura or boleta from the successful-payment event through a separate retry-safe CPE workflow.
- Enforce a no-routine-refunds policy while retaining controlled exceptions required for payment errors, VeraDoc failures, chargebacks, and mandatory remedies.
- Calculate the notary's participation from the contract's 40% MND formula rather than a fixed per-certification rate.
- Track all material direct costs and produce a reproducible contribution margin for each packet.
- Soft-archive eligible unfinished paid packets after the 90-day service window without deleting records that must be retained.
- Preserve immutable evidence for every price, promotion, refund, payout, adjustment, and approval decision.

## 2. Non-goals

- Subscription plans, memberships, or recurring payments.
- Public coupon campaigns, reusable customer credits, or automatic volume discounts.
- Postpaid agency credit facilities or consolidated monthly agency invoicing in the MVP.
- Automated accounting-journal export to an external ERP.
- Automatic deletion of identity, evidence, payment, CPE, or notarial records at the 90-day packet archive boundary.
- Changing the signed notary contract through application logic.
- Treating a commercial contribution-margin view as a substitute for the company's statutory accounts.

---

## 3. Approved commercial policy

### 3.1. Unit of sale and price

- Product code: `lease_packet_standard`.
- Unit of sale: one primary notarizable lease document processed through one VeraDoc packet.
- Final customer price: S/199.00, paid in advance.
- Currency: PEN only for the MVP.
- The advertised price includes IGV. At an 18% total rate, S/199.00 is represented as approximately S/168.64 value of sale plus S/30.36 IGV, subject to the authoritative CPE rounding result.
- Supporting identity files, evidence, and attachments used for the same primary document are not separate billable documents.
- A second independent contract or other primary document requires a second packet and payment.

The payment server must always load this price from an active, effective-dated server-side price version. Browser-supplied amount, tax, discount, promo value, or product identifiers are never authoritative.

### 3.2. Included services

The S/199.00 standard packet includes:

- Packet creation and processing of one primary lease document.
- Collection of the configured parties, identity material, consent, and evidence.
- The standard FirmEasy electronic-signing workflow for the parties attached to that document.
- Routine transactional email and configured messaging notifications.
- Generation and storage of the signed document and evidence report.
- Submission to, review by, and certification from the assigned notary when the act is legally and professionally accepted.
- The standard correction and resubmission path supported by the packet workflow.
- Issuance and availability of the applicable VeraDoc factura or boleta.
- Standard digital access and storage under the approved retention policy.
- Support for the ordinary VeraDoc workflow and payment/CPE recovery.

The price does not guarantee notarial approval, third-party acceptance, or a particular completion time when additional verification or correction is required.

### 3.3. Excluded or separately quoted services

The following are excluded unless expressly added to a later product version:

- Additional primary contracts or separate notarial acts.
- Additional certified copies.
- Translation, interpreter, legalization, apostille, or public-registry fees.
- Physical delivery, courier, or special in-person attendance requested by the customer.
- Extraordinary verification, public fees, or requirements outside the standard workflow.
- A different notarial service not described by the purchased product.

An excluded service must be identified before the cost is incurred, quoted separately by VeraDoc, and accepted expressly by the customer. The notary must not collect an undisclosed additional payment directly from the customer inside the VeraDoc transaction.

### 3.4. Promo codes, discounts, and agency billing

- No public discounts, reusable credits, automatic volume pricing, or free-notary promotions are enabled for the MVP.
- Agencies purchase packets at the same S/199.00 price and pay per document in advance.
- A negotiated agency discount, prepaid balance, or postpaid billing facility requires a separate written commercial agreement and a new effective-dated pricing rule before it is exposed in the product.
- VeraDoc may issue a private promo code case by case. It is not a stored-value balance, cash equivalent, refund, or customer credit.
- Each promo code is non-public, customer- or agency-bound when practical, single-use unless explicitly configured otherwise, time-limited, and approved by an authorized VeraDoc finance operator.
- Each code records its discount, reason, issuer, approver, valid dates, usage limit, redemption, and audit history. The server computes the discount; the browser supplies only the code entered by the customer.
- The customer pays the discounted amount, and the CPE and recognized revenue reflect the discounted sale actually completed.
- The promo discount is funded entirely by VeraDoc. It must not reduce the notary's protected participation from the standard S/199 transaction basis.
- The notary liquidation shows the contract-calculated participation on the discounted MND and a separate VeraDoc-funded promotional top-up. Their sum equals the participation calculated from the standard S/199 value-of-sale basis, less the actual transaction's permitted payment-processing cost.
- The promotional top-up is a VeraDoc direct cost and is never charged back to the notary merely because VeraDoc chose to grant the promo.
- A 100% promo is outside the standard captured-payment flow and requires a separately approved implementation; MVP promo codes must leave a positive amount payable.

---

## 4. Financial event boundaries

The following events are related but independent:

| Event | Authoritative trigger | Product consequence |
|---|---|---|
| Payment captured | Provider reports `approved` and capture is not false, or the approved demo equivalent outside production | Unlock signing and create the commercial/accounting snapshot |
| Revenue recognized | First valid payment-captured transition | Record the sale value excluding IGV exactly once |
| CPE requested | Durable job created from the committed payment-captured transition | Begin factura/boleta issuance without blocking payment success |
| CPE issued | APIsPERU/SUNAT workflow accepts and stores the CPE artifacts | Make artifacts available and notify the payer |
| Notary participation earned | Contract-defined Acto Notarial Completado | Accrue the notary's 40% MND participation |
| Refund/chargeback recognized | Authoritative provider result or completed controlled refund | Record a separate reversal/adjustment and start credit-note handling |
| Packet archived | Eligible packet reaches the approved 90-day boundary | Block ordinary workflow activity; do not delete retained evidence |

No CPE failure, signing failure, correction, rejection, or notarial outcome may delete or rewrite the original payment or revenue-recognition event. A later financial change is a new compensating event.

### 4.1. Revenue-recognition rule

- `recognized_at` is the authoritative successful-capture timestamp, normally `payments.paid_at`.
- The operational revenue amount is the packet's snapshotted value of sale excluding IGV.
- Revenue recognition is independent of final signing or notarization success.
- An actual refund, partial refund, chargeback, or approved price correction creates a distinct negative adjustment; it does not mutate the original event.
- The system must preserve both gross-customer and net-of-tax measures so the accountant can approve gross-versus-net statutory presentation without a historical-data rewrite.

Accountant approval remains required for financial-statement presentation, chart-of-accounts mapping, and the final tax/accounting treatment of promotional discounts and notary top-ups. It does not change the product event boundary above.

### 4.2. Electronic-comprobante rule

- The factura or boleta is requested after successful payment capture, not after certification.
- The CPE transaction date derives from the authoritative payment timestamp in the Lima business timezone.
- The selected comprobante type and purchaser identity are snapshotted before charging and validated server-side.
- CPE processing is asynchronous, idempotent, retryable, and recoverable by an authorized operator.
- CPE rejection or provider downtime does not roll back the payment, signing eligibility, or recognized-revenue event.
- A completed refund or qualifying adjustment creates the corresponding credit-note workflow when legally required.
- Abandonment or notarial rejection alone does not create a credit note because neither is automatically a refund.

---

## 5. Refund and promotional-remedy decision matrix

The public policy is that purchases are not routinely refundable. Mandatory legal remedies and the controlled exceptions below still apply.

| Situation | Default customer remedy | Cash refund | Cost treatment | Approval |
|---|---|---:|---|---|
| Payment not captured, failed, or cancelled | Retry or choose another payment method | No refund is needed | Record only actual failed-attempt costs if available | Automatic |
| Duplicate charge or incorrect amount caused by VeraDoc/provider processing | Correct and return the excess | Full or excess amount | VeraDoc bears the adjustment unless responsibility is established elsewhere | Finance approver |
| Unauthorized payment or provider chargeback | Follow provider dispute result and preserve evidence | Provider-directed | Allocate under the chargeback responsibility rule | Finance approver; legal review when disputed |
| Customer changes their mind after capture | Continue the purchased packet | No | All incurred costs remain on the packet | No exception by default |
| Customer cannot obtain signer cooperation or stops responding | Reminder and 90-day service window | No | All incurred costs remain on the packet | No automatic remedy; private promo only if VeraDoc approves a future packet |
| Signing or messaging has begun but the packet is unfinished | Continue, correct, or resubmit | No | Signing, messaging, payment, and storage costs remain on the packet | No automatic remedy; private promo only if VeraDoc approves a future packet |
| Notary observes or requests correction | Correction/resubmission path | No | No notary participation is earned until completion; other costs remain | Operational handling |
| Assigned notary is unavailable | Reassign to a qualified notary | No by default | No participation to the uncompleted notary | Operations; finance if remedy escalates |
| Notary rejects the act in professional judgment | Explain, correct, or reassign when legally possible | No automatic refund | No participation for an uncompleted act; other costs remain | Legal/finance exception only |
| VeraDoc materially cannot provide the purchased workflow | Reperform or reassign first; otherwise approved refund or case-specific promo for a future packet | Possible | VeraDoc bears the refund or promotional discount/top-up | Finance approver, with documented evidence |
| Acto Notarial Completado | Provide final documents/support | No discretionary refund | Notary participation remains earned | Mandatory remedy or exceptional executive approval only |
| Mandatory consumer, court, regulator, or card-network remedy | Apply the required remedy | As required | Allocate based on cause and contract | Legal plus finance approval |
| Paid packet reaches 90-day abandonment boundary | Soft archive; customer may buy a new packet | No | Costs remain on the archived packet | No automatic remedy; VeraDoc may approve a private promo code case by case |

### 5.1. Refund controls

- Only an active finance-authorized admin may request a refund.
- The refund action must load packet, payment, prior refunds, applied promotions, signing activity, notary state, CPE state, service-window dates, and attributable costs before deciding eligibility.
- The decision matrix is enforced on the server and in the database claim operation, not only in UI copy.
- Every override records the matrix result, override reason, approver, legal basis when applicable, amount, and supporting evidence.
- Ambiguous Mercado Pago results remain pending reconciliation. Operators must not submit a second refund until the provider state is resolved.
- Partial and cumulative refunds cannot exceed the captured payment.
- The 90-day provider refund window is an operational limit, not a promise that the customer is eligible for a refund.

### 5.2. Provider and notary cost allocation after a refund

- Payment-provider costs are recorded at their actual net cost after provider rebates or reimbursements.
- Signing, messaging, CPE, and storage costs already incurred remain attributable to the source packet even when VeraDoc issues a customer remedy.
- Before notary payout, a refunded, reversed, or charged-back amount is excluded from the MND as provided by the contract.
- After notary payout, VeraDoc may offset only the proportional amount previously paid and only when the contract permits it, with evidence in the next liquidation.
- The notary does not bear a refund caused exclusively by VeraDoc, a duplicate charge, an unattributable processor error, a VeraDoc-funded promotion, or a discretionary post-completion refund without notary breach.
- A notary-attributable error or unauthorized act may be allocated to the notary in accordance with the contract and documented approval process.

---

## 6. Contracted notary economics and payouts

### 6.1. Formula

For every Acto Notarial Completado:

```text
actual_value_of_sale_centimos = gross_collected_centimos - included_igv_centimos
actual_MND_centimos = actual_value_of_sale_centimos - net_payment_processing_cost_centimos
contract_participation_centimos = round(40% * actual_MND_centimos)

standard_value_of_sale_centimos = 19900 - standard_included_igv_centimos
protected_MND_centimos = standard_value_of_sale_centimos - net_payment_processing_cost_centimos
protected_participation_centimos = round(40% * protected_MND_centimos)

veradoc_promo_top_up_centimos =
  max(0, protected_participation_centimos - contract_participation_centimos)

total_notary_payout_before_igv =
  contract_participation_centimos + veradoc_promo_top_up_centimos
```

- Calculate using integer centimos and round once, half-up, at the final participation amount.
- For a transaction without a promo, the top-up is zero and the protected calculation equals the contractual calculation.
- For a discounted transaction, the contractual participation remains 40% of the actual MND, while VeraDoc funds the top-up as a separate payout item so the notary receives the protected standard-price participation.
- The notary's applicable IGV on a valid notary comprobante is paid in addition to the participation and is not deducted from MND.
- The monthly liquidation and notary comprobante evidence must support both the contractual participation and the promotional top-up; applicable IGV is paid in addition to the invoiced remuneration.
- There is no minimum payment per completed act.
- There is no fee for review of an uncompleted, observed, or rejected file.
- No signing, messaging, CPE, storage, hosting, development, support, salary, marketing, administration, or other VeraDoc operating cost may be deducted from MND.
- The formula version and contract effective date must be snapshotted on each payout item.

The existing fixed `amount_per_certification` model must be migrated to a percentage/MND formula. Historical payouts already marked paid must not be recalculated or rewritten.

Illustrative promo example, using an assumed S/6.00 actual payment-processing cost:

```text
standard price                         S/199.00
private promo                          S/ 20.00
customer pays                          S/179.00

actual value of sale after IGV         S/151.69
actual MND after processing cost       S/145.69
contract participation at 40%          S/ 58.28

protected standard value after IGV     S/168.64
protected MND after processing cost    S/162.64
protected participation at 40%         S/ 65.06

VeraDoc promotional top-up             S/  6.78
total notary payout before IGV          S/ 65.06
```

The actual processor cost and authoritative tax rounding replace the illustrative values for each transaction.

### 6.2. Monthly disbursement workflow

1. Close the period on the last calendar day of the month.
2. Generate an immutable draft liquidation from eligible completed acts and permitted adjustments.
3. Have a finance operator reconcile the transaction list, payment fees, MND, participation, notary IGV, and prior-period adjustments.
4. Have VeraDoc's Gerente Administrativo or a formally delegated finance approver confirm the liquidation by the fifth business day.
5. Receive and validate the notary's applicable electronic comprobante within the contractual three-business-day period.
6. Transfer PEN to the contracted account in Annex 1 within five business days after receipt of a valid comprobante.
7. Have a different finance-authorized admin mark the liquidation paid after attaching or referencing the transfer evidence.
8. Expose the confirmed and paid result, without unrelated customer information, in the notary earnings view.

The same actor must not both confirm a liquidation and mark it paid. Emergency overrides require a second retrospective approval and an audit event.

### 6.3. Required payout evidence

Each monthly liquidation must preserve:

- Notary and contract/formula version.
- Period, included packet/certification IDs, and completion timestamps.
- Gross collected, included IGV, provider cost, MND, participation, and notary IGV for each item.
- Refund, chargeback, offset, and correction evidence.
- Preparer, approver, payment recorder, and timestamps.
- Notary comprobante type, series/number, issue date, total, currency, and artifact reference.
- Bank transfer date, amount, reference, destination-account fingerprint, and evidence reference.
- Notes, disputes, resolution, and immutable audit events.

---

## 7. Per-packet cost and margin ledger

### 7.1. Required cost categories

- `payment_processing`
- `signing`
- `messaging_email`
- `messaging_whatsapp`
- `cpe`
- `storage`
- `notary_participation`
- `notary_promo_top_up`
- `notary_igv`
- `refund_fee`
- `chargeback_fee`
- `other_approved_direct_cost`

Each cost record must contain the packet, payment when applicable, category, provider, amount in centimos, currency, incurred timestamp, actual/estimated status, tax treatment, source reference, evidence reference, allocation method, and idempotency key.

Costs are append-only. Corrections use reversing and replacement entries rather than destructive edits.

### 7.2. Margin calculation

The operational per-packet view must expose at least:

```text
standard_gross_price
- promo_discounts_applied
= gross_collected

gross_collected
- included_igv_on_the_collected_amount
- refunds_and_chargebacks_net_of_igv
= adjusted_net_revenue

adjusted_net_revenue
- payment_processing
- signing
- messaging
- cpe
- storage
- notary_participation
- notary_promo_top_up
- other_approved_direct_costs
= platform_contribution_margin
```

Notary IGV is shown separately from commercial margin unless the accountant approves a different statutory mapping. The view must distinguish missing costs from zero costs and estimated costs from provider-confirmed actual costs.

### 7.3. Cost ingestion

- Payment costs come from reconciled Mercado Pago transaction data.
- Signing costs come from FirmEasy usage/invoice data keyed to a packet or provider operation.
- Messaging costs come from provider delivery records when item-level billing is available; otherwise use an approved allocation version.
- CPE costs come from APIsPERU usage/invoice data or an approved allocation version.
- Storage costs are allocated by a versioned monthly rule using stored bytes and retention duration when exact per-object billing is unavailable.
- Notary participation is accrued only by the completed-act transition and reversed only under contract-permitted adjustments.
- Manually entered costs require evidence, reason, creator, and approval.

---

## 8. Abandonment, archival, and case-by-case promotions

### 8.1. Service window

- A paid packet's service window begins at successful capture.
- `service_window_ends_at` is fixed at `paid_at + 90 days`; ordinary customer activity does not silently extend it.
- The packet detail and payment confirmation must disclose the date clearly.
- Send durable reminders around days 60, 75, and 85 when the packet is still eligible to progress.
- A packet in active notary review at the boundary is placed on an explicit archival hold rather than being archived mid-review.
- Legal holds, provider incidents, or VeraDoc-approved extensions must be explicit, time-bound, approved, and audited.

### 8.2. Abandoned state and archive job

An unfinished paid packet is abandoned when the service window expires and it is not completed, already archived, on an approved hold, or in an active notary-review step.

The idempotent scheduled job must:

1. Claim eligible packets safely under concurrency.
2. Set `archived_at`, `archive_reason = 'abandoned_90_day'`, and the policy version.
3. Revoke or expire unused signing tokens and prevent new signing/notary workflow mutations.
4. Cancel future routine reminders while preserving delivery history.
5. Write packet and global admin audit events.
6. Notify the realtor and relevant authorized customer contact.
7. Preserve payment, CPE, evidence, documents, audit, and cost records under their independent retention schedule.

Archival is a soft operational state, not deletion, anonymization, payment cancellation, refund, promo award, or CPE voiding.

### 8.3. Reopening and discretionary promo codes

- An archived packet is read-only through the ordinary workflow.
- Continuing the service requires a new packet and payment.
- VeraDoc may approve a private promo code for that new packet case by case; no promo is created automatically by archival.
- The promo has an explicit expiration and cannot be exchanged for cash or retained as a customer balance.
- Redemption creates a new commercial snapshot and preserves the promo, approval, and optional source-packet reference.
- Expired, revoked, and redeemed promo codes remain in the audit history.

Unpaid draft cleanup is a separate retention concern and must not use the paid-packet abandonment policy.

---

## 9. Product-surface integration

| Surface | Required integration |
|---|---|
| `/precios` and marketing | Show S/199 final price, included services, exclusions, no-guarantee language, payment timing, and 90-day service window |
| New-packet wizard | Show one-primary-document unit, promo entry, authoritative discount/total/IGV breakdown, payer/CPE details, and policy acknowledgement before payment |
| Payment actions | Load effective price and validate the promo code server-side; persist the commercial snapshot; never trust browser amounts or discount values |
| Payment confirmation | Show captured amount, CPE state separately, service-window end date, and next signing action |
| Realtor packet detail | Show payment, signing, notary, CPE, service-window, and archive states independently |
| Signer experience | Show signing-link expiry and an accurate archived/unavailable state without exposing financial details |
| Notary queue | Keep customer price and notary judgment separate; expose only information necessary for the act and contracted earnings |
| Notary earnings | Show completed-act accruals, MND formula, monthly liquidations, comprobante requirement, adjustments, and payment evidence status |
| Admin payments/refunds | Show matrix eligibility, costs incurred, prior refunds/promotions, CPE effects, override approvals, and reconciliation controls |
| Admin finance | Manage effective-dated prices, agency terms, private promo codes, cost exceptions, notary formulas/top-ups, liquidations, evidence, and margin reports |
| CPE operations | Search by packet/payment/customer, recover failed issuance, inspect artifacts, and create credit notes from completed financial adjustments |
| Notifications | Use the durable outbox for payment/CPE, service-window reminders, archive, promo, and payout events |
| Support/audit | Search all related IDs and display an immutable event timeline without permitting destructive financial edits |

Customer-facing Spanish copy and legal documents must use the same definitions and policy version as the commercial snapshot.

---

## 10. Data-model plan

Names may be adjusted during migration design, but these responsibilities must remain separate.

### 10.1. Versioned commercial configuration

Extend or replace the single-row `pricing_config` model with effective-dated commercial versions containing:

- Product code and policy version.
- Gross price, currency, tax-included flag, and tax-rate snapshot.
- Effective-from/effective-to range and active state.
- Included-service and exclusion identifiers.
- Agency/discount eligibility flags.
- Created and approved actors/timestamps.

Overlapping active versions for the same product and customer segment must be rejected.

### 10.2. Immutable payment commercial snapshot

Each claimed payment must preserve:

- Product, pricing, and policy version.
- Standard gross price, promo code/version, discount, actual gross collected, tax, value of sale, and amount due.
- Payer and factura/boleta selection.
- Included-service identifiers and service-window boundary.
- Successful capture and revenue-recognition timestamps.

A retry reuses the same authoritative snapshot unless the attempt is safely abandoned before provider submission and a new payment attempt is deliberately created.

### 10.3. Financial and cost events

Add append-only ledgers for:

- Revenue recognition and financial adjustments.
- Direct packet costs and reversals.
- Private promo-code issuance, expiry, redemption, and revocation.
- Refund decisions and overrides.

All provider-driven events require stable idempotency/source keys. Financial records must not cascade-delete with a packet.

### 10.4. Notary payout model

- Replace the fixed-rate assumption with versioned percentage/MND terms.
- Snapshot actual MND, protected standard-price MND, contractual participation, and VeraDoc-funded promo top-up on each payout item.
- Add draft, prepared, confirmed, awaiting-comprobante, payable, paid, disputed, adjusted, and void lifecycle states as needed.
- Enforce preparer/approver/payment-recorder separation.
- Store evidence references and destination-account fingerprints rather than exposing full banking details broadly.

### 10.5. Packet archival fields

Add or standardize:

- `service_window_started_at`
- `service_window_ends_at`
- `archived_at`
- `archive_reason`
- `archive_policy_version`
- `archival_hold_until`
- `archival_hold_reason`
- `archival_hold_approved_by`

The database packet-state constraint, domain state machine, adapters, labels, UI actions, and RLS rules must agree on the archived state before automation is enabled.

---

## 11. Authorization and audit model

Do not infer financial authority solely from a generic `admin` role. Add explicit finance capabilities or assignments for:

- Price/policy approver.
- Private promo-code issuer and approver.
- Refund requester and approver.
- Cost-entry creator and approver.
- Payout preparer, confirmer, and payment recorder.
- Archival-hold approver.

Every privileged operation records actor, authority used, target IDs, request/idempotency ID, timestamp, reason, before/after summary, IP/user agent when available, and evidence references. Sensitive banking, identity, and provider-response data must be minimized in logs and UI.

---

## 12. Implementation sequence

### Phase 1 — Policy and source-of-truth alignment

1. Obtain accountant sign-off on gross-versus-net presentation, promo-discount/top-up accounting, and notary-IGV display.
2. Document the VeraDoc-funded promo top-up as a separate liquidation component so the contractual 40% actual-MND calculation remains visible.
3. Obtain legal approval for customer-facing refund, no-guarantee, service-window, archival, and promo language.
4. Version the approved policy text and included-service catalog.
5. Reconcile all marketing, Terms, payment, notification, support, and notary wording with that version.

### Phase 2 — Pricing and payment snapshot

1. Add effective-dated commercial configuration and approval controls.
2. Create the S/199 price version without relabeling historical transactions.
3. Snapshot price, tax, product scope, payer/CPE choice, and service window during payment claiming.
4. Backfill existing payments from their actual stored amounts and label unknown fields explicitly.
5. Update payment and wizard tests before enabling the new price in production.

### Phase 3 — Financial events and CPE separation

1. Add the append-only financial-event ledger and idempotent recognition function.
2. Create recognition from the committed successful-capture transition.
3. Ensure the same transition enqueues, but does not synchronously complete, CPE preparation.
4. Backfill recognition events from authoritative completed payments without duplicating CPEs.
5. Add reconciliation views for payment/revenue/CPE disagreement.

### Phase 4 — Refunds, promotions, and costs

1. Encode the refund matrix in a server/database eligibility function.
2. Add controlled override approval and evidence requirements.
3. Add private promo-code issuance, server-side validation, redemption, expiry, and audit controls.
4. Add packet cost events and provider/allocation ingestion.
5. Connect completed refunds to credit-note preparation and ambiguous outcomes to reconciliation.

### Phase 5 — Notary payouts

1. Introduce contract formula versions effective from the contract date.
2. Accrue participation only from completed acts using snapshotted MND inputs.
3. Replace fixed-rate monthly payout generation with contract-formula items.
4. Add comprobante validation, maker-checker approval, payment evidence, disputes, and adjustments.
5. Preserve paid historical payouts and send incomplete historical items to manual review rather than guessing.

### Phase 6 — Abandonment and archival

1. Align the database and domain archived state.
2. Backfill service-window dates from authoritative `paid_at` values.
3. Add reminder, hold, and archive jobs with dry-run reporting.
4. Add read-only archived UX, new-packet recovery, optional private-promo handling, and admin exceptions.
5. Enable automation only after dry-run totals and sample packets are approved.

### Phase 7 — Reporting and launch acceptance

1. Add per-packet margin and completeness views.
2. Add monthly payment, CPE, refund, promotion/top-up, cost, revenue, and notary reconciliation.
3. Add alerting for missing snapshots, duplicate recognition, negative/unknown margins, stale CPEs, payout disagreements, and archive-job failures.
4. Complete staging and controlled production acceptance.

Before application code changes, follow `AGENTS.md` and read the relevant Next.js 16.2.6 guides in `node_modules/next/dist/docs/` for the server-action, route-handler, caching/revalidation, and background-work surfaces being changed.

---

## 13. Verification plan

### 13.1. Pricing and snapshots

- S/199 is loaded server-side and displayed consistently.
- Tax rounding matches the CPE preparation result.
- A later price change cannot alter an existing attempt or payment.
- A private promo code cannot exceed its usage limit, be transferred when customer-bound, be redeemed after expiry, or reduce the payable amount to zero in the MVP flow.
- Agency identity never changes the price without an effective approved agreement.

### 13.2. Revenue and CPE

- Direct provider response, webhook, poll, and reconciliation converge on one payment-captured event.
- Concurrent successful callbacks create one recognition event and one CPE preparation claim.
- Notarial rejection, correction, or archive does not reverse revenue automatically.
- CPE failure does not downgrade payment or block the signing step.
- Refund completion creates one adjustment and one eligible credit-note workflow.

### 13.3. Refunds and costs

- Every packet/payment state combination returns the expected matrix outcome.
- A UI bypass cannot request an ineligible refund.
- Cumulative and concurrent refunds cannot exceed the captured amount.
- Ambiguous provider results cannot be retried as new refunds before reconciliation.
- Cost reversals preserve the original records and margin remains reproducible.

### 13.4. Notary payouts

- Contract examples and S/199 examples calculate correctly using actual provider fees.
- Non-deductible VeraDoc costs never reduce MND.
- Uncompleted acts do not accrue participation.
- A discretionary VeraDoc refund after completion does not reduce notary earnings improperly.
- The same actor cannot confirm and mark a payout paid.
- Liquidation totals equal the sum of immutable payout items and adjustments.

### 13.5. Archival

- Lima-time boundary behavior is deterministic.
- Reminder and archive jobs are idempotent under retry and concurrent workers.
- Active notary review and approved holds prevent premature archival.
- Archival revokes workflow access without deleting retained evidence.
- Reopening requires a new packet and payment; an approved private promo may reduce that new payment.

### 13.6. End-to-end scenarios

- Full-price boleta purchase through completed certification and notary payout.
- Full-price factura purchase with delayed CPE acceptance.
- Paid packet abandoned and archived at 90 days.
- Notary observation followed by successful correction.
- Notary rejection without automatic refund.
- Duplicate charge followed by refund and credit note.
- VeraDoc failure followed by an approved private promo on a replacement packet, with VeraDoc funding the notary top-up.
- Completed act followed by chargeback and contract-compliant payout adjustment.

---

## 14. Rollout, backfill, and recovery

- Deploy additive schema and read paths before changing active pricing or payout calculations.
- Backfill from actual historical payment amounts; never rewrite S/89 or other historical transactions as S/199.
- Backfill `recognized_at` from authoritative `paid_at` only for valid completed captures.
- Do not recalculate payouts already marked paid.
- Mark unavailable historical cost inputs as unknown or estimated; never silently store zero.
- Run refund-matrix and archive jobs in report-only mode first.
- Reconcile sampled packets across payment provider, CPE provider, packet state, cost ledger, and payout ledger before enabling mutations.
- Keep idempotent forward-fix and reconciliation tools for partially completed deployments or provider outages.

## 15. Definition of done

This plan is complete when:

- All product surfaces state the same approved S/199 scope and policy version.
- New payments preserve immutable commercial snapshots.
- Revenue, CPE, packet, refund, cost, and notary states have explicit independent event boundaries.
- The refund matrix is enforced and exceptions are evidence-backed and approved.
- Notary accruals and monthly payouts implement the contract's 40% MND formula.
- Every packet exposes complete or explicitly unknown unit economics and contribution margin.
- Eligible paid packets are archived automatically at the 90-day boundary with safe holds and recovery.
- Finance and support can reconcile every amount from standard price through promo discount, customer payment, CPE, costs, refund, notary contractual share/top-up, and platform margin.
- Required legal, accounting, provider, staging, and production checks are recorded as passed.
