import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCharge } from "@/lib/services/culqi-service";
import { sendPaymentConfirmation } from "@/lib/actions/payment-actions";
import type { Json } from "@/lib/supabase/database.types";

const MAX_BODY_BYTES = 65_536;
const OBJECT_ID_PATTERN = /^(chr|rfn)_(test|live)_[a-zA-Z0-9]+$/;

const CHARGE_SUCCESS_EVENTS = new Set(["charge.creation.succeeded", "charge.succeeded"]);
const CHARGE_FAILED_EVENTS = new Set(["charge.creation.failed", "charge.failed"]);
const ALL_KNOWN_EVENTS = new Set([...CHARGE_SUCCESS_EVENTS, ...CHARGE_FAILED_EVENTS]);

type EventResult = "processed" | "ignored" | "retryable_failure" | "permanent_failure";

export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = typeof body.type === "string" ? body.type : undefined;
    const objectData = body.data as Record<string, unknown> | undefined;
    const objectId = typeof objectData?.id === "string" ? objectData.id : "";

    if (!eventType || !ALL_KNOWN_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
    }
    if (!OBJECT_ID_PATTERN.test(objectId)) {
      return NextResponse.json({ error: "Invalid object ID format" }, { status: 400 });
    }

    const payloadHash = crypto.createHash("sha256").update(raw).digest("hex");

    const { data: claim, error: claimErr } = await admin.rpc("claim_webhook_processing", {
      p_provider: "culqi",
      p_event_type: eventType,
      p_object_id: objectId,
      p_payload_hash: payloadHash,
      p_raw_payload: body as unknown as Json,
      p_stale_threshold_seconds: 300,
    });

    if (claimErr) {
      console.error("[Culqi Webhook] Claim RPC error:", claimErr);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (!claim?.owned) {
      if (claim?.already_processed) {
        return NextResponse.json({ status: "already_processed" }, { status: 200 });
      }
      return NextResponse.json({ status: "active_duplicate" }, { status: 200 });
    }

    let result: EventResult = "ignored";

    if (CHARGE_SUCCESS_EVENTS.has(eventType)) {
      result = await handleChargeSucceeded(objectId, admin);
    } else if (CHARGE_FAILED_EVENTS.has(eventType)) {
      result = await handleChargeFailed(objectId, admin);
    }

    const { error: updateErr } = await admin
      .from("payment_webhook_events")
      .update({ processing_result: result, processed_at: new Date().toISOString() })
      .eq("id", claim.event_id!);

    if (updateErr) {
      console.error("[Culqi Webhook] Final event update failed:", updateErr);
      return NextResponse.json({ error: "State update failed" }, { status: 500 });
    }

    if (result === "retryable_failure") {
      return NextResponse.json({ status: "retry" }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[Culqi Webhook] Unhandled error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function findPaymentByCharge(
  chargeId: string,
  chargeMetadata: Record<string, string> | null | undefined,
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: byRef } = await admin
    .from("payments")
    .select("id, packet_id, amount_centimos, currency, status, payment_provider_ref, realtor_id")
    .eq("payment_provider_ref", chargeId)
    .maybeSingle();

  if (byRef) return byRef;

  const paymentId = chargeMetadata?.payment_id;
  if (paymentId) {
    const { data: byMeta } = await admin
      .from("payments")
      .select("id, packet_id, amount_centimos, currency, status, payment_provider_ref, realtor_id")
      .eq("id", paymentId)
      .in("status", ["charging", "verifying"])
      .maybeSingle();

    if (byMeta) return byMeta;
  }

  return null;
}

async function handleChargeSucceeded(
  chargeId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<EventResult> {
  const chargeResult = await getCharge(chargeId);
  if (!chargeResult.ok) return "retryable_failure";

  const charge = chargeResult.data;
  if (charge.response_code !== "venta_exitosa") return "ignored";

  const payment = await findPaymentByCharge(
    chargeId,
    (charge as Record<string, unknown>).metadata as Record<string, string> | null,
    admin,
  );
  if (!payment) return "ignored";
  if (payment.status === "completed") return "processed";

  const method = charge.source?.type === "yape" || charge.source?.id?.startsWith("ype") ? "yape" : "card";
  const chargeCurrency = (charge as Record<string, unknown>).currency_code as string
    ?? (charge as Record<string, unknown>).currency as string
    ?? "PEN";

  const { data: rpcResult, error: rpcError } = await admin.rpc("process_payment_success", {
    p_payment_id: payment.id,
    p_charge_id: chargeId,
    p_charge_amount_centimos: charge.amount,
    p_charge_currency: chargeCurrency,
    p_payment_method: method,
    p_actor_id: null,
  });

  if (rpcError) {
    console.error("[Culqi Webhook] RPC failed:", rpcError);
    return "retryable_failure";
  }

  const outcome = rpcResult?.outcome;
  switch (outcome) {
    case "completed": {
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", payment.realtor_id)
        .single();
      if (profile?.email) {
        await sendPaymentConfirmation(
          admin, payment.id, payment.packet_id,
          payment.amount_centimos!, profile.email, chargeId,
        );
      }
      return "processed";
    }
    case "already_completed_same_charge":
      return "processed";
    case "already_completed_conflict":
      console.error("[Culqi Webhook] CRITICAL: Conflict for payment:", payment.id, "charge:", chargeId);
      return "permanent_failure";
    case "amount_mismatch":
    case "currency_mismatch":
      console.error("[Culqi Webhook] Mismatch:", outcome, "payment:", payment.id, "charge:", chargeId);
      return "permanent_failure";
    case "invalid_status":
      return "retryable_failure";
    default:
      console.error("[Culqi Webhook] Unknown outcome:", outcome);
      return "retryable_failure";
  }
}

async function handleChargeFailed(
  chargeId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<EventResult> {
  const chargeResult = await getCharge(chargeId);
  const charge = chargeResult.ok ? chargeResult.data : undefined;

  const payment = await findPaymentByCharge(
    chargeId,
    charge ? (charge as Record<string, unknown>).metadata as Record<string, string> | null : null,
    admin,
  );
  if (!payment) return "ignored";
  if (payment.status === "failed" || payment.status === "completed") return "processed";

  const { error } = await admin
    .from("payments")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  return error ? "retryable_failure" : "processed";
}
