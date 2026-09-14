import "server-only";

import { z } from "zod";
import {
  RucLookupError,
  type NormalizedRucResult,
} from "./types";
import { getRucLookupConfig } from "@/lib/env/server";

const REQUEST_TIMEOUT_MS = 5_000;

const RucLookupDataSchema = z.object({
  ruc: z.string(),
  nombre_o_razon_social: z.string(),
  direccion: z.string(),
  direccion_completa: z.string().optional(),
  estado: z.string(),
  condicion: z.string(),
  departamento: z.string(),
  provincia: z.string(),
  distrito: z.string(),
  ubigeo: z.array(z.string()).optional(),
  ubigeo2: z.string().optional(),
});

const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: RucLookupDataSchema,
});

/**
 * Normalize the district ubigeo from the vendor's response.
 * Use `ubigeo2` only when it is exactly six digits; otherwise use
 * the last `ubigeo` array element only when it is exactly six digits.
 */
function normalizeUbigeo(
  ubigeo2?: string,
  ubigeoArray?: string[],
): string | null {
  if (ubigeo2 && /^\d{6}$/.test(ubigeo2)) return ubigeo2;
  if (ubigeoArray && ubigeoArray.length > 0) {
    const last = ubigeoArray[ubigeoArray.length - 1];
    if (/^\d{6}$/.test(last)) return last;
  }
  return null;
}

/**
 * Look up a Peruvian RUC via the API PERÚ RUC product.
 *
 * Uses `Authorization: Bearer ${APIPERU_LOOKUP_TOKEN}` against `apiperu.net`.
 * This is NOT the Facturación v1.3 company token.
 *
 * Throws `RucLookupError` on any failure. The caller decides fallback policy.
 */
export async function lookupRuc(ruc: string): Promise<NormalizedRucResult> {
  const { token, baseUrl } = getRucLookupConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/ruc/${encodeURIComponent(ruc)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RucLookupError("timeout", "RUC lookup timed out");
    }
    throw new RucLookupError(
      "provider_error",
      `RUC lookup network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new RucLookupError("auth_error", "RUC lookup authentication failed");
  }

  if (!response.ok) {
    throw new RucLookupError(
      "provider_error",
      `RUC lookup failed with status ${response.status}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new RucLookupError(
      "invalid_response",
      "RUC lookup returned malformed JSON",
    );
  }

  if (typeof json === "object" && json !== null && "success" in json && (json as { success: unknown }).success !== true) {
    throw new RucLookupError("not_found", "RUC lookup returned success=false");
  }

  const parsed = SuccessResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new RucLookupError(
      "invalid_response",
      "RUC lookup response schema validation failed",
    );
  }

  const data = parsed.data.data;

  if (data.ruc !== ruc) {
    throw new RucLookupError(
      "ruc_mismatch",
      `RUC lookup returned different RUC: requested ${ruc}, got ${data.ruc}`,
    );
  }

  if (data.estado !== "ACTIVO") {
    throw new RucLookupError(
      "inactive",
      `RUC ${ruc} has estado=${data.estado}`,
    );
  }

  if (data.condicion !== "HABIDO") {
    throw new RucLookupError(
      "not_habido",
      `RUC ${ruc} has condicion=${data.condicion}`,
    );
  }

  return {
    ruc: data.ruc,
    razonSocial: data.nombre_o_razon_social,
    direccion: data.direccion,
    estado: data.estado,
    condicion: data.condicion,
    departamento: data.departamento,
    provincia: data.provincia,
    distrito: data.distrito,
    ubigeo: normalizeUbigeo(data.ubigeo2, data.ubigeo),
  };
}
