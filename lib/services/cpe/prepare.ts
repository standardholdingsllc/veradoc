import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { validateApisPeruConfig } from "@/lib/env/server";
import {
  buildInvoicePayload,
  buildCreditNotePayload,
  computeIgvBreakdown,
  type EmitterConfig,
} from "@/lib/services/apisperu/mapper";

/**
 * cpe_prepare handler.
 *
 * - Validates source_kind and the matching UUID.
 * - Calls the appropriate claim_or_create RPC with the outbox claim token.
 * - Builds the immutable payload from returned snapshots.
 * - Calls complete_cpe_preparation (fenced write + cpe_submit enqueue).
 *
 * No external provider call occurs in this handler.
 */
export async function handleCpePrepare(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  outboxRowId: string,
  claimToken: string,
): Promise<void> {
  const sourceKind = payload.source_kind as string;
  const config = validateApisPeruConfig();
  const emitter: EmitterConfig = config.emitter;

  if (sourceKind === "payment") {
    await prepareFromPayment(admin, payload, claimToken, emitter, config.series);
  } else if (sourceKind === "refund") {
    await prepareFromRefund(admin, payload, claimToken, emitter, config.series);
  } else {
    throw new Error(`Unknown cpe_prepare source_kind: ${sourceKind}`);
  }
}

type SeriesConfig = ReturnType<typeof validateApisPeruConfig>["series"];

async function prepareFromPayment(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  claimToken: string,
  emitter: EmitterConfig,
  series: SeriesConfig,
): Promise<void> {
  const paymentId = payload.payment_id as string;
  if (!paymentId) throw new Error("Missing payment_id in cpe_prepare payload");

  const { data, error } = await admin.rpc("claim_or_create_primary_cpe", {
    p_payment_id: paymentId,
    p_claim_token: claimToken,
    p_factura_serie: series.factura,
    p_boleta_serie: series.boleta,
  });

  if (error) throw new Error(`claim_or_create_primary_cpe failed: ${error.message}`);

  const result = data as Record<string, unknown>;
  if (!result) throw new Error("claim_or_create_primary_cpe returned null");

  if (result.owned === false && result.already_advanced === true) {
    return;
  }

  if (result.owned === false) {
    throw new Error("Another worker owns prepare for this CPE; retry later");
  }

  const tipoDoc = result.comprobante_type as "01" | "03";
  const invoicePayload = buildInvoicePayload({
    tipoDoc,
    serie: result.serie as string,
    correlativo: result.correlativo as string,
    issuedAt: result.issued_at as string,
    purchaser: {
      tipoDoc: result.purchaser_tipo_doc as string,
      numDoc: result.purchaser_num_doc as string,
      razonSocial: result.purchaser_razon_social as string,
      address: (result.purchaser_address as Record<string, string>) || undefined,
    },
    totalCentimos: result.amount_centimos as number,
    emitter,
  });

  const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(
    result.amount_centimos as number,
  );

  const { error: completeError } = await admin.rpc("complete_cpe_preparation", {
    p_invoice_id: result.invoice_id as string,
    p_claim_token: claimToken,
    p_request_payload: invoicePayload as unknown as Json,
    p_subtotal_centimos: subtotalCentimos,
    p_igv_centimos: igvCentimos,
    p_total_centimos: result.amount_centimos as number,
  });

  if (completeError) {
    if (completeError.message.includes("lost_claim")) {
      throw new LostClaimError(completeError.message);
    }
    throw new Error(`complete_cpe_preparation failed: ${completeError.message}`);
  }
}

async function prepareFromRefund(
  admin: SupabaseClient<Database>,
  payload: Record<string, unknown>,
  claimToken: string,
  emitter: EmitterConfig,
  series: SeriesConfig,
): Promise<void> {
  const refundId = payload.refund_id as string;
  if (!refundId) throw new Error("Missing refund_id in cpe_prepare payload");

  const { data, error } = await admin.rpc("claim_or_create_credit_note", {
    p_refund_id: refundId,
    p_claim_token: claimToken,
    p_cn_factura_serie: series.creditNoteFactura,
    p_cn_boleta_serie: series.creditNoteBoleta,
  });

  if (error) throw new Error(`claim_or_create_credit_note failed: ${error.message}`);

  const result = data as Record<string, unknown>;
  if (!result) throw new Error("claim_or_create_credit_note returned null");

  if (result.owned === false && result.already_advanced === true) {
    return;
  }

  if (result.owned === false) {
    throw new Error("Another worker owns prepare for this credit note; retry later");
  }

  const notePayload = buildCreditNotePayload({
    serie: result.serie as string,
    correlativo: result.correlativo as string,
    issuedAt: result.issued_at as string,
    originalTipoDoc: result.original_tipo_doc as "01" | "03",
    originalSerie: result.original_serie as string,
    originalCorrelativo: result.original_correlativo as string,
    purchaser: {
      tipoDoc: result.purchaser_tipo_doc as string,
      numDoc: result.purchaser_num_doc as string,
      razonSocial: result.purchaser_razon_social as string,
      address: (result.purchaser_address as Record<string, string>) || undefined,
    },
    refundAmountCentimos: result.refund_amount_centimos as number,
    reasonCode: result.reason_code as string,
    reasonDescription: result.reason_description as string,
    emitter,
  });

  const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(
    result.refund_amount_centimos as number,
  );

  const { error: completeError } = await admin.rpc("complete_cpe_preparation", {
    p_invoice_id: result.invoice_id as string,
    p_claim_token: claimToken,
    p_request_payload: notePayload as unknown as Json,
    p_subtotal_centimos: subtotalCentimos,
    p_igv_centimos: igvCentimos,
    p_total_centimos: result.refund_amount_centimos as number,
  });

  if (completeError) {
    if (completeError.message.includes("lost_claim")) {
      throw new LostClaimError(completeError.message);
    }
    throw new Error(`complete_cpe_preparation failed: ${completeError.message}`);
  }
}

export class LostClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LostClaimError";
  }
}
