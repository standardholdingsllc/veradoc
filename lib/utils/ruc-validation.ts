/**
 * Peruvian RUC and DNI format validation.
 *
 * RUC checksum does NOT prove the RUC is active, habido, or matches the
 * supplied legal name. Production use must pair this with a live lookup
 * via the API PERÚ RUC product.
 */

const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Validate a Peruvian RUC using the modulus-11 checksum algorithm.
 * Returns `true` only for 11-digit strings with a valid check digit.
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;

  const digits = ruc.split("").map(Number);

  // First digit must be 1 or 2 (natural person / juridical entity)
  if (digits[0] !== 1 && digits[0] !== 2) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * RUC_WEIGHTS[i];
  }

  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 10 ? 0 : remainder === 11 ? 1 : remainder;

  return digits[10] === checkDigit;
}

/**
 * Validate a Peruvian DNI format: exactly 8 digits.
 * This is a VeraDoc MVP product-policy requirement for boleta purchasers,
 * NOT a universal SUNAT rule.
 */
export function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

/**
 * Normalize a document number: trim whitespace, remove internal spaces.
 * Document numbers are always strings to preserve leading zeroes.
 */
export function normalizeDocNumber(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

/**
 * Normalize a legal name: trim, collapse internal whitespace, uppercase.
 */
export function normalizeRazonSocial(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}
