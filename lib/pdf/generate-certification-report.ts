import "server-only";

import React from "react";
import crypto from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertifiedDocumentPdf } from "./certified-document-template";
import { computeSha256 } from "@/lib/utils/document-hash";
import { getDocumentHashTimeline } from "@/lib/utils/document-hash";
import type { CertifiedDocumentData } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function generateAndStoreCertificationReport(
  packetId: string,
  certificationId: string,
  notaryId: string,
  admin: SupabaseClient<Database>,
): Promise<{ documentId: string; storagePath: string; fileHash: string }> {
  const { data: packetRow } = await admin
    .from("lease_packets")
    .select("*")
    .eq("id", packetId)
    .single();

  const packet = packetRow as {
    packet_code: string | null;
    property_address: string | null;
    property_unit: string | null;
    district: string | null;
    province: string | null;
    lease_start_date: string | null;
    lease_end_date: string | null;
  } | null;

  const { data: notaryProfile } = await admin
    .from("profiles")
    .select("full_name, accreditation_number")
    .eq("id", notaryId)
    .single();

  const { data: cert } = await admin
    .from("notary_certifications")
    .select("certification_type, observations, checklist_data, prepared_at, notarial_scan_document_id")
    .eq("id", certificationId)
    .single();

  const { data: signers } = await admin
    .from("packet_signers")
    .select("signer_full_name, signer_dni, role_in_lease")
    .eq("packet_id", packetId);

  const landlordNames = (signers ?? [])
    .filter((s) => s.role_in_lease === "landlord")
    .map((s) => s.signer_full_name ?? "");
  const renterNames = (signers ?? [])
    .filter((s) => s.role_in_lease === "renter")
    .map((s) => s.signer_full_name ?? "");

  const documentHashes = await getDocumentHashTimeline(packetId, admin);

  const boolChecklist: Record<string, boolean> = {};
  if (cert?.checklist_data) {
    const raw = cert.checklist_data as Record<string, unknown>;
    for (const [key, val] of Object.entries(raw)) {
      const entry = val as { checked?: boolean } | boolean;
      boolChecklist[key] =
        typeof entry === "object" && entry !== null
          ? Boolean(entry.checked)
          : Boolean(entry);
    }
  }

  const now = new Date().toISOString();

  const certData: CertifiedDocumentData = {
    packetCode: packet?.packet_code ?? packetId.slice(0, 12),
    packetId,
    notaryName: notaryProfile?.full_name ?? "Notario",
    accreditationNumber: notaryProfile?.accreditation_number ?? null,
    certifiedAt: cert?.prepared_at ?? now,
    certificationType: (cert?.certification_type ?? "certified") as
      | "certified"
      | "certified_with_observations",
    observations: cert?.observations ?? undefined,
    checklistSummary: boolChecklist,
    documentHashes: documentHashes.map((h) => ({
      stage: h.stage as "initial_upload" | "post_signatures" | "final_certified",
      algorithm: h.algorithm,
      hash: h.hash,
      timestamp: h.timestamp,
      actorId: h.actorId,
    })),
    propertyAddress: packet?.property_address ?? "",
    propertyUnit: packet?.property_unit ?? undefined,
    district: packet?.district ?? undefined,
    province: packet?.province ?? undefined,
    landlordNames,
    renterNames,
    leaseStartDate: packet?.lease_start_date ?? undefined,
    leaseEndDate: packet?.lease_end_date ?? undefined,
  };

  const element = React.createElement(CertifiedDocumentPdf, {
    data: certData,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);
  const buffer = Buffer.from(pdfBuffer);
  const fileHash = computeSha256(buffer);

  const documentId = crypto.randomUUID();
  const storagePath = `packets/${packetId}/certification_reports/${documentId}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir reporte de certificación: ${uploadError.message}`,
    );
  }

  const scanDocumentId = cert?.notarial_scan_document_id ?? null;

  try {
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "replace_packet_document",
      {
        p_packet_id: packetId,
        p_document_type: "certification_report",
        p_storage_path: storagePath,
        p_file_hash: fileHash,
        p_uploaded_by: notaryId,
        p_source_document_id: scanDocumentId ?? undefined,
        p_certification_id: certificationId ?? undefined,
        p_document_id: documentId ?? undefined,
        p_metadata: { certification_id: certificationId },
      },
    );

    if (rpcError) {
      throw new Error(
        `Error al registrar reporte de certificación: ${rpcError.message}`,
      );
    }

    const result = rpcResult as {
      old_document_id: string | null;
      new_document_id: string;
      idempotent: boolean;
      storage_path_to_delete?: string;
      accepted_storage_path?: string;
    };

    if (result.idempotent && result.storage_path_to_delete) {
      await admin.storage.from("documents").remove([result.storage_path_to_delete]);
    }

    return {
      documentId: result.new_document_id,
      storagePath: result.idempotent && result.accepted_storage_path
        ? result.accepted_storage_path
        : storagePath,
      fileHash,
    };
  } catch (err) {
    await admin.storage.from("documents").remove([storagePath]);
    throw err;
  }
}
