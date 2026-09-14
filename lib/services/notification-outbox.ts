import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS_STATUS_CHECK = 8;

function backoffMs(attemptCount: number, eventType?: string): number {
  // Status checks need much longer backoff since SUNAT CDR can take hours.
  // Progression: ~2min, 5min, 15min, 30min, 60min, 60min, 60min, 60min (~4.5h total)
  if (eventType === "cpe_status_check") {
    const STATUS_BACKOFF_MS = [
      2 * 60_000,   // 2 min
      5 * 60_000,   // 5 min
      15 * 60_000,  // 15 min
      30 * 60_000,  // 30 min
      60 * 60_000,  // 60 min
      60 * 60_000,  // 60 min
      60 * 60_000,  // 60 min
      60 * 60_000,  // 60 min
    ];
    return STATUS_BACKOFF_MS[Math.min(attemptCount, STATUS_BACKOFF_MS.length - 1)];
  }
  // Default: generic exponential backoff capped at 15 min
  return Math.min(1000 * Math.pow(2, attemptCount), 15 * 60_000);
}

export async function processOutboxBatch(
  admin: SupabaseClient<Database>,
  batchSize: number = 10,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_notification_outbox",
    { p_limit: batchSize },
  );

  if (claimError || !claimed || claimed.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  const skipped = 0;

  for (const row of claimed) {
    try {
      await dispatchNotification(
        row.event_type,
        row.packet_id,
        row.payload as Record<string, unknown>,
        admin,
        row.id,
        row.claim_token,
      );

      const { data: updatedRows } = await admin
        .from("notification_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", row.claim_token)
        .select("id");

      if (updatedRows && updatedRows.length > 0) {
        sent++;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      const maxAttempts = row.event_type === "cpe_status_check"
        ? MAX_ATTEMPTS_STATUS_CHECK
        : MAX_ATTEMPTS;
      const nextAvailableAt = new Date(
        Date.now() + backoffMs(row.attempt_count, row.event_type),
      ).toISOString();

      const { data: failedRows } = await admin
        .from("notification_outbox")
        .update({
          status: row.attempt_count >= maxAttempts ? "failed" : "pending",
          last_error: errorMessage.slice(0, 1000),
          available_at: nextAvailableAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", row.claim_token)
        .select("id");

      if (failedRows && failedRows.length > 0) {
        failed++;
      }
    }
  }

  return { sent, failed, skipped };
}

async function dispatchNotification(
  eventType: string,
  packetId: string,
  payload: Record<string, unknown>,
  admin: SupabaseClient<Database>,
  outboxRowId: string,
  claimToken?: string,
): Promise<void> {
  if (eventType === "payment_confirmation") {
    return dispatchPaymentConfirmation(packetId, payload, admin, outboxRowId);
  }

  if (
    eventType.startsWith("packet_service_window_reminder_") ||
    eventType === "packet_archived_90_day"
  ) {
    return dispatchCommercialLifecycleNotification(
      eventType,
      packetId,
      payload,
      admin,
      outboxRowId,
    );
  }

  // CPE event types — route to operation-specific handlers
  if (eventType === "cpe_prepare") {
    const { handleCpePrepare } = await import("@/lib/services/cpe");
    return handleCpePrepare(admin, payload, outboxRowId, claimToken ?? outboxRowId);
  }

  if (eventType === "cpe_submit") {
    const { handleCpeSubmit } = await import("@/lib/services/cpe");
    return handleCpeSubmit(admin, payload, outboxRowId, claimToken ?? outboxRowId);
  }

  if (eventType === "cpe_status_check") {
    const { handleCpeStatusCheck } = await import("@/lib/services/cpe");
    return handleCpeStatusCheck(admin, payload, outboxRowId, claimToken ?? outboxRowId);
  }

  if (eventType === "cpe_pdf") {
    const { handleCpePdf } = await import("@/lib/services/cpe");
    return handleCpePdf(admin, payload, outboxRowId, claimToken ?? outboxRowId);
  }

  if (eventType === "comprobante_available") {
    return dispatchComprobanteAvailable(payload, admin, outboxRowId);
  }

  if (
    eventType.startsWith("packet_needs_correction_") ||
    eventType.startsWith("packet_rejected_")
  ) {
    return dispatchNotaryDecisionNotification(
      eventType,
      packetId,
      payload,
      admin,
      outboxRowId,
    );
  }

  if (!eventType.startsWith("packet_certified_")) {
    throw new Error(`Unsupported notification outbox event: ${eventType}`);
  }

  const { data: packet } = await admin
    .from("lease_packets")
    .select("packet_code, property_address")
    .eq("id", packetId)
    .single();

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const role = payload.role as string;
  let email: string | null = null;
  let name: string | null = null;

  if (role === "realtor") {
    const userId = payload.user_id as string;
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();
    email = profile?.email ?? null;
    name = profile?.full_name ?? null;
  } else {
    const signerId = payload.signer_id as string;
    const { data: signer } = await admin
      .from("packet_signers")
      .select("signer_email, signer_full_name")
      .eq("id", signerId)
      .single();
    email = signer?.signer_email ?? null;
    name = signer?.signer_full_name ?? null;
  }

  if (!email) {
    throw new Error(`No email found for ${role} notification`);
  }

  const { notifyPacketCertifiedRecipient } = await import(
    "@/lib/services/notifications"
  );

  await notifyPacketCertifiedRecipient({
    email,
    name: name ?? "",
    role: role as "realtor" | "landlord" | "renter",
    packetCode: packet.packet_code ?? "",
    packetId,
    propertyAddress: packet.property_address ?? "",
    idempotencyKey: outboxRowId,
  });
}

async function dispatchCommercialLifecycleNotification(
  eventType: string,
  packetId: string,
  payload: Record<string, unknown>,
  admin: SupabaseClient<Database>,
  outboxRowId: string,
): Promise<void> {
  const realtorId = String(payload.user_id ?? "");
  if (!realtorId) throw new Error("Missing realtor user_id in lifecycle payload");

  const [{ data: packet }, { data: realtor }] = await Promise.all([
    admin
      .from("lease_packets")
      .select("packet_code, property_address")
      .eq("id", packetId)
      .single(),
    admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", realtorId)
      .single(),
  ]);
  if (!packet) throw new Error(`Packet not found: ${packetId}`);
  if (!realtor?.email) throw new Error(`No email found for realtor ${realtorId}`);

  const { notifyPacketServiceWindow } = await import("@/lib/services/notifications");
  const dayNumber = Number(payload.day_number ?? 90);
  const endsAt = payload.service_window_ends_at
    ? new Date(String(payload.service_window_ends_at)).toLocaleDateString("es-PE")
    : undefined;

  await notifyPacketServiceWindow({
    email: realtor.email,
    recipientName: realtor.full_name ?? "",
    packetCode: packet.packet_code ?? "",
    packetId,
    propertyAddress: packet.property_address ?? "",
    daysRemaining: Math.max(90 - dayNumber, 0),
    endsAt,
    archived: eventType === "packet_archived_90_day",
    idempotencyKey: outboxRowId,
  });
}

async function dispatchNotaryDecisionNotification(
  eventType: string,
  packetId: string,
  payload: Record<string, unknown>,
  admin: SupabaseClient<Database>,
  outboxRowId: string,
): Promise<void> {
  const { data: packet } = await admin
    .from("lease_packets")
    .select("packet_code, property_address, created_by")
    .eq("id", packetId)
    .single();
  if (!packet) throw new Error(`Packet not found: ${packetId}`);

  const { data: realtor } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", packet.created_by)
    .single();

  const role = payload.role as "realtor" | "landlord" | "renter";
  let recipientEmail = realtor?.email ?? null;
  let recipientName = realtor?.full_name ?? "";

  if (role !== "realtor") {
    const signerId = payload.signer_id as string;
    const { data: signer } = await admin
      .from("packet_signers")
      .select("signer_email, signer_full_name")
      .eq("id", signerId)
      .eq("packet_id", packetId)
      .single();
    recipientEmail = signer?.signer_email ?? null;
    recipientName = signer?.signer_full_name ?? "";
  }

  if (!recipientEmail) {
    throw new Error(`No email found for ${role} decision notification`);
  }

  const reason = String(payload.reason ?? "");
  const common = {
    recipientEmail,
    recipientName,
    recipientRole: role,
    realtorName: realtor?.full_name ?? "",
    packetCode: packet.packet_code ?? "",
    propertyAddress: packet.property_address ?? "",
    reason,
    idempotencyKey: outboxRowId,
  };

  if (eventType.startsWith("packet_needs_correction_")) {
    const { notifyPacketNeedsCorrectionRecipient } = await import(
      "@/lib/services/notifications"
    );
    await notifyPacketNeedsCorrectionRecipient({
      ...common,
      packetId,
    });
    return;
  }

  const { notifyPacketRejectedRecipient } = await import(
    "@/lib/services/notifications"
  );
  await notifyPacketRejectedRecipient(common);
}

export async function getOutboxStats(
  admin: SupabaseClient<Database>,
): Promise<{ pending: number; failed: number; sent: number }> {
  const [
    { count: pending },
    { count: failedCount },
    { count: sentCount },
  ] = await Promise.all([
    admin
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
  ]);

  return {
    pending: pending ?? 0,
    failed: failedCount ?? 0,
    sent: sentCount ?? 0,
  };
}

async function dispatchComprobanteAvailable(
  payload: Record<string, unknown>,
  admin: SupabaseClient<Database>,
  outboxRowId: string,
): Promise<void> {
  const invoiceId = payload.invoice_id as string;
  const tipoDoc = payload.tipo_doc as string;
  const serie = payload.serie as string;
  const correlativo = payload.correlativo as string;
  const realtorId = payload.realtor_id as string;
  const packetId = payload.packet_id as string;

  if (!invoiceId || !realtorId) {
    throw new Error("Missing invoice_id or realtor_id in comprobante_available payload");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", realtorId)
    .single();

  if (!profile?.email) {
    throw new Error(`No email found for realtor ${realtorId}`);
  }

  const { data: packet } = await admin
    .from("lease_packets")
    .select("packet_code, property_address")
    .eq("id", packetId)
    .single();

  const documentNumber = `${serie}-${correlativo}`;

  const { notifyComprobanteAvailable } = await import(
    "@/lib/services/notifications"
  );

  // Let errors propagate — outbox will retry
  await notifyComprobanteAvailable({
    realtorEmail: profile.email,
    realtorName: profile.full_name ?? "",
    tipoDoc,
    documentNumber,
    packetCode: packet?.packet_code ?? "",
    packetId,
    propertyAddress: packet?.property_address ?? "",
    idempotencyKey: outboxRowId,
  });
}

async function dispatchPaymentConfirmation(
  packetId: string,
  payload: Record<string, unknown>,
  admin: SupabaseClient<Database>,
  outboxRowId: string,
): Promise<void> {
  void outboxRowId;
  const paymentId = payload.payment_id as string;
  const realtorId = payload.user_id as string;
  const amountCentimos = payload.amount_centimos as number;
  const providerPaymentId = payload.provider_payment_id as string;

  if (!paymentId || !realtorId) {
    throw new Error("Missing payment_id or user_id in payment_confirmation payload");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", realtorId)
    .single();

  if (!profile?.email) {
    throw new Error(`No email found for realtor ${realtorId}`);
  }

  const { sendPaymentConfirmation } = await import(
    "@/lib/services/payment-confirmation-delivery"
  );

  await sendPaymentConfirmation(
    admin,
    paymentId,
    packetId,
    amountCentimos,
    profile.email,
    providerPaymentId,
  );

  const { data: check } = await admin
    .from("payments")
    .select("payment_confirmation_sent_at")
    .eq("id", paymentId)
    .single();

  if (!check?.payment_confirmation_sent_at) {
    throw new Error("Payment confirmation email was not marked as sent after delivery attempt");
  }
}
