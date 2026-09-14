import "server-only";

import React from "react";
import crypto from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertifiedDocumentPdf } from "./certified-document-template";
import { computeSha256 } from "@/lib/utils/document-hash";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CertifiedDocumentData } from "./types";

export async function generateAndStoreCertifiedDocument(
  packetId: string,
  certificationData: CertifiedDocumentData,
  notaryId: string,
): Promise<{ storagePath: string; fileHash: string; documentId: string }> {
  const element = React.createElement(CertifiedDocumentPdf, {
    data: certificationData,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(element as any);

  const buffer = Buffer.from(pdfBuffer);
  const fileHash = computeSha256(buffer);

  const documentId = crypto.randomUUID();
  const storagePath = `packets/${packetId}/certified_leases/${documentId}.pdf`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      `Error al subir documento certificado: ${uploadError.message}`,
    );
  }

  try {
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "replace_packet_document",
      {
        p_packet_id: packetId,
        p_document_type: "certified_lease",
        p_storage_path: storagePath,
        p_file_hash: fileHash,
        p_uploaded_by: notaryId,
        p_document_id: documentId,
      },
    );

    if (rpcError) {
      throw new Error(
        `Error al registrar documento certificado: ${rpcError.message}`,
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
