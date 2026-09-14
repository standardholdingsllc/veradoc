import "server-only";

import { createHash } from "node:crypto";

export function normalizePrivatePromoCode(code: string): string {
  return code.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");
}

export function hashPrivatePromoCode(code: string): string {
  const normalized = normalizePrivatePromoCode(code);
  if (!normalized) throw new Error("Promotion code is required.");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function promoCodeHint(code: string): string {
  const normalized = normalizePrivatePromoCode(code);
  if (normalized.length <= 4) return normalized;
  return `••••${normalized.slice(-4)}`;
}

