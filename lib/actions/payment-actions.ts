"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldUseMockPayment, requireCulqiReady } from "@/lib/env/server";
import { createCharge } from "@/lib/services/culqi-service";
import { createMockCharge } from "@/lib/services/culqi-mock";
import { getPacketPricing } from "@/lib/services/pricing-service";
import { notifyPaymentConfirmation } from "@/lib/services/notifications";
import { ProcessPaymentInputSchema, Complete3DSInputSchema } from "@/lib/services/culqi-types";
import type { CreateChargeResult } from "@/lib/services/culqi-types";

type ActionResult<T = null> = { error?: string; data?: T };

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function derivePaymentMethod(source: { type: string; id: string }): string {
  if (source.type === "yape" || source.id.startsWith("ype")) return "yape";
  return "card";
}

function hashToken(tokenId: string): string {
  return crypto.createHash("sha256").update(tokenId).digest("hex");
}

// ---------------------------------------------------------------------------
// preparePaymentAction — call BEFORE opening Checkout
// ---------------------------------------------------------------------------

interface PreparePaymentResult {
  paymentId: string;
  amountCentimos: number;
  currency: string;
  description: string;
  challengeNonce: string;
}

export async function preparePaymentAction(
  packetId: string
): Promise<ActionResult<PreparePaymentResult>> {
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado." };
  if (!user.email) return { error: "Cuenta sin correo electrónico." };

  const admin = createAdminClient();
  const pricing = await getPacketPricing();

  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`${packetId}:${user.id}`)
    .digest("hex");

  const challengeNonce = crypto.randomUUID();

  const { data: claimResult, error: claimError } = await admin.rpc("claim_payment_attempt", {
    p_packet_id: packetId,
    p_realtor_id: user.id,
    p_amount_centimos: pricing.amountCentimos,
    p_currency: pricing.currency,
    p_idempotency_key: idempotencyKey,
    p_challenge_nonce: challengeNonce,
  });

  if (claimError) {
    console.error("[preparePayment] Claim RPC failed:", claimError);
    const msg = claimError.message ?? "";
    if (msg.includes("not owned")) return { error: "No tiene acceso a este paquete." };
    if (msg.includes("not in draft")) return { error: "El paquete ya no está en borrador." };
    return { error: "Error al preparar el pago." };
  }
  if (!claimResult) return { error: "Error al preparar el pago." };

  if (!claimResult.claimed) {
    const s = claimResult.existing_status;
    if (s === "prepared") {
      return { data: {
        paymentId: claimResult.payment_id!,
        amountCentimos: claimResult.amount_centimos!,
        currency: claimResult.currency!,
        description: pricing.description,
        challengeNonce: claimResult.challenge_nonce!,
      }};
    }
    if (s === "completed") return { error: "Este paquete ya tiene un pago confirmado." };
    return { error: "Hay un intento de pago en proceso. Espere un momento." };
  }

  return { data: {
    paymentId: claimResult.payment_id!,
    amountCentimos: claimResult.amount_centimos!,
    currency: claimResult.currency!,
    description: pricing.description,
    challengeNonce: claimResult.challenge_nonce!,
  }};
}

// ---------------------------------------------------------------------------
// processPaymentAction — process token from Checkout
// ---------------------------------------------------------------------------

type ProcessPaymentResult =
  | { kind: "succeeded"; chargeId: string }
  | { kind: "requires_3ds"; challengeNonce: string }
  | { kind: "declined"; message: string }
  | { kind: "uncertain"; message: string };

export async function processPaymentAction(
  rawInput: unknown
): Promise<ActionResult<ProcessPaymentResult>> {
  const parsed = ProcessPaymentInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Datos de pago inválidos." };
  const input = parsed.data;

  const user = await getAuthUser();
  if (!user) return { error: "No autenticado." };
  if (!user.email) return { error: "Cuenta sin correo electrónico." };

  const admin = createAdminClient();

  const readiness = requireCulqiReady();
  if (!readiness.ok) return { error: readiness.reason };

  const tokenHash = hashToken(input.tokenId);
  const { data: claimed, error: claimErr } = await admin.rpc("claim_charging", {
    p_payment_id: input.paymentId,
    p_realtor_id: user.id,
    p_from_status: "prepared",
    p_device_finger_print_id: input.deviceFingerPrintId ?? null,
    p_source_token_hash: tokenHash,
  });

  if (claimErr || !claimed?.payment_id) {
    return { error: "El pago ya está siendo procesado o no le pertenece." };
  }

  const useMock = shouldUseMockPayment();
  const chargeResult: CreateChargeResult = useMock
    ? createMockCharge({
        amount: claimed.amount_centimos!,
        currency_code: claimed.currency as "PEN",
        source_id: input.tokenId,
        email: user.email,
        metadata: { packet_id: claimed.packet_id!, payment_id: input.paymentId },
      })
    : await createCharge({
        amount: claimed.amount_centimos!,
        currency_code: claimed.currency as "PEN",
        source_id: input.tokenId,
        email: user.email,
        metadata: { packet_id: claimed.packet_id!, payment_id: input.paymentId },
        antifraud_details: input.deviceFingerPrintId
          ? { device_finger_print_id: input.deviceFingerPrintId, email: user.email }
          : undefined,
      });

  return handleChargeResult(chargeResult, input.paymentId, claimed.packet_id!,
    claimed.amount_centimos!, claimed.currency!, user.id, user.email);
}

// ---------------------------------------------------------------------------
// completePayment3DSAction — retry with 3DS authentication fields
// ---------------------------------------------------------------------------

export async function completePayment3DSAction(
  rawInput: unknown
): Promise<ActionResult<ProcessPaymentResult>> {
  const parsed = Complete3DSInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Datos de autenticación 3DS inválidos." };
  const input = parsed.data;

  const user = await getAuthUser();
  if (!user) return { error: "No autenticado." };
  if (!user.email) return { error: "Cuenta sin correo electrónico." };

  const admin = createAdminClient();

  const readiness = requireCulqiReady();
  if (!readiness.ok) return { error: readiness.reason };

  const { data: claimed, error: claimErr } = await admin.rpc("claim_charging", {
    p_payment_id: input.paymentId,
    p_realtor_id: user.id,
    p_from_status: "requires_3ds",
  });

  if (claimErr || !claimed?.payment_id) {
    return { error: "La autenticación 3DS ya fue completada o el pago no le pertenece." };
  }

  if (claimed.challenge_nonce !== input.challengeNonce) {
    await safeTransition(admin, input.paymentId, "charging", "requires_3ds");
    return { error: "Nonce de autenticación no coincide." };
  }

  if (!claimed.source_token_hash || hashToken(input.tokenId) !== claimed.source_token_hash) {
    await safeTransition(admin, input.paymentId, "charging", "requires_3ds");
    return { error: "El token de pago no coincide con el intento original." };
  }

  const chargeResult = await createCharge({
    amount: claimed.amount_centimos!,
    currency_code: claimed.currency as "PEN",
    source_id: input.tokenId,
    email: user.email,
    metadata: { packet_id: claimed.packet_id!, payment_id: input.paymentId },
    antifraud_details: claimed.device_finger_print_id
      ? { device_finger_print_id: claimed.device_finger_print_id, email: user.email }
      : undefined,
    authentication_3DS: input.authentication3DS,
  });

  return handleChargeResult(chargeResult, input.paymentId, claimed.packet_id!,
    claimed.amount_centimos!, claimed.currency!, user.id, user.email);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeTransition(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
  fromStatus: string,
  toStatus: string,
  extra?: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await admin
    .from("payments")
    .update({ status: toStatus, updated_at: new Date().toISOString(), ...extra } as never)
    .eq("id", paymentId)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[safeTransition] Failed ${fromStatus}→${toStatus} for ${paymentId}:`, error);
    return false;
  }
  return !!data;
}

async function handleChargeResult(
  result: CreateChargeResult,
  paymentId: string,
  packetId: string,
  amountCentimos: number,
  currency: string,
  userId: string,
  userEmail: string,
): Promise<ActionResult<ProcessPaymentResult>> {
  const admin = createAdminClient();

  switch (result.kind) {
    case "succeeded": {
      const charge = result.charge;
      const method = derivePaymentMethod(charge.source);
      const chargeCurrency = (charge as Record<string, unknown>).currency_code as string
        ?? (charge as Record<string, unknown>).currency as string
        ?? currency;

      const { data: rpcResult, error: rpcError } = await admin.rpc("process_payment_success", {
        p_payment_id: paymentId,
        p_charge_id: charge.id,
        p_charge_amount_centimos: charge.amount,
        p_charge_currency: chargeCurrency,
        p_payment_method: method,
        p_actor_id: userId,
      });

      if (rpcError) {
        console.error("[handleChargeResult] RPC failed:", rpcError);
        return { error: "Pago procesado pero error al registrar. Contacte soporte." };
      }

      const outcome = rpcResult?.outcome;

      switch (outcome) {
        case "completed": {
          void sendPaymentConfirmation(admin, paymentId, packetId, amountCentimos, userEmail, charge.id);
          revalidatePath("/agente");
          return { data: { kind: "succeeded", chargeId: charge.id } };
        }
        case "already_completed_same_charge": {
          revalidatePath("/agente");
          return { data: { kind: "succeeded", chargeId: charge.id } };
        }
        case "already_completed_conflict": {
          console.error("[handleChargeResult] CRITICAL: Different charge for payment:", paymentId);
          return { error: "Error crítico: existe un cargo diferente para este pago. Contacte soporte." };
        }
        case "amount_mismatch": {
          console.error("[handleChargeResult] Amount mismatch:", { expected: amountCentimos, got: charge.amount });
          return { error: "Discrepancia en el monto cobrado. Contacte soporte." };
        }
        case "currency_mismatch": {
          return { error: "Discrepancia en la moneda. Contacte soporte." };
        }
        case "invalid_status": {
          return { error: "Estado de pago inesperado. Contacte soporte." };
        }
        default: {
          console.error("[handleChargeResult] Unknown RPC outcome:", outcome);
          return { error: "Error inesperado al completar el pago. Contacte soporte." };
        }
      }
    }

    case "requires_3ds": {
      await safeTransition(admin, paymentId, "charging", "requires_3ds");

      const { data: paymentRow } = await admin.from("payments")
        .select("challenge_nonce")
        .eq("id", paymentId)
        .single();

      return { data: { kind: "requires_3ds", challengeNonce: paymentRow?.challenge_nonce ?? "" } };
    }

    case "declined": {
      const msg = result.error.user_message || "El pago fue rechazado.";
      await safeTransition(admin, paymentId, "charging", "failed", {
        error_code: result.error.code, error_message: msg,
      });

      await admin.from("packet_audit_log").insert({
        packet_id: packetId, actor_id: userId, action: "payment_failed",
        metadata: { error_code: result.error.code, message: msg },
      });

      revalidatePath("/agente");
      return { data: { kind: "declined", message: msg } };
    }

    case "uncertain": {
      await safeTransition(admin, paymentId, "charging", "verifying", {
        error_message: result.reason,
      });

      await admin.from("packet_audit_log").insert({
        packet_id: packetId, actor_id: userId, action: "payment_verifying",
        metadata: { reason: result.reason },
      });

      revalidatePath("/agente");
      return { data: { kind: "uncertain", message: result.userMessage } };
    }
  }
}

const CONFIRMATION_RECLAIM_THRESHOLD_MS = 5 * 60 * 1000;

export async function sendPaymentConfirmation(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
  packetId: string,
  amountCentimos: number,
  realtorEmail: string,
  chargeId: string,
) {
  const { data: existing } = await admin
    .from("payments")
    .select("payment_confirmation_sent_at, payment_confirmation_claimed_at, payment_confirmation_attempts")
    .eq("id", paymentId)
    .single();

  if (existing?.payment_confirmation_sent_at) return;

  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - CONFIRMATION_RECLAIM_THRESHOLD_MS).toISOString();

  const { data: claimed } = await admin
    .from("payments")
    .update({
      payment_confirmation_claimed_at: now,
      payment_confirmation_attempts: (existing?.payment_confirmation_attempts ?? 0) + 1,
      payment_confirmation_error: null,
    } as never)
    .eq("id", paymentId)
    .is("payment_confirmation_sent_at", null)
    .or(`payment_confirmation_claimed_at.is.null,payment_confirmation_claimed_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();

  if (!claimed) return;

  const { data: fullPacket } = await admin
    .from("lease_packets")
    .select("packet_code, property_address")
    .eq("id", packetId)
    .single();

  if (!fullPacket) return;

  try {
    await notifyPaymentConfirmation({
      realtorEmail,
      realtorName: "",
      packetCode: fullPacket.packet_code ?? "",
      propertyAddress: fullPacket.property_address ?? "",
      amount: (amountCentimos / 100).toFixed(2),
      chargeId,
    });

    await admin.from("payments")
      .update({ payment_confirmation_sent_at: new Date().toISOString() } as never)
      .eq("id", paymentId);
  } catch (err) {
    console.error("[sendPaymentConfirmation] Failed:", err);
    await admin.from("payments")
      .update({
        payment_confirmation_error: err instanceof Error ? err.message : "Unknown error",
      } as never)
      .eq("id", paymentId);
  }
}
