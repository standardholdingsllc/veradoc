import "server-only";

import { serverEnv } from "@/lib/env/server";
import {
  mercadoPagoPaymentResponseSchema,
  mercadoPagoRefundResponseSchema,
  type MercadoPagoPaymentResponse,
  type MercadoPagoRefundResponse,
} from "./types";

const BASE_URL = "https://api.mercadopago.com";
const TIMEOUT_MS = 30_000;

function getAccessToken(): string {
  const token = serverEnv.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
  return token;
}

async function mpFetch(
  path: string,
  options: RequestInit & { idempotencyKey?: string; deviceSessionId?: string } = {},
): Promise<Response> {
  const { idempotencyKey, deviceSessionId, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getAccessToken()}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    ...(deviceSessionId ? { "X-meli-session-id": deviceSessionId } : {}),
    ...(extraHeaders as Record<string, string> | undefined),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createPayment(params: {
  token: string;
  transactionAmount: number;
  description: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payerEmail: string;
  payerIdentificationType: string;
  payerIdentificationNumber: string;
  externalReference: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
  deviceSessionId?: string;
  notificationUrl?: string;
}): Promise<MercadoPagoPaymentResponse> {
  const body = {
    token: params.token,
    transaction_amount: params.transactionAmount,
    description: params.description,
    payment_method_id: params.paymentMethodId,
    ...(params.issuerId ? { issuer_id: params.issuerId } : {}),
    installments: params.installments,
    payer: {
      email: params.payerEmail,
      identification: {
        type: params.payerIdentificationType,
        number: params.payerIdentificationNumber,
      },
    },
    three_d_secure_mode: "optional" as const,
    capture: true as const,
    binary_mode: false as const,
    external_reference: params.externalReference,
    metadata: params.metadata,
    ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
  };

  const res = await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: params.idempotencyKey,
    deviceSessionId: params.deviceSessionId,
  });

  const json = await res.json();

  if (!res.ok) {
    const detail = json?.cause?.[0]?.description ?? json?.message ?? res.statusText;
    throw new MercadoPagoAPIError(
      `Mercado Pago createPayment failed (${res.status}): ${detail}`,
      res.status,
      json,
    );
  }

  return mercadoPagoPaymentResponseSchema.parse(json);
}

export async function getPayment(
  providerPaymentId: string,
): Promise<MercadoPagoPaymentResponse> {
  const res = await mpFetch(`/v1/payments/${providerPaymentId}`, { method: "GET" });
  const json = await res.json();

  if (!res.ok) {
    throw new MercadoPagoAPIError(
      `Mercado Pago getPayment failed (${res.status})`,
      res.status,
      json,
    );
  }

  return mercadoPagoPaymentResponseSchema.parse(json);
}

export async function createRefund(
  providerPaymentId: string,
  amount?: number,
  idempotencyKey?: string,
): Promise<MercadoPagoRefundResponse> {
  const body = amount != null ? JSON.stringify({ amount }) : undefined;

  const res = await mpFetch(`/v1/payments/${providerPaymentId}/refunds`, {
    method: "POST",
    body,
    idempotencyKey,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new MercadoPagoAPIError(
      `Mercado Pago createRefund failed (${res.status})`,
      res.status,
      json,
    );
  }

  return mercadoPagoRefundResponseSchema.parse(json);
}

export class MercadoPagoAPIError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "MercadoPagoAPIError";
  }
}
