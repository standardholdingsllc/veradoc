import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  sendInvoice,
  sendCreditNote,
  ApisPeruError,
  type ApisPeruSendResponse,
} from "@/lib/services/apisperu";
import type {
  ApisPeruInvoiceRequest,
  ApisPeruCreditNoteRequest,
} from "@/lib/services/apisperu/types";
import { LostClaimError } from "./prepare";

/**
 * cpe_submit handler.
 *
 * - Claims only next_operation = 'submit' with submission_intent_at IS NULL.
 * - Calls record_submission_intent BEFORE the external request.
 * - Makes exactly one automatic provider call.
 * - Routes the result through fenced RPCs.
 */
export async function handleCpeSubmit(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  outboxRowId: string,
  claimToken: string,
): Promise<void> {
  const invoiceId = payload.invoice_id as string;
  const tipoDoc = payload.tipo_doc as string;
  if (!invoiceId) throw new Error("Missing invoice_id in cpe_submit payload");

  // Claim the submit operation
  const { data: claimData, error: claimError } = await admin.rpc(
    "claim_cpe_operation",
    {
      p_invoice_id: invoiceId,
      p_operation: "submit",
      p_claim_token: claimToken,
    },
  );

  if (claimError) throw new Error(`claim_cpe_operation failed: ${claimError.message}`);

  const claim = claimData as Record<string, unknown>;
  if (!claim) throw new Error("claim_cpe_operation returned null");

  if (claim.owned === false) {
    if (claim.current_operation !== "submit") return;

    // For credit notes (07) in submitted state: intent was recorded but the
    // API call outcome is unknown (crash after intent commit). Route to
    // manual_review since there is no status endpoint for credit notes.
    // Use escalate_cpe_manual_review RPC which doesn't require a claim.
    if (tipoDoc === "07" && claim.current_status === "submitted") {
      const { error: escError } = await admin.rpc("escalate_cpe_manual_review", {
        p_invoice_id: invoiceId,
        p_error_detail: "Credit note submission intent was recorded but API outcome is unknown (crash recovery). Requires manual review.",
      });
      if (escError) throw new Error(`escalate_cpe_manual_review failed: ${escError.message}`);
      return;
    }

    throw new Error("Another worker owns submit; retry later");
  }

  // If submission intent is already recorded, don't resubmit
  if (claim.submission_intent_at) {
    return;
  }

  // Record submission intent BEFORE the HTTP call
  const { error: intentError } = await admin.rpc("record_submission_intent", {
    p_invoice_id: invoiceId,
    p_claim_token: claimToken,
  });

  if (intentError) {
    if (intentError.message.includes("lost_claim")) {
      throw new LostClaimError(intentError.message);
    }
    throw new Error(`record_submission_intent failed: ${intentError.message}`);
  }

  // Make exactly one provider call
  const storedPayload = claim.request_payload as Record<string, unknown>;
  if (!storedPayload) {
    throw new Error("No request_payload found on claimed invoice");
  }

  let response: ApisPeruSendResponse;
  try {
    if (tipoDoc === "01" || tipoDoc === "03") {
      response = await sendInvoice(storedPayload as unknown as ApisPeruInvoiceRequest);
    } else if (tipoDoc === "07") {
      response = await sendCreditNote(storedPayload as unknown as ApisPeruCreditNoteRequest);
    } else {
      throw new Error(`Unknown tipo_doc: ${tipoDoc}`);
    }
  } catch (err) {
    if (err instanceof ApisPeruError) {
      if (err.kind === "definitive_validation") {
        // Payload rejected before reaching SUNAT — doc was never submitted.
        // No authoritative CDR exists. Route to manual_review since the
        // correlativo is consumed and human intervention is needed.
        const { error: escError } = await admin.rpc("escalate_cpe_manual_review", {
          p_invoice_id: invoiceId,
          p_error_detail: `Definitive validation (never sent to SUNAT): ${err.message}`,
        });
        if (escError) throw new Error(`escalate_cpe_manual_review failed: ${escError.message}`);
        return;
      }
      // Ambiguous or provider_unavailable -> record ambiguous for reconciliation
      await safeRpcCall(admin, "record_cpe_ambiguous", {
        p_invoice_id: invoiceId,
        p_claim_token: claimToken,
        p_error_detail: err.message,
      });
      return;
    }
    // Unexpected error -> ambiguous
    await safeRpcCall(admin, "record_cpe_ambiguous", {
      p_invoice_id: invoiceId,
      p_claim_token: claimToken,
      p_error_detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Process the response — DocumentResponse shape:
  //   { xml, hash, sunatResponse: { success, cdrResponse, cdrZip } }
  const cdr = response.sunatResponse?.cdrResponse;
  const sanitizedResponse = sanitizeProviderResponse(response);

  if (cdr?.accepted === true) {
    // Authoritative acceptance
    const { error: acceptError } = await admin.rpc("record_cpe_accepted", {
      p_invoice_id: invoiceId,
      p_claim_token: claimToken,
      p_provider_response: sanitizedResponse,
      p_signed_xml: response.xml ?? undefined,
      p_cdr_zip_base64: response.sunatResponse?.cdrZip ?? undefined,
      p_document_hash: response.hash ?? undefined,
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
    // Authoritative rejection
    const { error: rejectError } = await admin.rpc("record_cpe_rejected", {
      p_invoice_id: invoiceId,
      p_claim_token: claimToken,
      p_provider_response: sanitizedResponse,
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

  // No authoritative CDR -> ambiguous
  await safeRpcCall(admin, "record_cpe_ambiguous", {
    p_invoice_id: invoiceId,
    p_claim_token: claimToken,
    p_error_detail: "No authoritative CDR in provider response",
  });
}

async function safeRpcCall(
  admin: SupabaseClient<Database>,
  rpcName: string,
  params: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.rpc(rpcName as never, params as never);
  if (error) {
    if (error.message.includes("lost_claim")) {
      throw new LostClaimError(error.message);
    }
    throw new Error(`${rpcName} failed: ${error.message}`);
  }
}

function sanitizeProviderResponse(response: ApisPeruSendResponse): Json {
  const sanitized: { [key: string]: Json | undefined } = {};
  if (response.hash) sanitized.hash = response.hash as Json;
  if (response.sunatResponse) {
    sanitized.sunatResponse = {
      success: response.sunatResponse.success,
      cdrResponse: response.sunatResponse.cdrResponse,
    } as Json;
  }
  return sanitized;
}
