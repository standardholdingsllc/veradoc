import { z } from "zod";

// --- Request types ---

export interface CreateChargeInput {
  amount: number;
  currency_code: "PEN";
  source_id: string;
  email: string;
  description?: string;
  capture?: boolean;
  metadata?: Record<string, string>;
  antifraud_details?: {
    device_finger_print_id?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    address?: string;
    address_city?: string;
    country_code?: string;
    email?: string;
  };
  authentication_3DS?: {
    eci: string;
    xid: string;
    cavv: string;
    protocolVersion?: string;
    directoryServerTransactionId?: string;
  };
}

// --- Runtime-validated response schemas ---

const CulqiChargeSourceSchema = z.object({
  object: z.string(),
  id: z.string(),
  type: z.string(),
}).passthrough();

export const CulqiChargeSchema = z.object({
  object: z.literal("charge"),
  id: z.string().regex(/^chr_(test|live)_/),
  amount: z.number().int().positive(),
  source: CulqiChargeSourceSchema,
  response_code: z.string(),
  merchant_message: z.string(),
  user_message: z.string(),
}).passthrough();

export const CulqiErrorSchema = z.object({
  object: z.literal("error"),
  type: z.string(),
  code: z.string(),
  merchant_message: z.string(),
  user_message: z.string(),
}).passthrough();

export type CulqiCharge = z.infer<typeof CulqiChargeSchema>;
export type CulqiError = z.infer<typeof CulqiErrorSchema>;

/**
 * Culqi's documentation contradicts itself on HTTP status codes for 3DS responses.
 * We classify by validated shape instead:
 * - Known charge object → success or decline (based on response_code)
 * - Known error object → decline
 * - 2xx + non-trivial object that is neither charge nor error → likely 3DS
 * - Anything else → uncertain
 */
export function looksLike3DSRequired(json: unknown, httpStatus: number): boolean {
  if (httpStatus < 200 || httpStatus >= 300) return false;
  if (typeof json !== "object" || json === null || Array.isArray(json)) return false;
  const obj = json as Record<string, unknown>;
  if (obj.object === "charge" || obj.object === "error") return false;
  return Object.keys(obj).length > 0;
}

// --- Discriminated result (classified by response shape) ---

export type CreateChargeResult =
  | { kind: "succeeded"; charge: CulqiCharge }
  | { kind: "requires_3ds"; httpStatus: number; httpBody: unknown }
  | { kind: "declined"; error: CulqiError }
  | { kind: "uncertain"; reason: string; userMessage: string };

export type GetChargeResult =
  | { ok: true; data: CulqiCharge }
  | { ok: false; reason: string };

// --- Input validation schemas for server actions ---

export const ProcessPaymentInputSchema = z.object({
  paymentId: z.string().uuid(),
  tokenId: z.string().regex(/^(tkn|ype)_(test|live)_/),
  deviceFingerPrintId: z.string().optional(),
});

export const Complete3DSInputSchema = z.object({
  paymentId: z.string().uuid(),
  tokenId: z.string().regex(/^(tkn|ype)_(test|live)_/),
  challengeNonce: z.string().min(1),
  authentication3DS: z.object({
    eci: z.string().min(1),
    xid: z.string().min(1),
    cavv: z.string().min(1),
    protocolVersion: z.string().optional(),
    directoryServerTransactionId: z.string().optional(),
  }),
});
