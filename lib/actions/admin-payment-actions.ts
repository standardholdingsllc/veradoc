"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRefund, getPayment, MercadoPagoAPIError } from "@/lib/services/mercadopago/service";
import { recordPaymentResult } from "@/lib/services/mercadopago/transition";
import { hasRequiredAdminMfa } from "@/lib/auth/mfa";
import { getCommercialAccountingUnavailableError } from "@/lib/admin/commercial-accounting";

type ActionResult<T = null> = { error?: string; data?: T };

const REFUND_WINDOW_DAYS = 90;

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile?.status !== "active") return null;
  if (!(await hasRequiredAdminMfa())) return null;
  return user.id;
}

// ---------------------------------------------------------------------------
// refundPaymentAction
// ---------------------------------------------------------------------------

const refundSchema = z.object({
  paymentId: z.string().uuid(),
  requestId: z.string().uuid(),
  amountCentimos: z.number().int().positive(),
  reasonCode: z.enum(["01", "02", "06", "07", "09"]),
  reasonDescription: z.string().min(1).max(250),
  policyReason: z.enum([
    "duplicate_charge",
    "incorrect_amount",
    "unauthorized_payment",
    "veradoc_failure",
    "mandatory_remedy",
  ]),
  approvalEvidence: z.string().trim().min(10).max(500),
});

export async function refundPaymentAction(
  params: z.infer<typeof refundSchema>,
): Promise<ActionResult<{ refundId: string; refundedAmount: number }>> {
  const adminUserId = await requireAdmin();
  if (!adminUserId) return { error: "No autorizado." };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };

  const admin = createAdminClient();

  const parsed = refundSchema.safeParse(params);
  if (!parsed.success) return { error: "Datos de reembolso inválidos." };

  const {
    paymentId,
    requestId,
    reasonCode,
    reasonDescription,
    policyReason,
    approvalEvidence,
  } = parsed.data;
  let amountCentimos = parsed.data.amountCentimos;

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, packet_id, status, payment_provider, payment_provider_ref, amount_centimos, paid_at")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) return { error: "Pago no encontrado." };
  if (payment.payment_provider !== "mercadopago") {
    return { error: "Solo se pueden reembolsar pagos de Mercado Pago." };
  }
  if (payment.status !== "completed" && payment.status !== "partially_refunded") {
    return { error: `Estado de pago no permite reembolso: ${payment.status}` };
  }
  if (!payment.payment_provider_ref) {
    return { error: "No existe referencia del proveedor." };
  }

  if (payment.paid_at) {
    const paidDate = new Date(payment.paid_at);
    const windowEnd = new Date(paidDate.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > windowEnd) {
      return { error: `El período de reembolso de ${REFUND_WINDOW_DAYS} días ha expirado.` };
    }
  }

  // If amount not specified, refund remaining
  if (amountCentimos <= 0) {
    if (!payment.amount_centimos) {
      return { error: "El pago no tiene monto registrado." };
    }
    amountCentimos = payment.amount_centimos;
  }

  const providerIdempotencyKey = randomUUID();

  // Claim or reuse refund row
  const { data: claimResult, error: claimError } = await admin.rpc("claim_policy_payment_refund", {
    p_payment_id: paymentId,
    p_request_id: requestId,
    p_requested_by: adminUserId,
    p_amount_centimos: amountCentimos,
    p_reason_code: reasonCode,
    p_reason_description: reasonDescription,
    p_idempotency_key: providerIdempotencyKey,
    p_policy_reason: policyReason,
    p_approval_evidence: approvalEvidence,
  });

  if (claimError) {
    console.error("[Admin Refund] claim_payment_refund error:", claimError.message);
    return { error: claimError.message };
  }

  const claim = claimResult as Record<string, unknown>;
  if (!claim) return { error: "No se pudo preparar el reembolso." };

  if (claim.status === "succeeded") {
    return { data: { refundId: claim.refund_id as string, refundedAmount: (claim.amount_centimos as number) / 100 } };
  }

  const actualIdempotencyKey = claim.provider_idempotency_key as string;
  const refundAmountSoles = (claim.amount_centimos as number) / 100;

  try {
    const refundResponse = await createRefund(
      payment.payment_provider_ref,
      refundAmountSoles,
      actualIdempotencyKey,
    );

    const providerAmountCentimos = Math.round(refundResponse.amount * 100);

    // Complete the refund atomically
    const { error: completeError } = await admin.rpc("complete_payment_refund", {
      p_refund_id: claim.refund_id as string,
      p_provider_refund_id: String(refundResponse.id),
      p_provider_amount_centimos: providerAmountCentimos,
      p_provider_response: {
        id: refundResponse.id,
        status: refundResponse.status,
        amount: refundResponse.amount,
      },
    });

    if (completeError) {
      console.error("[Admin Refund] complete_payment_refund error:", completeError.message);
      return {
        error: `Reembolso procesado en Mercado Pago (ID: ${refundResponse.id}), pero no se pudo completar el registro local. Ejecute reconciliación con request_id: ${requestId}`,
      };
    }

    return {
      data: {
        refundId: claim.refund_id as string,
        refundedAmount: refundResponse.amount,
      },
    };
  } catch (err) {
    if (err instanceof MercadoPagoAPIError) {
      console.error("[Admin Refund] MP error:", err.message, "status:", err.httpStatus);

      // Only specific 4xx codes are definitive business rejections where
      // we can be certain MP never processed the refund:
      //   400 = bad request (invalid params, amount exceeds, etc.)
      //   404 = payment/refund target not found
      // Transient 4xx codes that must NOT be treated as definitive:
      //   409 = conflict/idempotency race
      //   423 = locked (MP temporary lock)
      //   429 = rate limit
      // All 5xx and network errors are ambiguous (MP may have processed).
      const DEFINITIVE_REJECTION_CODES = new Set([400, 404]);
      const isDefinitiveRejection = DEFINITIVE_REJECTION_CODES.has(err.httpStatus);

      await admin
        .from("payment_refunds")
        .update({
          status: isDefinitiveRejection ? "failed" : "pending",
          provider_response: { error: err.message, status: err.httpStatus },
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", claim.refund_id as string)
        .eq("status", "pending");

      const hint = isDefinitiveRejection
        ? ""
        : " El estado del reembolso en Mercado Pago es ambiguo — reconcilie antes de reintentar.";
      return { error: `Error de Mercado Pago: ${err.message}${hint}` };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// reconcilePaymentAction
// ---------------------------------------------------------------------------

export async function reconcilePaymentAction(
  paymentId: string,
): Promise<ActionResult<{ outcome: string; providerStatus: string }>> {
  const adminUserId = await requireAdmin();
  if (!adminUserId) return { error: "No autorizado." };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };

  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, packet_id, realtor_id, status, payment_provider, payment_provider_ref, amount_centimos, currency")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) return { error: "Pago no encontrado." };
  if (payment.payment_provider !== "mercadopago") {
    return { error: "Solo se pueden reconciliar pagos de Mercado Pago." };
  }
  if (!payment.payment_provider_ref) {
    return { error: "No existe referencia del proveedor para consultar." };
  }

  try {
    const mpPayment = await getPayment(payment.payment_provider_ref);

    // Verify amount and currency match
    const providerAmountCentimos = Math.round(mpPayment.transaction_amount * 100);
    if (payment.amount_centimos !== providerAmountCentimos) {
      return {
        error: `Monto no coincide: local=${payment.amount_centimos}, proveedor=${providerAmountCentimos}`,
      };
    }
    if (payment.currency !== mpPayment.currency_id) {
      return {
        error: `Moneda no coincide: local=${payment.currency}, proveedor=${mpPayment.currency_id}`,
      };
    }

    // Verify external_reference matches
    const expectedRef = `veradoc_pkt_${payment.packet_id}_pay_${payment.id}`;
    if (mpPayment.external_reference && mpPayment.external_reference !== expectedRef) {
      return {
        error: `external_reference no coincide: esperado=${expectedRef}, recibido=${mpPayment.external_reference}`,
      };
    }

    const result = await recordPaymentResult(admin, payment.id, mpPayment, payment.realtor_id);

    // Audit log
    await admin.from("packet_audit_log").insert({
      packet_id: payment.packet_id,
      actor_id: adminUserId,
      action: "payment_reconciled",
      metadata: {
        payment_id: paymentId,
        provider_status: mpPayment.status,
        provider_status_detail: mpPayment.status_detail,
        transition_outcome: result.outcome,
      },
    } as never);

    return {
      data: {
        outcome: result.outcome,
        providerStatus: `${mpPayment.status} (${mpPayment.status_detail})`,
      },
    };
  } catch (err) {
    if (err instanceof MercadoPagoAPIError) {
      console.error("[Admin Reconcile] MP error:", err.message);
      return { error: `Error de Mercado Pago: ${err.message}` };
    }
    throw err;
  }
}
