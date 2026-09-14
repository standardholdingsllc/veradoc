import "server-only";

import { z } from "zod";
import {
  ApisPeruError,
  type ApisPeruInvoiceRequest,
  type ApisPeruCreditNoteRequest,
  type ApisPeruSendResponse,
  type ApisPeruStatusResult,
  type ApisPeruPdfRequest,
} from "./types";
import { validateApisPeruConfig } from "@/lib/env/server";

const REQUEST_TIMEOUT_MS = 30_000;

function getAuthHeaders(): Record<string, string> {
  const { companyToken } = validateApisPeruConfig();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${companyToken}`,
  };
}

function getBaseUrl(): string {
  return validateApisPeruConfig().baseUrl;
}

async function safeFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

const CdrResponseSchema = z.object({
  id: z.string().optional().default(""),
  code: z.string().optional().default(""),
  description: z.string().optional().default(""),
  notes: z.array(z.string()).optional().default([]),
  accepted: z.boolean().optional(),
});

// DocumentResponse — /invoice/send and /note/send (Swagger)
const SendResponseSchema = z.object({
  xml: z.string().optional(),
  hash: z.string().optional(),
  sunatResponse: z
    .object({
      success: z.boolean(),
      cdrResponse: CdrResponseSchema.optional(),
      cdrZip: z.string().optional(),
      error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
    })
    .optional(),
});

// StatusResult — /invoice/status (Swagger)
// Root-level fields: success, cdrZip, cdrResponse, code, error
const StatusResponseSchema = z.object({
  success: z.boolean(),
  cdrZip: z.string().optional(),
  cdrResponse: CdrResponseSchema.optional(),
  code: z.string().optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
});

function classifyHttpError(status: number, body: string): ApisPeruError {
  if (status === 422 || (status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 429)) {
    return new ApisPeruError(
      "definitive_validation",
      `Provider validation error (${status})`,
      status,
      body.slice(0, 500),
    );
  }
  return new ApisPeruError(
    "provider_unavailable",
    `Provider error (${status})`,
    status,
    body.slice(0, 500),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * POST /invoice/send — submit a factura (01) or boleta (03).
 * This is the only automatic submission call; it must be called at most once
 * per document identity.
 */
export async function sendInvoice(
  payload: ApisPeruInvoiceRequest,
): Promise<ApisPeruSendResponse> {
  let response: Response;
  try {
    response = await safeFetch(`${getBaseUrl()}/invoice/send`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ApisPeruError(
      "ambiguous_submission",
      `Network error during invoice send: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500) {
      throw new ApisPeruError(
        "ambiguous_submission",
        `Ambiguous provider response (${response.status})`,
        response.status,
        body.slice(0, 500),
      );
    }
    throw classifyHttpError(response.status, body);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApisPeruError(
      "ambiguous_submission",
      "Malformed JSON response from provider",
    );
  }

  const parsed = SendResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApisPeruError(
      "ambiguous_submission",
      "Response schema validation failed",
    );
  }

  return parsed.data as ApisPeruSendResponse;
}

/**
 * GET /invoice/status — query the status of a submitted 01/03.
 * Never use this for credit notes (07).
 */
export async function getInvoiceStatus(identity: {
  tipo: string;
  serie: string;
  numero: string;
}): Promise<ApisPeruStatusResult> {
  const params = new URLSearchParams({
    tipo: identity.tipo,
    serie: identity.serie,
    numero: identity.numero,
  });

  let response: Response;
  try {
    response = await safeFetch(
      `${getBaseUrl()}/invoice/status?${params.toString()}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      },
    );
  } catch (err) {
    throw new ApisPeruError(
      "status_not_ready",
      `Network error during status check: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApisPeruError(
      "status_not_ready",
      `Status check failed (${response.status})`,
      response.status,
      body.slice(0, 500),
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApisPeruError(
      "status_not_ready",
      "Malformed JSON response from status endpoint",
    );
  }

  const parsed = StatusResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApisPeruError(
      "status_not_ready",
      "Status response schema validation failed",
    );
  }

  return parsed.data as ApisPeruStatusResult;
}

/**
 * POST /invoice/pdf — generate a PDF for a submitted 01/03.
 * Returns raw PDF bytes with validated content type.
 */
export async function getInvoicePdf(
  payload: ApisPeruPdfRequest,
): Promise<{ pdf: ArrayBuffer; contentType: string }> {
  let response: Response;
  try {
    response = await safeFetch(`${getBaseUrl()}/invoice/pdf`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ApisPeruError(
      "provider_unavailable",
      `Network error during PDF generation: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApisPeruError(
      "provider_unavailable",
      `PDF generation failed (${response.status})`,
      response.status,
      body.slice(0, 500),
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    const body = await response.text().catch(() => "");
    throw new ApisPeruError(
      "provider_unavailable",
      `PDF endpoint returned non-PDF content type: ${contentType}`,
      response.status,
      body.slice(0, 200),
    );
  }

  const pdf = await response.arrayBuffer();
  return { pdf, contentType };
}

/**
 * POST /note/send — submit a credit note (07).
 * At most one automatic call per note identity.
 */
export async function sendCreditNote(
  payload: ApisPeruCreditNoteRequest,
): Promise<ApisPeruSendResponse> {
  let response: Response;
  try {
    response = await safeFetch(`${getBaseUrl()}/note/send`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ApisPeruError(
      "ambiguous_submission",
      `Network error during credit note send: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500) {
      throw new ApisPeruError(
        "ambiguous_submission",
        `Ambiguous provider response for credit note (${response.status})`,
        response.status,
        body.slice(0, 500),
      );
    }
    throw classifyHttpError(response.status, body);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApisPeruError(
      "ambiguous_submission",
      "Malformed JSON response from credit note send",
    );
  }

  const parsed = SendResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApisPeruError(
      "ambiguous_submission",
      "Credit note response schema validation failed",
    );
  }

  return parsed.data as ApisPeruSendResponse;
}

/**
 * POST /note/pdf — generate a PDF for a submitted credit note (07).
 * Returns raw PDF bytes with validated content type.
 */
export async function getCreditNotePdf(
  payload: ApisPeruPdfRequest,
): Promise<{ pdf: ArrayBuffer; contentType: string }> {
  let response: Response;
  try {
    response = await safeFetch(`${getBaseUrl()}/note/pdf`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ApisPeruError(
      "provider_unavailable",
      `Network error during credit note PDF generation: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApisPeruError(
      "provider_unavailable",
      `Credit note PDF generation failed (${response.status})`,
      response.status,
      body.slice(0, 500),
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    const body = await response.text().catch(() => "");
    throw new ApisPeruError(
      "provider_unavailable",
      `Note PDF endpoint returned non-PDF content type: ${contentType}`,
      response.status,
      body.slice(0, 200),
    );
  }

  const pdf = await response.arrayBuffer();
  return { pdf, contentType };
}
