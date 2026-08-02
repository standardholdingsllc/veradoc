import crypto from "crypto";

/**
 * Verify a FirmEasy webhook signature using HMAC-SHA256.
 *
 * ASSUMPTION: The header name is "X-Firmeasy-Signature" and the base string
 * is the raw request body. Must be confirmed during FirmEasy onboarding.
 */
export function verifyFirmEasyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export const FIRMEASY_SIGNATURE_HEADER = "x-firmeasy-signature";
