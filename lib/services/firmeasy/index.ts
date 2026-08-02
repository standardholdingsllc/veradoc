import "server-only";

import { isFirmEasyConfigured } from "@/lib/env/server";
import { FirmEasyClient } from "./client";

export { FirmEasyClient, FirmEasyApiError } from "./client";
export { verifyFirmEasyWebhookSignature, FIRMEASY_SIGNATURE_HEADER } from "./hmac";
export { parseWhatsappForFirmEasy } from "./normalize";
export type * from "./types";

let _client: FirmEasyClient | null = null;

/**
 * Returns a FirmEasyClient instance if configured, or null if FirmEasy
 * credentials are not available (dev/CI environments).
 */
export function getFirmEasyClient(): FirmEasyClient | null {
  if (!isFirmEasyConfigured()) return null;
  if (!_client) {
    _client = new FirmEasyClient();
  }
  return _client;
}
