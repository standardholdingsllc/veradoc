import "server-only";

import React from "react";
import crypto from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { EvidenceReportDocument } from "./evidence-report-template";
import { computeSha256 } from "@/lib/utils/document-hash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceReportData } from "./types";

interface ReplaceDocumentResult {
  old_document_id: string | null;
  new_document_id: string;
  idempotent: boolean;
  storage_path_to_delete?: string;
  accepted_storage_path?: string;
}

export async function generateAndStoreEvidenceReport(
  packetId: string,
  reportData: EvidenceReportData,
  actorId: string,
): Promise<{ storagePath: string; fileHash: string; documentId: string }> {
  const element = React.createElement(EvidenceReportDocument, {
    data: reportData,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);

  const buffer = Buffer.from(pdfBuffer);
  const fileHash = computeSha256(buffer);

  const documentId = crypto.randomUUID();
  const storagePath = `packets/${packetId}/evidence_reports/${documentId}.pdf`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir informe de evidencia: ${uploadError.message}`,
    );
  }

  try {
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "replace_packet_document",
      {
        p_packet_id: packetId,
        p_document_type: "evidence_report",
        p_storage_path: storagePath,
        p_file_hash: fileHash,
        p_uploaded_by: actorId,
        p_document_id: documentId,
      },
    );

    if (rpcError) {
      throw new Error(
        `Error al registrar informe de evidencia: ${rpcError.message}`,
      );
    }

    const result = rpcResult as unknown as ReplaceDocumentResult;

    if (result.idempotent && result.storage_path_to_delete) {
      await admin.storage.from("documents").remove([result.storage_path_to_delete]);
    }

    return {
      storagePath: result.idempotent && result.accepted_storage_path
        ? result.accepted_storage_path
        : storagePath,
      fileHash,
      documentId: result.new_document_id,
    };
  } catch (err) {
    await admin.storage.from("documents").remove([storagePath]);
    throw err;
  }
}
