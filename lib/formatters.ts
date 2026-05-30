/**
 * Pure formatting utilities for VeraDoc.pe.
 * Server-safe — no store, no React.
 */

import {
  format,
  formatDistanceToNow,
  isAfter,
  parseISO,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";

/** Format ISO date as "29 may 2024" */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy", { locale: es });
}

/** Format ISO datetime as "29 may 2024, 14:30" */
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es });
}

/** Format ISO datetime as relative time, e.g. "hace 3 días" */
export function formatRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
}

/** Format amount as Peruvian soles, e.g. "S/ 89.00" */
export function formatCurrency(
  amount: number,
  currency: "PEN" = "PEN",
): string {
  const formatted = amount.toFixed(2);
  if (currency === "PEN") {
    return `S/ ${formatted}`;
  }
  return `${currency} ${formatted}`;
}

/** Truncate a hash for display, e.g. "a3f2b1...c4d5e6" */
export function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2 + 3) {
    return hash;
  }
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

/** Returns true when the lease expiration date is before today */
export function isLeaseExpired(expirationDate: string): boolean {
  const today = startOfDay(new Date());
  const expiration = startOfDay(parseISO(expirationDate));
  return isAfter(today, expiration);
}

/** Format packet code for display (pass-through for now) */
export function formatPacketCode(code: string): string {
  return code;
}
