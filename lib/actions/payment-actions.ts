"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivatePromoCode } from "@/lib/services/commercial-service";
import { isDemoPaymentsEnabled } from "@/lib/env/server";
import {
  createPayment,
  getPayment,
  recordPaymentResult,
  MercadoPagoAPIError,
} from "@/lib/services/mercadopago";
import type { PreparePaymentResult, ProcessPaymentResult } from "@/lib/services/mercadopago";
import { isValidRuc, isValidDni, normalizeDocNumber, normalizeRazonSocial } from "@/lib/utils/ruc-validation";

type ActionResult<T = null> = { error?: string; data?: T };

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// preparePaymentAction
// ---------------------------------------------------------------------------

const preparePaymentSchema = z.object({
  packetId: z.string().uuid(),
  comprobanteType: z.enum(["01", "03"]),
  purchaserTipoDoc: z.enum(["6", "1"]),
  purchaserNumDoc: z.string().min(1),
  purchaserRazonSocial: z.string().optional(),
  purchaserAddress: z
    .object({
      direccion: z.string().optional(),
      provincia: z.string().optional(),
      departamento: z.string().optional(),
      distrito: z.string().optional(),
      ubigueo: z.string().optional(),
    })
    .optional(),
  promoCode: z.string().trim().max(64).optional(),
});

const promoPreviewSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export interface PromoPreviewResult {
  codeHint: string;
  standardAmountCentimos: number;
  discountCentimos: number;
  amountCentimos: number;
  subtotalCentimos: number;
  igvCentimos: number;
  currency: string;
  validUntil: string;
}

export async function previewPrivatePromoAction(
  code: string,
): Promise<ActionResult<PromoPreviewResult>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = promoPreviewSchema.safeParse({ code });
  if (!parsed.success) return { error: "Ingresa un código promocional válido." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preview_private_promo", {
    p_realtor_id: userId,
    p_code_hash: hashPrivatePromoCode(parsed.data.code),
  });

  if (error) return { error: "El código promocional no es válido o ya expiró." };
  const result = data as {
    code_hint: string;
    standard_amount_centimos: number;
    discount_centimos: number;
    amount_centimos: number;
    subtotal_centimos: number;
    igv_centimos: number;
    currency: string;
    valid_until: string;
  } | null;
  if (!result) return { error: "No se pudo validar el código promocional." };

  return {
    data: {
      codeHint: result.code_hint,
      standardAmountCentimos: result.standard_amount_centimos,
      discountCentimos: result.discount_centimos,
      amountCentimos: result.amount_centimos,
      subtotalCentimos: result.subtotal_centimos,
      igvCentimos: result.igv_centimos,
      currency: result.currency,
      validUntil: result.valid_until,
    },
  };
}

export async function preparePaymentAction(
  params: z.infer<typeof preparePaymentSchema>,
): Promise<ActionResult<PreparePaymentResult>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = preparePaymentSchema.safeParse(params);
  if (!parsed.success) return { error: "Datos de facturación inválidos." };

  const packetId = parsed.data.packetId;
  const comprobanteType = parsed.data.comprobanteType;
  const purchaserTipoDoc = parsed.data.purchaserTipoDoc;
  const purchaserNumDoc = normalizeDocNumber(parsed.data.purchaserNumDoc);
  const purchaserRazonSocial = parsed.data.purchaserRazonSocial
    ? normalizeRazonSocial(parsed.data.purchaserRazonSocial)
    : null;
  const purchaserAddress = parsed.data.purchaserAddress as Record<string, string> ?? null;

  // Validate document number
  if (comprobanteType === "01") {
    if (!isValidRuc(purchaserNumDoc)) {
      return { error: "RUC inválido. Verifica el número e intenta de nuevo." };
    }
    if (!purchaserRazonSocial || purchaserRazonSocial.trim() === "") {
      return { error: "La razón social es obligatoria para facturas." };
    }
  } else if (comprobanteType === "03") {
    if (!isValidDni(purchaserNumDoc)) {
      return { error: "DNI inválido. Debe tener exactamente 8 dígitos." };
    }
    if (!purchaserRazonSocial || purchaserRazonSocial.trim() === "") {
      return { error: "El nombre completo del comprador es obligatorio para boletas." };
    }
  }

  const idempotencyKey = randomUUID();
  const admin = createAdminClient();
  const paymentProvider = isDemoPaymentsEnabled() ? "demo" : "mercadopago";

  const { data, error } = await admin.rpc("claim_commercial_payment_attempt", {
    p_packet_id: packetId,
    p_realtor_id: userId,
    p_payment_provider: paymentProvider,
    p_idempotency_key: idempotencyKey,
    p_comprobante_type: comprobanteType ?? undefined,
    p_purchaser_tipo_doc: purchaserTipoDoc ?? undefined,
    p_purchaser_num_doc: purchaserNumDoc ?? undefined,
    p_purchaser_razon_social: purchaserRazonSocial!,
    p_purchaser_address: purchaserAddress ?? undefined,
    p_promo_code_hash: parsed.data.promoCode
      ? hashPrivatePromoCode(parsed.data.promoCode)
      : undefined,
  });

  if (error) {
    console.error("[preparePaymentAction] RPC error:", error.message);
    return { error: error.message };
  }

  const result = data as {
    payment_id: string;
    existing_status: string;
    amount_centimos: number;
    standard_amount_centimos: number;
    discount_centimos: number;
    promo_code_hint: string | null;
    currency: string;
    claimed: boolean;
  } | null;

  if (!result?.payment_id) {
    return { error: "No se pudo preparar el intento de pago." };
  }

  if (result.existing_status === "completed") {
    return { error: "Este paquete ya tiene un pago completado." };
  }

  return {
    data: {
      paymentId: result.payment_id,
      amountCentimos: result.amount_centimos,
      standardAmountCentimos: result.standard_amount_centimos,
      discountCentimos: result.discount_centimos,
      promoCodeHint: result.promo_code_hint,
      currency: result.currency,
      idempotencyKey: result.claimed ? idempotencyKey : "",
      existingStatus: result.claimed ? "prepared" : result.existing_status,
    },
  };
}

// ---------------------------------------------------------------------------
// processCardPaymentAction
// ---------------------------------------------------------------------------

const processCardSchema = z.object({
  paymentId: z.string().uuid(),
  token: z.string().min(1),
  paymentMethodId: z.string().min(1),
  issuerId: z.string().optional(),
  installments: z.number().int().positive(),
  payerEmail: z.string().email(),
  payerIdentificationType: z.string().min(1),
  payerIdentificationNumber: z.string().min(1),
  deviceSessionId: z.string().optional(),
});

export async function processCardPaymentAction(
  params: z.infer<typeof processCardSchema>,
): Promise<ActionResult<ProcessPaymentResult>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = processCardSchema.safeParse(params);
  if (!parsed.success) return { error: "Datos de pago inválidos." };

  const admin = createAdminClient();
  const payment = await loadAndVerifyPayment(admin, parsed.data.paymentId, userId);
  if ("error" in payment) return { error: payment.error };

  const externalReference = `veradoc_pkt_${payment.packet_id}_pay_${payment.id}`;

  try {
    const mpResponse = await createPayment({
      token: parsed.data.token,
      transactionAmount: payment.amount_centimos / 100,
      description: `VeraDoc — Paquete de arrendamiento`,
      paymentMethodId: parsed.data.paymentMethodId,
      issuerId: parsed.data.issuerId,
      installments: parsed.data.installments,
      payerEmail: parsed.data.payerEmail,
      payerIdentificationType: parsed.data.payerIdentificationType,
      payerIdentificationNumber: parsed.data.payerIdentificationNumber,
      externalReference,
      metadata: {
        packet_id: payment.packet_id,
        payment_id: payment.id,
        realtor_id: userId,
      },
      idempotencyKey: payment.idempotency_key,
      deviceSessionId: parsed.data.deviceSessionId,
    });

    const transition = await recordPaymentResult(admin, payment.id, mpResponse, userId, { awaitEmail: true });
    return { data: transitionToResult(transition, String(mpResponse.id)) };
  } catch (err) {
    return handlePaymentError(err, admin, payment.id);
  }
}

// ---------------------------------------------------------------------------
// processYapePaymentAction
// ---------------------------------------------------------------------------

const processYapeSchema = z.object({
  paymentId: z.string().uuid(),
  token: z.string().min(1),
  payerEmail: z.string().email(),
  deviceSessionId: z.string().optional(),
});

export async function processYapePaymentAction(
  params: z.infer<typeof processYapeSchema>,
): Promise<ActionResult<ProcessPaymentResult>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = processYapeSchema.safeParse(params);
  if (!parsed.success) return { error: "Datos de pago inválidos." };

  const admin = createAdminClient();
  const payment = await loadAndVerifyPayment(admin, parsed.data.paymentId, userId);
  if ("error" in payment) return { error: payment.error };

  const externalReference = `veradoc_pkt_${payment.packet_id}_pay_${payment.id}`;

  try {
    const mpResponse = await createPayment({
      token: parsed.data.token,
      transactionAmount: payment.amount_centimos / 100,
      description: `VeraDoc — Paquete de arrendamiento`,
      paymentMethodId: "yape",
      installments: 1,
      payerEmail: parsed.data.payerEmail,
      payerIdentificationType: "DNI",
      payerIdentificationNumber: "00000000",
      externalReference,
      metadata: {
        packet_id: payment.packet_id,
        payment_id: payment.id,
        realtor_id: userId,
      },
      idempotencyKey: payment.idempotency_key,
      deviceSessionId: parsed.data.deviceSessionId,
    });

    const transition = await recordPaymentResult(admin, payment.id, mpResponse, userId, { awaitEmail: true });
    return { data: transitionToResult(transition, String(mpResponse.id)) };
  } catch (err) {
    return handlePaymentError(err, admin, payment.id);
  }
}

// ---------------------------------------------------------------------------
// pollPaymentStatusAction
// ---------------------------------------------------------------------------

export async function pollPaymentStatusAction(
  paymentId: string,
): Promise<ActionResult<ProcessPaymentResult>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select(
      "id, packet_id, realtor_id, amount_centimos, currency, status, payment_provider, payment_provider_ref, idempotency_key, updated_at",
    )
    .eq("id", paymentId)
    .single();

  if (error || !data) return { error: "Pago no encontrado." };
  if (data.realtor_id !== userId) return { error: "No autorizado." };
  if (data.payment_provider !== "mercadopago") return { error: "Proveedor de pago incorrecto." };

  if (data.status === "completed") {
    return { data: { status: "completed" } };
  }
  if (data.status === "failed" || data.status === "cancelled") {
    return { data: { status: "rejected", errorDetail: "El pago fue rechazado." } };
  }
  if (data.status !== "processing" && data.status !== "requires_action") {
    return { error: `Estado de pago no permite consulta: ${data.status}` };
  }

  if (!data.payment_provider_ref) {
    // No provider reference means createPayment never returned a response.
    // If the row has been in this state for over 5 minutes, it's stale --
    // mark as failed so the user can re-prepare. Any actual success will
    // arrive via webhook and be caught by the convergent transition service.
    const updatedAt = new Date(data.updated_at ?? 0).getTime();
    const staleThresholdMs = 5 * 60 * 1000;
    if (Date.now() - updatedAt > staleThresholdMs) {
      const { data: updated } = await admin
        .from("payments")
        .update({
          status: "failed",
          error_message: "Payment stuck without provider reference",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", paymentId)
        .eq("status", "processing")
        .select("id")
        .maybeSingle();

      if (updated) {
        return { data: { status: "rejected", errorDetail: "El pago no pudo ser verificado. Intenta de nuevo." } };
      }
      // Another process already advanced the state -- re-read and return.
      const { data: fresh } = await admin.from("payments").select("status").eq("id", paymentId).single();
      if (fresh?.status === "completed") return { data: { status: "completed" } };
      if (fresh?.status === "failed" || fresh?.status === "cancelled") {
        return { data: { status: "rejected", errorDetail: "El pago fue rechazado." } };
      }
      return { data: { status: "processing" } };
    }
    return { data: { status: "processing" } };
  }

  try {
    const mpResponse = await getPayment(data.payment_provider_ref);
    const transition = await recordPaymentResult(admin, data.id, mpResponse, userId, { awaitEmail: true });
    return { data: transitionToResult(transition, String(mpResponse.id)) };
  } catch (err) {
    if (err instanceof MercadoPagoAPIError) {
      return { data: { status: "error", errorDetail: "Error consultando estado del pago." } };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PaymentRow = {
  id: string;
  packet_id: string;
  realtor_id: string;
  amount_centimos: number;
  currency: string;
  status: string;
  payment_provider: string;
  payment_provider_ref: string | null;
  idempotency_key: string;
};

async function loadAndVerifyPayment(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
  userId: string,
  allowedStatuses: string[] = ["prepared"],
): Promise<PaymentRow | { error: string }> {
  const { data, error } = await admin
    .from("payments")
    .select(
      "id, packet_id, realtor_id, amount_centimos, currency, status, payment_provider, payment_provider_ref, idempotency_key",
    )
    .eq("id", paymentId)
    .single();

  if (error || !data) return { error: "Pago no encontrado." };
  if (data.realtor_id !== userId) return { error: "No autorizado." };
  if (data.payment_provider !== "mercadopago") return { error: "Proveedor de pago incorrecto." };
  if (!allowedStatuses.includes(data.status)) {
    if (data.status === "completed") return { error: "El pago ya fue completado." };
    return { error: `Estado de pago no permite esta operación: ${data.status}` };
  }

  return data as PaymentRow;
}

function transitionToResult(
  transition: Awaited<ReturnType<typeof recordPaymentResult>>,
  providerPaymentId: string,
): ProcessPaymentResult {
  switch (transition.outcome) {
    case "completed":
      return { status: "completed", providerPaymentId };
    case "already_completed":
      return { status: "completed" };
    case "requires_action":
      return {
        status: "requires_action",
        threeDSInfo: transition.threeDSInfo,
      };
    case "processing":
      return { status: "processing" };
    case "rejected":
      return { status: "rejected", errorDetail: transition.statusDetail };
    case "cancelled":
      return { status: "rejected", errorDetail: "Pago cancelado por el proveedor." };
    case "terminal_dispute":
      return { status: "error", errorDetail: transition.message };
    case "error":
      return { status: "error", errorDetail: transition.message };
  }
}

async function handlePaymentError(
  err: unknown,
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
): Promise<ActionResult<ProcessPaymentResult>> {
  if (err instanceof MercadoPagoAPIError) {
    console.error("[Payment Action] MP API error:", err.message);

    // Definitive client errors mean the request was unambiguously rejected
    // and will never succeed. Safe to mark as failed.
    // Exclude 408 (timeout) and 409 (conflict) as ambiguous.
    const isDefinitiveFailure = err.httpStatus >= 400
      && err.httpStatus < 500
      && err.httpStatus !== 408
      && err.httpStatus !== 409
      && err.httpStatus !== 429;

    if (isDefinitiveFailure) {
      await admin
        .from("payments")
        .update({
          status: "failed",
          error_code: String(err.httpStatus),
          error_message: err.message,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", paymentId);

      return {
        data: {
          status: "rejected",
          errorDetail: "Error procesando el pago. Intenta de nuevo.",
        },
      };
    }

    // Ambiguous errors (5xx, 408, 409, 429): MP may have processed the
    // payment. Mark as processing so the UI can poll and the five-minute
    // timeout recovery is reachable.
    await admin
      .from("payments")
      .update({
        status: "processing",
        error_message: `Ambiguous provider error (${err.httpStatus}): ${err.message}`,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", paymentId)
      .in("status", ["prepared", "processing"]);

    return {
      data: { status: "processing" },
    };
  }

  // Network failures (AbortError from timeout, TypeError from fetch, etc.)
  // are ambiguous -- MP may have received and processed the request.
  if (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TypeError" || err.message.includes("fetch"))
  ) {
    console.error("[Payment Action] Network error:", err.message);

    await admin
      .from("payments")
      .update({
        status: "processing",
        error_message: `Network error: ${err.message}`,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", paymentId)
      .in("status", ["prepared", "processing"]);

    return {
      data: { status: "processing" },
    };
  }

  throw err;
}
