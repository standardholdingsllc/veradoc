import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMercadoPagoWebhook } from "@/lib/services/mercadopago/webhook-verify";
import { getPayment } from "@/lib/services/mercadopago/service";
import { recordPaymentResult } from "@/lib/services/mercadopago/transition";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge test pings
  if (body.type === "test") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Only handle payment topic
  if (body.type !== "payment") {
    return NextResponse.json({ ignored: true }, { status: 200 });
  }

  // Verify webhook signature
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!verifyMercadoPagoWebhook({ xSignature, xRequestId, dataId })) {
    console.error("[MP Webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const providerPaymentId = dataId ?? String((body.data as { id?: string })?.id ?? "");
  if (!providerPaymentId) {
    return NextResponse.json({ error: "Missing data.id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Deduplicate via claim_webhook_processing
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");

  const action = typeof body.action === "string" ? body.action : "unknown";

  const { data: claimResult, error: claimError } = await admin.rpc(
    "claim_webhook_processing",
    {
      p_provider: "mercadopago",
      p_event_type: action,
      p_object_id: providerPaymentId,
      p_payload_hash: payloadHash,
      p_raw_payload: body as unknown as Record<string, never>,
    },
  );

  if (claimError) {
    console.error("[MP Webhook] claim_webhook_processing error:", claimError.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const claim = claimResult as {
    event_id: string;
    owned: boolean;
    already_processed: boolean;
  } | null;

  if (!claim?.owned) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    // Fetch authoritative payment state from Mercado Pago
    const mpPayment = await getPayment(providerPaymentId);

    // Parse external_reference to find local payment
    const extRef = mpPayment.external_reference ?? "";
    const refMatch = extRef.match(/^veradoc_pkt_(.+)_pay_(.+)$/);
    if (!refMatch) {
      console.error("[MP Webhook] Invalid external_reference:", extRef);
      await markWebhookResult(admin, claim.event_id, "ignored");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const [, packetId, paymentId] = refMatch;

    // Verify the local payment exists and matches
    const { data: localPayment } = await admin
      .from("payments")
      .select("id, packet_id, realtor_id, amount_centimos, currency, payment_provider")
      .eq("id", paymentId)
      .single();

    if (!localPayment) {
      console.error("[MP Webhook] Local payment not found:", paymentId);
      await markWebhookResult(admin, claim.event_id, "permanent_failure");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (localPayment.packet_id !== packetId) {
      console.error("[MP Webhook] Packet ID mismatch");
      await markWebhookResult(admin, claim.event_id, "permanent_failure");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (localPayment.payment_provider !== "mercadopago") {
      console.error("[MP Webhook] Provider mismatch");
      await markWebhookResult(admin, claim.event_id, "permanent_failure");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Verify amount matches
    const providerAmountCentimos = Math.round(mpPayment.transaction_amount * 100);
    if (localPayment.amount_centimos !== providerAmountCentimos) {
      console.error(
        `[MP Webhook] Amount mismatch: local=${localPayment.amount_centimos}, provider=${providerAmountCentimos}`,
      );
      await markWebhookResult(admin, claim.event_id, "permanent_failure");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (localPayment.currency !== mpPayment.currency_id) {
      console.error("[MP Webhook] Currency mismatch");
      await markWebhookResult(admin, claim.event_id, "permanent_failure");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Route through the convergent transition service
    const result = await recordPaymentResult(
      admin,
      localPayment.id,
      mpPayment,
      localPayment.realtor_id,
    );

    // Only true transient errors should trigger MP redelivery.
    // Business-terminal outcomes (disputes, chargebacks) are permanent.
    const isRetryable = result.outcome === "error";
    const webhookStatus = isRetryable ? "retryable_failure" : "processed";
    await markWebhookResult(admin, claim.event_id, webhookStatus);

    if (isRetryable) {
      return NextResponse.json({ error: "Transient failure" }, { status: 500 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[MP Webhook] Processing error:", err);
    await markWebhookResult(admin, claim.event_id, "retryable_failure");
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }
}

async function markWebhookResult(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  result: string,
): Promise<void> {
  await admin
    .from("payment_webhook_events")
    .update({
      processing_result: result,
      processed_at: result === "processed" ? new Date().toISOString() : null,
    } as never)
    .eq("id", eventId);
}
