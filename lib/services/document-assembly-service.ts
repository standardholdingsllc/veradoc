import "server-only";

import { PDFDocument } from "pdf-lib";
import { computeSha256 } from "@/lib/utils/document-hash";
import { createAdminClient } from "@/lib/supabase/admin";

export async function assembleSignedDocument(
  packetId: string,
  signedPdfBuffer: Buffer,
  actorId: string | null,
  extraMetadata?: Record<string, string>,
): Promise<{ storagePath: string; fileHash: string }> {
  const admin = createAdminClient();
  const fileHash = computeSha256(signedPdfBuffer);
  const storagePath = `packets/${packetId}/signed_lease.pdf`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, signedPdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Error al subir documento firmado: ${uploadError.message}`);
  }

  const { error: docError } = await admin.from("packet_documents").upsert({
    packet_id: packetId,
    document_type: "signed_pdf",
    storage_path: storagePath,
    file_hash: fileHash,
    uploaded_by: actorId as string,
  }, {
    onConflict: "packet_id,document_type",
    ignoreDuplicates: false,
  });

  if (docError) {
    throw new Error(`Error al registrar documento firmado: ${docError.message}`);
  }

  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: actorId,
    action: "document_hash_recorded",
    metadata: {
      stage: "post_signatures",
      algorithm: "SHA-256",
      hash: fileHash,
      storage_path: storagePath,
      document_type: "signed_pdf",
      ...extraMetadata,
    },
  });

  return { storagePath, fileHash };
}

export async function mergeSignedPdfs(
  buffers: Buffer[],
): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  return Buffer.from(await merged.save());
}
