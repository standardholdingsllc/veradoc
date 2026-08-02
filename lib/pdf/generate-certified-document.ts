import "server-only";

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertifiedDocumentPdf } from "./certified-document-template";
import { computeSha256 } from "@/lib/utils/document-hash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CertifiedDocumentData } from "./types";

export async function generateAndStoreCertifiedDocument(
  packetId: string,
  certificationData: CertifiedDocumentData,
  notaryId: string,
): Promise<{ storagePath: string; fileHash: string }> {
  const element = React.createElement(CertifiedDocumentPdf, {
    data: certificationData,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);

  const buffer = Buffer.from(pdfBuffer);
  const fileHash = computeSha256(buffer);
  const storagePath = `packets/${packetId}/certified_lease.pdf`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir documento certificado: ${uploadError.message}`,
    );
  }

  const { error: docError } = await admin.from("packet_documents").upsert({
    packet_id: packetId,
    document_type: "certified_lease",
    storage_path: storagePath,
    file_hash: fileHash,
    uploaded_by: notaryId,
  }, {
    onConflict: "packet_id,document_type",
    ignoreDuplicates: false,
  });

  if (docError) {
    throw new Error(
      `Error al registrar documento certificado: ${docError.message}`,
    );
  }

  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: notaryId,
    action: "document_hash_recorded",
    metadata: {
      stage: "final_certified",
      algorithm: "SHA-256",
      hash: fileHash,
      storage_path: storagePath,
      document_type: "certified_lease",
    },
  });

  return { storagePath, fileHash };
}
