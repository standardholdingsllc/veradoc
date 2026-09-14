import "server-only";

import { PDFDocument } from "pdf-lib";
import { computeSha256 } from "@/lib/utils/document-hash";
import type { NotarialScanValidationResult } from "@/lib/domain/notary-seal-types";

const VALIDATOR_VERSION = "veradoc-scan-validator-v1";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function validateNotarialScan(
  buffer: Buffer,
  sourceDocumentId: string,
  sourceDocumentHash: string,
  sourcePageCount: number | null,
  declaredAddedPages: number,
): Promise<NotarialScanValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let pdfHeaderOk = false;
  let pdfStructureOk = false;
  let notEncrypted = false;
  let pageCount: number | null = null;

  const fileSizeBytes = buffer.length;
  const fileHash = computeSha256(buffer);

  if (fileSizeBytes > MAX_FILE_SIZE) {
    errors.push(`El archivo excede el límite de ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
  }

  const header = buffer.subarray(0, 5).toString("ascii");
  if (header === "%PDF-") {
    pdfHeaderOk = true;
  } else {
    errors.push("El archivo no tiene un encabezado PDF válido.");
  }

  const trailer = buffer.subarray(-1024).toString("ascii");
  if (!trailer.includes("%%EOF")) {
    errors.push("El archivo PDF parece estar corrupto o truncado (sin %%EOF).");
  }

  if (pdfHeaderOk) {
    try {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      if (doc.isEncrypted) {
        notEncrypted = false;
        errors.push("El archivo PDF está protegido con contraseña.");
      } else {
        notEncrypted = true;
      }

      pageCount = doc.getPageCount();
      pdfStructureOk = true;

      if (pageCount === 0) {
        errors.push("El archivo PDF no contiene páginas.");
      }
    } catch {
      errors.push("El archivo PDF está dañado y no se puede procesar.");
    }
  }

  if (pageCount !== null && sourcePageCount !== null) {
    const expectedPages = sourcePageCount + declaredAddedPages;
    if (pageCount !== expectedPages) {
      warnings.push(
        `El escaneo tiene ${pageCount} páginas. ` +
        `Se esperaban ${expectedPages} (${sourcePageCount} originales + ${declaredAddedPages} de certificación).`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    pdf_header_ok: pdfHeaderOk,
    pdf_structure_ok: pdfStructureOk,
    not_encrypted: notEncrypted,
    page_count: pageCount,
    file_size_bytes: fileSizeBytes,
    file_hash: fileHash,
    source_document_id: sourceDocumentId,
    source_document_hash: sourceDocumentHash,
    declared_added_pages: declaredAddedPages,
    validator_version: VALIDATOR_VERSION,
    validated_at: new Date().toISOString(),
    errors,
    warnings,
  };
}
