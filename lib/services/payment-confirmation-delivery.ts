import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPaymentConfirmation } from "@/lib/services/notifications";

const CONFIRMATION_RECLAIM_THRESHOLD_MS = 5 * 60 * 1000;

export async function sendPaymentConfirmation(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string,
  packetId: string,
  amountCentimos: number,
  realtorEmail: string,
  providerPaymentId: string,
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
    const result = await notifyPaymentConfirmation({
      realtorEmail,
      realtorName: "",
      packetCode: fullPacket.packet_code ?? "",
      propertyAddress: fullPacket.property_address ?? "",
      amount: (amountCentimos / 100).toFixed(2),
      providerPaymentId,
      idempotencyKey: `payment-confirmation/${paymentId}`,
    });

    if (result.status !== "sent") {
      throw new Error(`Payment confirmation delivery failed: ${result.status}`);
    }

    const { error: updateError } = await admin.from("payments")
      .update({ payment_confirmation_sent_at: new Date().toISOString() } as never)
      .eq("id", paymentId);

    if (updateError) {
      throw new Error(`Failed to record payment_confirmation_sent_at: ${updateError.message}`);
    }
  } catch (err) {
    console.error("[sendPaymentConfirmation] Failed:", err);
    const claimedAt = now;
    await admin.from("payments")
      .update({
        payment_confirmation_error: err instanceof Error ? err.message : "Unknown error",
        payment_confirmation_claimed_at: null,
      } as never)
      .eq("id", paymentId)
      .eq("payment_confirmation_claimed_at", claimedAt);
    throw err;
  }
}
