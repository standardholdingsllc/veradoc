import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getInvoicePdf,
  getCreditNotePdf,
  ApisPeruError,
} from "@/lib/services/apisperu";
import { buildPdfPayload } from "@/lib/services/apisperu/mapper";
import type {
  ApisPeruInvoiceRequest,
  ApisPeruCreditNoteRequest,
} from "@/lib/services/apisperu/types";
import { LostClaimError } from "./prepare";

/**
 * cpe_pdf handler.
 *
 * - Claims only accepted + pdf.
 * - Uses /invoice/pdf for 01/03 and /note/pdf for 07.
 * - Uploads PDF (and optionally XML/CDR) to private storage.
 * - Finish with fenced complete_cpe_artifacts (marks available + enqueues email).
 * - Never re-sends the CPE.
 */
export async function handleCpePdf(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  outboxRowId: string,
  claimToken: string,
): Promise<void> {
  const invoiceId = payload.invoice_id as string;
  const tipoDoc = payload.tipo_doc as string;
  if (!invoiceId) throw new Error("Missing invoice_id in cpe_pdf payload");

  // Claim the pdf operation
  const { data: claimData, error: claimError } = await admin.rpc(
    "claim_cpe_operation",
    {
      p_invoice_id: invoiceId,
      p_operation: "pdf",
      p_claim_token: claimToken,
    },
  );

  if (claimError) throw new Error(`claim_cpe_operation failed: ${claimError.message}`);

  const claim = claimData as Record<string, unknown>;
  if (!claim) throw new Error("claim_cpe_operation returned null");

  if (claim.owned === false) {
    const currentStatus = claim.current_status as string;
    if (currentStatus === "available") return;
    throw new Error("Another worker owns pdf; retry later");
  }

  const storedPayload = claim.request_payload as Record<string, unknown>;
  if (!storedPayload) throw new Error("No request_payload for PDF generation");

  const realtorId = claim.realtor_id as string;
  const pdfPayload = buildPdfPayload(
    storedPayload as unknown as ApisPeruInvoiceRequest | ApisPeruCreditNoteRequest,
  );

  // Generate PDF
  let pdfBytes: ArrayBuffer;
  try {
    if (tipoDoc === "01" || tipoDoc === "03") {
      const result = await getInvoicePdf(pdfPayload);
      pdfBytes = result.pdf;
    } else if (tipoDoc === "07") {
      const result = await getCreditNotePdf(pdfPayload);
      pdfBytes = result.pdf;
    } else {
      throw new Error(`Unknown tipo_doc for PDF: ${tipoDoc}`);
    }
  } catch (err) {
    await recordOperationError(admin, invoiceId, claimToken, "pdf", err);
    throw err;
  }

  // Upload to private storage
  const basePath = `${realtorId}/${invoiceId}`;
  let pdfStoragePath: string;

  try {
    pdfStoragePath = `${basePath}/document.pdf`;
    const { error: uploadError } = await admin.storage
      .from("tax-documents")
      .upload(pdfStoragePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);
  } catch (err) {
    await recordOperationError(admin, invoiceId, claimToken, "pdf", err);
    throw err;
  }

  // Upload XML and CDR — these are legally required artifacts
  let xmlStoragePath: string | null = null;
  let cdrStoragePath: string | null = null;

  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("signed_xml, cdr_zip_base64, xml_storage_path, cdr_storage_path")
    .eq("id", invoiceId)
    .single();

  if (invoiceRow?.signed_xml && !invoiceRow.xml_storage_path) {
    xmlStoragePath = `${basePath}/document.xml`;
    const xmlBytes = new TextEncoder().encode(invoiceRow.signed_xml);
    const { error: xmlUploadError } = await admin.storage
      .from("tax-documents")
      .upload(xmlStoragePath, xmlBytes, {
        contentType: "application/xml",
        upsert: true,
      });
    if (xmlUploadError) {
      await recordOperationError(admin, invoiceId, claimToken, "pdf", xmlUploadError);
      throw new Error(`XML upload failed: ${xmlUploadError.message}`);
    }
  } else if (invoiceRow?.xml_storage_path) {
    xmlStoragePath = invoiceRow.xml_storage_path;
  }

  if (invoiceRow?.cdr_zip_base64 && !invoiceRow.cdr_storage_path) {
    cdrStoragePath = `${basePath}/cdr.zip`;
    const cdrBytes = Uint8Array.from(atob(invoiceRow.cdr_zip_base64), (c) => c.charCodeAt(0));
    const { error: cdrUploadError } = await admin.storage
      .from("tax-documents")
      .upload(cdrStoragePath, cdrBytes, {
        contentType: "application/zip",
        upsert: true,
      });
    if (cdrUploadError) {
      await recordOperationError(admin, invoiceId, claimToken, "pdf", cdrUploadError);
      throw new Error(`CDR upload failed: ${cdrUploadError.message}`);
    }
  } else if (invoiceRow?.cdr_storage_path) {
    cdrStoragePath = invoiceRow.cdr_storage_path;
  }

  // Guard: ALL legally required artifacts must be present.
  // SUNAT requires the issuer to retain the signed XML (the document itself)
  // and the CDR (proof of acceptance). The PDF is the customer-facing artifact.
  const missingArtifacts: string[] = [];
  if (!xmlStoragePath) missingArtifacts.push("signed XML");
  if (!cdrStoragePath) missingArtifacts.push("CDR");
  if (!pdfStoragePath) missingArtifacts.push("PDF");

  if (missingArtifacts.length > 0) {
    const detail = `Missing legal artifacts: ${missingArtifacts.join(", ")}`;
    await recordOperationError(admin, invoiceId, claimToken, "pdf", new Error(detail));
    throw new Error(detail);
  }

  // Complete artifacts
  const { error: completeError } = await admin.rpc("complete_cpe_artifacts", {
    p_invoice_id: invoiceId,
    p_claim_token: claimToken,
    p_xml_storage_path: xmlStoragePath ?? undefined,
    p_cdr_storage_path: cdrStoragePath ?? undefined,
    p_pdf_storage_path: pdfStoragePath,
  });

  if (completeError) {
    if (completeError.message.includes("lost_claim")) {
      throw new LostClaimError(completeError.message);
    }
    throw new Error(`complete_cpe_artifacts failed: ${completeError.message}`);
  }
}

async function recordOperationError(
  admin: SupabaseClient<Database>,
  invoiceId: string,
  claimToken: string,
  operation: string,
  err: unknown,
): Promise<void> {
  const errorDetail = err instanceof ApisPeruError
    ? err.message
    : err instanceof Error ? err.message : String(err);

  const { error } = await admin.rpc("record_cpe_operation_error", {
    p_invoice_id: invoiceId,
    p_claim_token: claimToken,
    p_operation: operation,
    p_error_detail: errorDetail.slice(0, 1000),
  });

  if (error) {
    if (error.message.includes("lost_claim")) {
      throw new LostClaimError(error.message);
    }
  }
}
