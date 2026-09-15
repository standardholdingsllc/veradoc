import "server-only";

import { isCommercialAccountingEnabled } from "@/lib/env/server";

export const COMMERCIAL_ACCOUNTING_UNAVAILABLE_MESSAGE =
  "Las funciones de contabilidad comercial no están habilitadas.";

export function getCommercialAccountingUnavailableError(): string | null {
  return isCommercialAccountingEnabled()
    ? null
    : COMMERCIAL_ACCOUNTING_UNAVAILABLE_MESSAGE;
}
