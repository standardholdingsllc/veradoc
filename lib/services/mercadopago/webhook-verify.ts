import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/**
 * Verifies the authenticity of a Mercado Pago webhook request using the
 * `x-signature` header.
 *
 * Mercado Pago signs webhooks by building a manifest string from the `data.id`
 * query param, the `x-request-id` header, and a timestamp, then HMAC-SHA256
 * signing it with the application webhook secret.
 *
 * @see https://www.mercadopago.com.pe/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyMercadoPagoWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const { xSignature, xRequestId, dataId } = params;
  const secret = serverEnv.MERCADOPAGO_WEBHOOK_SECRET;

  if (!xSignature || !xRequestId || !dataId || !secret) {
    return false;
  }

  const parts = xSignature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.split("=");
    if (key && rest.length) {
      acc[key.trim()] = rest.join("=").trim();
    }
    return acc;
  }, {});

  const ts = parts["ts"];
  const v1 = parts["v1"];

  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
