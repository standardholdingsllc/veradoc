import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/lib/env/server";
import { sendPaymentConfirmation } from "@/lib/services/payment-confirmation-delivery";
import type {
  MercadoPagoPaymentResponse,
  PaymentTransitionOutcome,
} from "./types";

type AdminClient = SupabaseClient<Database>;

/**
 * Single convergence point for all Mercado Pago payment results — both direct
 * API responses (from server actions) and async webhook deliveries route
 * through this function. The underlying commercial success RPC is
 * idempotent, so duplicate calls are safe.
 */
export async function recordPaymentResult(
  admin: AdminClient,
  paymentId: string,
  providerPayment: MercadoPagoPaymentResponse,
  realtorId: string,
  options?: { awaitEmail?: boolean },
): Promise<PaymentTransitionOutcome> {
  const awaitEmail = options?.awaitEmail ?? false;
  const providerPaymentId = String(providerPayment.id);
  const { status, status_detail } = providerPayment;

  // ── Environment guard ──────────────────────────────────────────────────
  const isProduction = serverEnv.MERCADOPAGO_ENVIRONMENT === "production";
  if (providerPayment.live_mode !== isProduction) {
    console.error(
      `[MP Transition] Environment mismatch: live_mode=${providerPayment.live_mode}, expected production=${isProduction}`,
    );
    return { outcome: "error", message: "Payment environment mismatch (live_mode)" };
  }

  // ── Approved ────────────────────────────────────────────────────────────
  if (status === "approved") {
    if (status_detail === "partially_refunded") {
      const ok = await updatePaymentStatus(admin, paymentId, "partially_refunded", status_detail, providerPaymentId);
      if (!ok) return { outcome: "error", message: "Failed to persist partially_refunded status" };
      return { outcome: "already_completed" };
    }

    const amountCentimos = Math.round(providerPayment.transaction_amount * 100);
    const processingFeeCentimos = extractCollectorProcessingFeeCentimos(providerPayment);

    const { data, error } = await admin.rpc("process_commercial_payment_success", {
      p_payment_id: paymentId,
      p_payment_provider: "mercadopago",
      p_provider_payment_id: providerPaymentId,
      p_provider_amount_centimos: amountCentimos,
      p_provider_currency: providerPayment.currency_id,
      p_payment_method: providerPayment.payment_method_id,
      p_actor_id: realtorId,
      p_processing_fee_centimos: processingFeeCentimos ?? undefined,
    });

    if (error) {
      console.error("[MP Transition] process_commercial_payment_success RPC error:", error.message);
      return { outcome: "error", message: error.message };
    }

    const outcome = (data as { outcome: string } | null)?.outcome;

    if (outcome === "already_completed_same_payment") {
      if (awaitEmail) {
        await sendPaymentConfirmationEmail(admin, paymentId, realtorId, amountCentimos, providerPaymentId);
      } else {
        await enqueuePaymentConfirmationEmail(admin, paymentId, realtorId, amountCentimos, providerPaymentId);
      }
      return { outcome: "already_completed" };
    }
    if (outcome === "already_completed_conflict") {
      console.error("[MP Transition] Conflict: payment already completed by different provider payment");
      return { outcome: "error", message: "Payment already completed by a different transaction" };
    }
    if (outcome && outcome !== "completed") {
      console.error("[MP Transition] Unexpected RPC outcome:", outcome);
      return { outcome: "error", message: `Unexpected outcome: ${outcome}` };
    }

    if (awaitEmail) {
      await sendPaymentConfirmationEmail(admin, paymentId, realtorId, amountCentimos, providerPaymentId);
    } else {
      await enqueuePaymentConfirmationEmail(admin, paymentId, realtorId, amountCentimos, providerPaymentId);
    }

    return { outcome: "completed", paymentId, providerPaymentId };
  }

  // ── Authorized (pending capture) ─────────────────────────────────────
  // With capture:true, this state is transient. Polling/webhook will
  // confirm once MP completes the capture and transitions to approved.
  if (status === "authorized") {
    const ok = await updatePaymentStatus(admin, paymentId, "processing", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist processing (authorized) status" };
    return { outcome: "processing" };
  }

  // ── Pending with 3DS challenge ─────────────────────────────────────────
  if (status === "pending" && status_detail === "pending_challenge") {
    const ok = await updatePaymentStatus(admin, paymentId, "requires_action", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist requires_action status" };
    return {
      outcome: "requires_action",
      threeDSInfo: providerPayment.three_ds_info ?? null,
    };
  }

  // ── In process / pending (non-challenge) ───────────────────────────────
  if (status === "in_process" || status === "pending") {
    const ok = await updatePaymentStatus(admin, paymentId, "processing", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist processing status" };
    return { outcome: "processing" };
  }

  // ── Rejected ───────────────────────────────────────────────────────────
  if (status === "rejected") {
    const ok = await updatePaymentStatus(admin, paymentId, "failed", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist failed status" };
    return { outcome: "rejected", statusDetail: status_detail };
  }

  // ── Cancelled / charged_back / refunded ────────────────────────────────
  if (status === "cancelled") {
    const ok = await updatePaymentStatus(admin, paymentId, "cancelled", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist cancelled status" };
    return { outcome: "cancelled" };
  }

  if (status === "refunded") {
    const ok = await updatePaymentStatus(admin, paymentId, "refunded", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist refunded status" };
    return { outcome: "already_completed" };
  }

  if (status === "charged_back") {
    const ok = await updatePaymentStatus(admin, paymentId, "charged_back", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist charged_back status" };
    return { outcome: "terminal_dispute", message: "Payment charged back" };
  }

  if (status === "in_mediation") {
    const ok = await updatePaymentStatus(admin, paymentId, "in_mediation", status_detail, providerPaymentId);
    if (!ok) return { outcome: "error", message: "Failed to persist in_mediation status" };
    return { outcome: "terminal_dispute", message: "Payment is in mediation (dispute)" };
  }

  console.error("[MP Transition] Unhandled status:", status, status_detail);
  return { outcome: "error", message: `Unhandled provider status: ${status}` };
}

/**
 * Only fees charged to VeraDoc/the collector reduce MND. A missing fee list is
 * represented as null so payout preparation blocks until reconciliation; it is
 * never silently treated as a zero-cost transaction.
 */
export function extractCollectorProcessingFeeCentimos(
  payment: MercadoPagoPaymentResponse,
): number | null {
  if (!payment.fee_details?.length) return null;
  const collectorFees = payment.fee_details.filter(
    (fee) => fee.fee_payer?.toLowerCase() !== "payer",
  );
  if (collectorFees.length === 0) return 0;
  return Math.round(collectorFees.reduce((total, fee) => total + fee.amount, 0) * 100);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set([
  "completed", "refunded", "charged_back", "in_mediation", "cancelled",
  "failed", "partially_refunded",
]);

const NONTERMINAL_STATUSES = [
  "pending", "prepared", "processing", "requires_action",
];

async function updatePaymentStatus(
  admin: AdminClient,
  paymentId: string,
  localStatus: string,
  statusDetail: string,
  providerPaymentId: string,
): Promise<boolean> {
  // For non-terminal target statuses, use a conditional UPDATE that only
  // succeeds when the current row is still in a non-terminal state.
  // This makes the check-and-update atomic at the database level,
  // preventing races where a concurrent webhook completion could be
  // overwritten by a stale processing/requires_action update.
  if (!TERMINAL_STATUSES.has(localStatus)) {
    const { data, error } = await admin
      .from("payments")
      .update({
        status: localStatus,
        payment_provider_ref: providerPaymentId,
        error_code: localStatus === "failed" ? statusDetail : null,
        error_message: localStatus === "failed" ? statusDetail : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", paymentId)
      .in("status", NONTERMINAL_STATUSES)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[MP Transition] Failed to update payment status:", error.message);
      return false;
    }
    if (!data) {
      console.warn(
        `[MP Transition] Skipping ${localStatus} update: payment already advanced past non-terminal state`,
      );
    }
    return true;
  }

  // Terminal status updates apply unconditionally -- they represent
  // authoritative provider outcomes that should always be recorded.
  const { error } = await admin
    .from("payments")
    .update({
      status: localStatus,
      payment_provider_ref: providerPaymentId,
      error_code: localStatus === "failed" ? statusDetail : null,
      error_message: localStatus === "failed" ? statusDetail : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", paymentId);

  if (error) {
    console.error("[MP Transition] Failed to update payment status:", error.message);
    return false;
  }
  return true;
}

async function sendPaymentConfirmationEmail(
  admin: AdminClient,
  paymentId: string,
  realtorId: string,
  amountCentimos: number,
  providerPaymentId: string,
): Promise<void> {
  try {
    const { data: payment } = await admin
      .from("payments")
      .select("packet_id")
      .eq("id", paymentId)
      .single();

    if (!payment?.packet_id) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", realtorId)
      .single();

    if (!profile?.email) return;

    await sendPaymentConfirmation(
      admin,
      paymentId,
      payment.packet_id,
      amountCentimos,
      profile.email,
      providerPaymentId,
    );
  } catch (err) {
    console.error("[MP Transition] Payment confirmation email failed:", err);
  }
}

async function enqueuePaymentConfirmationEmail(
  admin: AdminClient,
  paymentId: string,
  realtorId: string,
  amountCentimos: number,
  providerPaymentId: string,
): Promise<void> {
  const { data: payment } = await admin
    .from("payments")
    .select("packet_id")
    .eq("id", paymentId)
    .single();

  if (!payment?.packet_id) {
    console.error("[MP Transition] Cannot enqueue email: payment or packet_id not found");
    return;
  }

  const { error } = await admin
    .from("notification_outbox")
    .upsert(
      {
        packet_id: payment.packet_id,
        event_type: "payment_confirmation",
        recipient_key: `realtor:${realtorId}`,
        payload: {
          role: "realtor",
          user_id: realtorId,
          payment_id: paymentId,
          amount_centimos: amountCentimos,
          provider_payment_id: providerPaymentId,
        },
        status: "pending",
        available_at: new Date().toISOString(),
      } as never,
      { onConflict: "packet_id,event_type,recipient_key", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(`Failed to enqueue payment confirmation: ${error.message}`);
  }
}
