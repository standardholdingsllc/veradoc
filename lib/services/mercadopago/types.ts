import { z } from "zod";

// ---------------------------------------------------------------------------
// Request schemas (strict — we control what we send)
// ---------------------------------------------------------------------------

export const mercadoPagoPayerIdentificationSchema = z.object({
  type: z.string(),
  number: z.string(),
});

export const mercadoPagoPayerSchema = z.object({
  email: z.string().email(),
  identification: mercadoPagoPayerIdentificationSchema,
});

export const mercadoPagoCreatePaymentRequestSchema = z.object({
  token: z.string().min(1),
  transaction_amount: z.number().positive(),
  description: z.string().min(1),
  payment_method_id: z.string().min(1),
  issuer_id: z.string().optional(),
  installments: z.number().int().positive(),
  payer: mercadoPagoPayerSchema,
  three_d_secure_mode: z.literal("optional"),
  capture: z.literal(true),
  binary_mode: z.literal(false),
  external_reference: z.string().min(1),
  metadata: z.record(z.string(), z.string()),
  notification_url: z.string().url().optional(),
});

export type MercadoPagoCreatePaymentRequest = z.infer<
  typeof mercadoPagoCreatePaymentRequestSchema
>;

// ---------------------------------------------------------------------------
// Response schemas (tolerant — the provider may add fields)
// ---------------------------------------------------------------------------

export const mercadoPago3DSInfoSchema = z
  .object({
    external_resource_url: z.string().url(),
    creq: z.string().min(1),
  })
  .nullable()
  .optional();

export type MercadoPago3DSInfo = z.infer<typeof mercadoPago3DSInfoSchema>;

export const mercadoPagoPaymentStatus = z.enum([
  "approved",
  "authorized",
  "pending",
  "in_process",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
  "in_mediation",
]);

export type MercadoPagoPaymentStatus = z.infer<typeof mercadoPagoPaymentStatus>;

export const mercadoPagoPaymentResponseSchema = z.object({
  id: z.number(),
  status: mercadoPagoPaymentStatus,
  status_detail: z.string(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  payment_method_id: z.string(),
  payment_type_id: z.string().optional(),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.number().optional(),
  three_ds_info: mercadoPago3DSInfoSchema,
  external_reference: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  date_approved: z.string().nullable().optional(),
  date_created: z.string().nullable().optional(),
  live_mode: z.boolean(),
  fee_details: z
    .array(
      z
        .object({
          amount: z.number().nonnegative(),
          fee_payer: z.string().optional(),
          type: z.string().optional(),
        })
        .passthrough(),
    )
    .optional(),
  payer: z
    .object({
      id: z.union([z.string(), z.number()]).nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .passthrough()
    .optional(),
});

export type MercadoPagoPaymentResponse = z.infer<
  typeof mercadoPagoPaymentResponseSchema
>;

// ---------------------------------------------------------------------------
// Error schemas
// ---------------------------------------------------------------------------

export const mercadoPagoErrorCauseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  data: z.unknown().optional(),
});

export const mercadoPagoErrorSchema = z.object({
  message: z.string().optional(),
  error: z.string().optional(),
  status: z.number().optional(),
  cause: z.array(mercadoPagoErrorCauseSchema).optional(),
});

export type MercadoPagoError = z.infer<typeof mercadoPagoErrorSchema>;

// ---------------------------------------------------------------------------
// Webhook schemas
// ---------------------------------------------------------------------------

export const mercadoPagoWebhookPayloadSchema = z.object({
  action: z.string(),
  api_version: z.string().optional(),
  data: z.object({ id: z.string() }),
  date_created: z.string().optional(),
  id: z.union([z.string(), z.number()]),
  live_mode: z.boolean(),
  type: z.string(),
  user_id: z.union([z.string(), z.number()]).optional(),
});

export type MercadoPagoWebhookPayload = z.infer<
  typeof mercadoPagoWebhookPayloadSchema
>;

// ---------------------------------------------------------------------------
// Refund schemas
// ---------------------------------------------------------------------------

export const mercadoPagoRefundResponseSchema = z.object({
  id: z.number(),
  payment_id: z.number(),
  amount: z.number(),
  status: z.string(),
  date_created: z.string().nullable().optional(),
  source: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

export type MercadoPagoRefundResponse = z.infer<
  typeof mercadoPagoRefundResponseSchema
>;

// ---------------------------------------------------------------------------
// Internal types (application-level)
// ---------------------------------------------------------------------------

export type PaymentTransitionOutcome =
  | { outcome: "completed"; paymentId: string; providerPaymentId: string }
  | { outcome: "already_completed" }
  | { outcome: "requires_action"; threeDSInfo: MercadoPago3DSInfo }
  | { outcome: "processing" }
  | { outcome: "rejected"; statusDetail: string }
  | { outcome: "cancelled" }
  | { outcome: "terminal_dispute"; message: string }
  | { outcome: "error"; message: string };

export interface PreparePaymentResult {
  paymentId: string;
  amountCentimos: number;
  standardAmountCentimos: number;
  discountCentimos: number;
  promoCodeHint: string | null;
  currency: string;
  idempotencyKey: string;
  existingStatus?: string;
}

export interface ProcessPaymentResult {
  status: "completed" | "requires_action" | "processing" | "rejected" | "error";
  errorDetail?: string;
  threeDSInfo?: MercadoPago3DSInfo;
  providerPaymentId?: string;
}
