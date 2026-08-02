import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import {
  verifyFirmEasyWebhookSignature,
  FIRMEASY_SIGNATURE_HEADER,
  getFirmEasyClient,
} from "@/lib/services/firmeasy";
import type { FirmEasyWebhookPayload } from "@/lib/services/firmeasy/types";
import {
  insertWebhookLog,
  findWebhookLogByHash,
  claimWebhookForRetry,
  markWebhookProcessed,
  markWebhookFailed,
} from "@/lib/services/firmeasy/db-helpers";
import { assembleSignedDocument } from "@/lib/services/document-assembly-service";
import {
  notifySignerCompletion,
  notifyAllSignersComplete,
  notifySignerRejectedFirmEasy,
} from "@/lib/services/notifications";

function throwOnError<T>(result: { data: T; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new Error(`[${context}] ${result.error.message}`);
  }
  return result.data;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // 1. Verify HMAC signature
  const signatureHeader = request.headers.get(FIRMEASY_SIGNATURE_HEADER) ?? "";
  const secret = serverEnv.FIRMEASY_WEBHOOK_SECRET ?? "";

  if (!secret) {
    // In production mode, webhook secret is mandatory (enforced by validateFirmEasyConfig).
    // In non-production without secret, reject requests unless explicitly in development.
    if (process.env.NODE_ENV !== "development") {
      console.error("[FirmEasy Webhook] FIRMEASY_WEBHOOK_SECRET not configured in non-development environment");
      return NextResponse.json(
        { error: "Webhook verification not configured" },
        { status: 500 },
      );
    }
  } else if (!verifyFirmEasyWebhookSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 },
    );
  }

  // 2. Parse payload
  let payload: FirmEasyWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Compute payload hash for idempotency
  const payloadHash = crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");

  const admin = createAdminClient();
  let logId: string | undefined;

  try {
    // 4. Attempt idempotent insert
    const inserted = await insertWebhookLog(admin, {
      event_type: payload.event,
      document_token: payload.document_token ?? null,
      signer_token: payload.signer_token ?? null,
      payload_hash: payloadHash,
      raw_payload: payload as unknown as Record<string, unknown>,
      processing_state: "processing",
    });

    logId = inserted?.id;

    if (!inserted) {
      // Conflict — check existing row state
      const existing = await findWebhookLogByHash(admin, payloadHash);

      if (!existing) {
        return NextResponse.json({ status: "ok" });
      }

      if (existing.processing_state === "processed") {
        return NextResponse.json({ status: "already_processed" });
      }

      // For rows still "processing": check processing_started_at to determine staleness.
      // If no processing_started_at, fall back to created_at.
      if (existing.processing_state === "processing") {
        const startedAt = new Date(existing.processing_started_at ?? existing.created_at).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (startedAt > fiveMinutesAgo) {
          return NextResponse.json({ status: "in_flight" });
        }
      }

      // Stale or failed — attempt atomic claim via RPC.
      // The RPC re-checks staleness in its WHERE clause, so even if two concurrent
      // requests pass the above check, only one will win the UPDATE.
      const claimed = await claimWebhookForRetry(admin, existing.id);
      if (!claimed) {
        return NextResponse.json({ status: "ok" });
      }
      logId = existing.id;
    }

    // 5. Route by event type
    switch (payload.event) {
      case "document_signed":
        await handleDocumentSigned(payload, admin);
        break;
      case "signer_rejected":
        await handleSignerRejected(payload, admin);
        break;
      default:
        console.warn(`[FirmEasy Webhook] Unknown event: ${payload.event}`);
    }

    // Mark as processed
    if (logId) {
      await markWebhookProcessed(admin, logId);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[FirmEasy Webhook] Processing error:", errorMessage);

    if (logId) {
      await markWebhookFailed(admin, logId, errorMessage);
    }

    // Return 500 so FirmEasy retries the webhook delivery.
    // The idempotency layer (payload_hash check) ensures safe reprocessing.
    return NextResponse.json(
      { status: "error", message: "Processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok" });
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function handleDocumentSigned(
  payload: FirmEasyWebhookPayload,
  admin: ReturnType<typeof createAdminClient>,
) {
  const documentToken = payload.document_token;
  if (!documentToken) {
    throw new Error("document_signed event missing document_token");
  }

  // Find the packet by FirmEasy document token
  const { data: packets } = await admin
    .from("lease_packets")
    .select("id, status, packet_code, property_address, created_by")
    .eq("firmeasy_document_token" as never, documentToken as never);

  const packet = (packets as unknown as Array<{
    id: string;
    status: string;
    packet_code: string | null;
    property_address: string | null;
    created_by: string;
  }>)?.[0];

  if (!packet) {
    throw new Error(`No packet found for FirmEasy document token: ${documentToken}`);
  }

  // Idempotency: skip if already processed
  if (packet.status === "all_signed" || packet.status === "pending_notary") {
    return;
  }

  // Fetch full document from FirmEasy
  const client = getFirmEasyClient();
  if (!client) {
    throw new Error("FirmEasy client not configured for webhook processing");
  }

  const doc = await client.getDocument(documentToken, ["signers", "tracking"]);

  // Download signed PDF
  if (!doc.signed_file) {
    throw new Error(`No signed_file URL for document ${documentToken}`);
  }
  const signedPdfBuffer = await client.getSignedPdf(doc.signed_file);

  // Store signed PDF
  await assembleSignedDocument(packet.id, signedPdfBuffer, null, {
    system_source: "firmeasy_webhook",
    firmeasy_document_token: doc.token,
  });

  // Process each signer
  const { data: packetSigners } = await admin
    .from("packet_signers")
    .select("id, signer_full_name, signer_email, role_in_lease, status")
    .eq("packet_id", packet.id);

  const signerRows = packetSigners as unknown as Array<{
    id: string;
    signer_full_name: string;
    signer_email: string;
    role_in_lease: string;
    status: string;
  }> ?? [];

  const signedPdfHash = crypto
    .createHash("sha256")
    .update(signedPdfBuffer)
    .digest("hex");

  for (const feSigner of doc.signers) {
    const localSigner = signerRows.find((s) => s.id === feSigner.external_id);
    if (!localSigner) continue;

    // Find tracking data for this signer
    const signerTracking = doc.tracking?.find(
      (t) => t.signer_token === feSigner.token,
    );

    // Upsert signature_records — unique on (packet_signer_id, provider_document_token)
    throwOnError(
      await admin.from("signature_records").upsert({
        packet_signer_id: localSigner.id,
        provider_name: "firmeasy",
        provider_document_token: doc.token,
        provider_signer_token: feSigner.token,
        provider_signed_at: feSigner.signed_at ?? new Date().toISOString(),
        certificate_subject: signerTracking?.certificate_subject ?? null,
        certificate_issuer: signerTracking?.certificate_issuer ?? null,
        certificate_serial: signerTracking?.certificate_serial ?? null,
        certificate_valid_from: signerTracking?.certificate_valid_from ?? null,
        certificate_valid_to: signerTracking?.certificate_valid_to ?? null,
        chain_validation_result: signerTracking?.chain_validation ?? null,
        revocation_result: signerTracking?.revocation_status ?? null,
        timestamp_result: signerTracking?.timestamp_authority ?? null,
        signature_valid: true,
        pdf_integrity_valid: true,
        verification_url: signerTracking?.verification_url ?? null,
        signed_document_hash: signedPdfHash,
        raw_validation_data: {
          provider: "firmeasy",
          signer_status: feSigner.status,
          tracking: signerTracking ?? null,
        },
      } as never, {
        onConflict: "packet_signer_id,provider_document_token",
        ignoreDuplicates: false,
      }),
      `signature_records upsert for signer ${localSigner.id}`,
    );

    // Insert signer evidence if not already present (partial unique index
    // prevents PostgREST onConflict; use select-then-insert for idempotency)
    const { data: existingEvidence } = await admin
      .from("signer_evidence")
      .select("id")
      .eq("packet_signer_id", localSigner.id)
      .eq("evidence_type", "firmeasy_signature")
      .maybeSingle();

    if (!existingEvidence) {
      throwOnError(
        await admin.from("signer_evidence").insert({
          packet_signer_id: localSigner.id,
          evidence_type: "firmeasy_signature",
          metadata: {
            provider: "firmeasy",
            document_token: doc.token,
            signer_token: feSigner.token,
            signed_at: feSigner.signed_at ?? new Date().toISOString(),
            verification_url: signerTracking?.verification_url ?? null,
          },
        }),
        `signer_evidence insert for signer ${localSigner.id}`,
      );
    }

    // Advance signer status idempotently.
    // Re-read current status to handle retries where a previous attempt
    // may have partially advanced the state before failing.
    const freshSigner = throwOnError(
      await admin
        .from("packet_signers")
        .select("status")
        .eq("id", localSigner.id)
        .single(),
      `read signer status for ${localSigner.id}`,
    );
    const currentStatus = (freshSigner as { status: string } | null)?.status ?? localSigner.status;

    // State machine: consent_given → identity_verified → signed → complete
    // The webhook fires after FirmEasy signing, so the signer should be at
    // identity_verified (normal) or signed (partial retry). If still at
    // consent_given or earlier, something is wrong — log and skip status advance
    // to avoid a permanent 500 retry loop.
    if (currentStatus === "identity_verified") {
      throwOnError(
        await admin.rpc("advance_signer_status", {
          p_signer_id: localSigner.id,
          p_new_status: "signed",
        }),
        `advance_signer_status to signed for ${localSigner.id}`,
      );
      throwOnError(
        await admin.rpc("advance_signer_status", {
          p_signer_id: localSigner.id,
          p_new_status: "complete",
        }),
        `advance_signer_status to complete for ${localSigner.id}`,
      );
    } else if (currentStatus === "signed") {
      throwOnError(
        await admin.rpc("advance_signer_status", {
          p_signer_id: localSigner.id,
          p_new_status: "complete",
        }),
        `advance_signer_status to complete for ${localSigner.id}`,
      );
    } else if (currentStatus !== "complete") {
      console.error(
        `[FirmEasy Webhook] Signer ${localSigner.id} at unexpected status "${currentStatus}" ` +
        `when document_signed received. Skipping status advance.`,
      );
    }

    // Update FirmEasy-specific status on packet_signers
    throwOnError(
      await admin
        .from("packet_signers")
        .update({ firmeasy_signer_status: feSigner.status } as never)
        .eq("id", localSigner.id),
      `update firmeasy_signer_status for ${localSigner.id}`,
    );

    // Notify signer
    if (localSigner.signer_email) {
      void notifySignerCompletion({
        email: localSigner.signer_email,
        signerName: localSigner.signer_full_name ?? "",
        propertyAddress: packet.property_address ?? "",
        roleInLease: (localSigner.role_in_lease as "landlord" | "renter") ?? "renter",
      });
    }
  }

  // Update packet-level FirmEasy status
  throwOnError(
    await admin
      .from("lease_packets")
      .update({ firmeasy_document_status: "signed" } as never)
      .eq("id", packet.id),
    "update firmeasy_document_status on lease_packets",
  );

  // Advance packet to all_signed
  throwOnError(
    await admin.rpc("transition_packet_status", {
      p_packet_id: packet.id,
      p_new_status: "all_signed",
      p_actor_id: packet.created_by,
      p_action: "firmeasy_document_signed",
      p_metadata: {
        system_source: "firmeasy_webhook",
        firmeasy_document_token: doc.token,
        signer_count: doc.signers.length,
      },
    }),
    "transition_packet_status to all_signed",
  );

  // Auto-generate evidence report so the realtor can immediately submit to notary
  try {
    const { collectEvidenceData } = await import(
      "@/lib/services/evidence-data-collector"
    );
    const { generateAndStoreEvidenceReport } = await import(
      "@/lib/pdf/generate-evidence-report"
    );

    const reportData = await collectEvidenceData(packet.id);
    const { storagePath, fileHash } = await generateAndStoreEvidenceReport(
      packet.id,
      reportData,
      packet.created_by,
    );

    await admin.from("packet_audit_log").insert({
      packet_id: packet.id,
      actor_id: null,
      action: "evidence_report_generated",
      metadata: {
        storage_path: storagePath,
        file_hash: fileHash,
        system_source: "firmeasy_webhook_auto",
      },
    });
  } catch (evidenceErr) {
    console.error(
      "[FirmEasy Webhook] Auto evidence report generation failed (non-fatal):",
      evidenceErr instanceof Error ? evidenceErr.message : evidenceErr,
    );
  }

  // Notify realtor
  if (packet.created_by) {
    const { data: realtorProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", packet.created_by)
      .single();

    if (realtorProfile?.email) {
      void notifyAllSignersComplete({
        realtorEmail: realtorProfile.email,
        realtorName: realtorProfile.full_name ?? "",
        packetCode: packet.packet_code ?? "",
        packetId: packet.id,
        propertyAddress: packet.property_address ?? "",
      });
    }
  }
}

async function handleSignerRejected(
  payload: FirmEasyWebhookPayload,
  admin: ReturnType<typeof createAdminClient>,
) {
  const signerExternalId = payload.signer_external_id;
  const documentToken = payload.document_token;

  if (!documentToken) {
    throw new Error("signer_rejected event missing document_token");
  }

  // Find the packet
  const { data: packets } = await admin
    .from("lease_packets")
    .select("id, created_by, packet_code, property_address")
    .eq("firmeasy_document_token" as never, documentToken as never);

  const packet = (packets as unknown as Array<{
    id: string;
    created_by: string;
    packet_code: string | null;
    property_address: string | null;
  }>)?.[0];

  if (!packet) {
    throw new Error(`No packet found for FirmEasy document token: ${documentToken}`);
  }

  // Find the signer
  let signerName = "Firmante desconocido";
  if (signerExternalId) {
    const { data: signer } = await admin
      .from("packet_signers")
      .select("signer_full_name")
      .eq("id", signerExternalId)
      .single();
    if (signer) {
      signerName = signer.signer_full_name;
    }

    // Update FirmEasy signer status
    throwOnError(
      await admin
        .from("packet_signers")
        .update({ firmeasy_signer_status: "rejected" } as never)
        .eq("id", signerExternalId),
      `update firmeasy_signer_status to rejected for ${signerExternalId}`,
    );
  }

  // Insert audit event
  throwOnError(
    await admin.from("packet_audit_log").insert({
      packet_id: packet.id,
      actor_id: null,
      action: "signer_rejected_firmeasy",
      metadata: {
        system_source: "firmeasy_webhook",
        signer_external_id: signerExternalId ?? "unknown",
        signer_name: signerName,
        document_token: documentToken,
        rejection_data: JSON.stringify(payload.data ?? {}),
      },
    }),
    "insert signer_rejected audit log",
  );

  // Notify realtor via templated email
  if (packet.created_by) {
    const { data: realtorProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", packet.created_by)
      .single();

    if (realtorProfile?.email) {
      void notifySignerRejectedFirmEasy({
        realtorEmail: realtorProfile.email,
        realtorName: realtorProfile.full_name ?? "",
        signerName,
        packetCode: packet.packet_code ?? "",
        packetId: packet.id,
        propertyAddress: packet.property_address ?? "",
      });
    }
  }
}
