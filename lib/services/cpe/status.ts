import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getInvoiceStatus, ApisPeruError } from "@/lib/services/apisperu";
import { LostClaimError } from "./prepare";

/**
 * cpe_status_check handler (01/03 only).
 *
 * - If the document is already accepted/available/rejected/manual_review, returns.
 * - Claims only submitted + status_check.
 * - Calls getInvoiceStatus with the stored type/series/correlativo.
 * - Routes the result through fenced RPCs.
 * - Never enqueues or calls cpe_submit.
 */
export async function handleCpeStatusCheck(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  outboxRowId: string,
  claimToken: string,
): Promise<void> {
  const invoiceId = payload.invoice_id as string;
  if (!invoiceId) throw new Error("Missing invoice_id in cpe_status_check payload");

  // Claim the status_check operation
  const { data: claimData, error: claimError } = await admin.rpc(
    "claim_cpe_operation",
    {
      p_invoice_id: invoiceId,
      p_operation: "status_check",
      p_claim_token: claimToken,
    },
  );

  if (claimError) throw new Error(`claim_cpe_operation failed: ${claimError.message}`);

  const claim = claimData as Record<string, unknown>;
  if (!claim) throw new Error("claim_cpe_operation returned null");

  if (claim.owned === false) {
    const currentStatus = claim.current_status as string;
    if (["accepted", "available", "rejected", "manual_review"].includes(currentStatus)) {
      return;
    }
    throw new Error("Another worker owns status_check; retry later");
  }

  const tipoDoc = claim.tipo_doc as string;
  const serie = claim.serie as string;
  const correlativo = claim.correlativo as string;

  let statusResult;
  try {
    statusResult = await getInvoiceStatus({
      tipo: tipoDoc,
      serie,
      numero: correlativo,
    });
  } catch (err) {
    // Record error and throw for outbox retry
    const errorMsg = err instanceof ApisPeruError
      ? err.message
      : err instanceof Error ? err.message : String(err);

    await recordOperationError(admin, invoiceId, claimToken, "status_check", errorMsg);
    throw new Error(`Status check failed: ${errorMsg}`);
  }

  // StatusResult has root-level cdrResponse and cdrZip (NOT nested under sunatResponse)
  const cdr = statusResult.cdrResponse;

  if (cdr?.accepted === true) {
    const { error: acceptError } = await admin.rpc("record_cpe_accepted", {
      p_invoice_id: invoiceId,
      p_claim_token: claimToken,
      p_provider_response: sanitizeStatusResponse(statusResult),
      p_signed_xml: undefined,
      p_cdr_zip_base64: statusResult.cdrZip ?? undefined,
      p_document_hash: undefined,
      p_sunat_response_code: cdr.code ?? undefined,
      p_sunat_cdr_description: cdr.description ?? undefined,
      p_sunat_cdr_notes: cdr.notes ?? undefined,
    });

    if (acceptError) {
      if (acceptError.message.includes("lost_claim")) {
        throw new LostClaimError(acceptError.message);
      }
      throw new Error(`record_cpe_accepted failed: ${acceptError.message}`);
    }
    return;
  }

  if (cdr?.accepted === false) {
    const { error: rejectError } = await admin.rpc("record_cpe_rejected", {
      p_invoice_id: invoiceId,
      p_claim_token: claimToken,
      p_provider_response: sanitizeStatusResponse(statusResult),
      p_sunat_response_code: cdr.code ?? undefined,
      p_sunat_cdr_description: cdr.description ?? undefined,
      p_sunat_cdr_notes: cdr.notes ?? undefined,
    });

    if (rejectError) {
      if (rejectError.message.includes("lost_claim")) {
        throw new LostClaimError(rejectError.message);
      }
      throw new Error(`record_cpe_rejected failed: ${rejectError.message}`);
    }
    return;
  }

  // No authoritative CDR yet — record error and let outbox retry with backoff
  await recordOperationError(
    admin,
    invoiceId,
    claimToken,
    "status_check",
    "Status check returned no authoritative CDR",
  );
  throw new Error("Status check: no authoritative CDR yet");
}

async function recordOperationError(
  admin: SupabaseClient<Database>,
  invoiceId: string,
  claimToken: string,
  operation: string,
  errorDetail: string,
): Promise<void> {
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
    throw new Error(`record_cpe_operation_error failed: ${error.message}`);
  }
}

function sanitizeStatusResponse(response: unknown): Json {
  const r = response as Record<string, unknown>;
  const sanitized: { [key: string]: Json | undefined } = {
    success: r.success as Json,
  };
  if (r.cdrResponse) sanitized.cdrResponse = r.cdrResponse as Json;
  if (r.code) sanitized.code = r.code as Json;
  if (r.error) sanitized.error = r.error as Json;
  return sanitized;
}
