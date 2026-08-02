import "server-only";

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { EvidenceReportDocument } from "./evidence-report-template";
import { computeSha256 } from "@/lib/utils/document-hash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceReportData } from "./types";

export async function generateAndStoreEvidenceReport(
  packetId: string,
  reportData: EvidenceReportData,
  actorId: string,
): Promise<{ storagePath: string; fileHash: string }> {
  const element = React.createElement(EvidenceReportDocument, {
    data: reportData,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);

  const buffer = Buffer.from(pdfBuffer);
  const fileHash = computeSha256(buffer);
  const storagePath = `packets/${packetId}/evidence_report.pdf`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir informe de evidencia: ${uploadError.message}`,
    );
  }

  const { error: docError } = await admin.from("packet_documents").upsert({
    packet_id: packetId,
    document_type: "evidence_report",
    storage_path: storagePath,
    file_hash: fileHash,
    uploaded_by: actorId,
  }, {
    onConflict: "packet_id,document_type",
    ignoreDuplicates: false,
  });

  if (docError) {
    throw new Error(
      `Error al registrar informe de evidencia: ${docError.message}`,
    );
  }

  return { storagePath, fileHash };
}
