"use server";

import { isRucLookupConfigured } from "@/lib/env/server";

type ActionResult<T> = { data?: T; error?: string };

export async function lookupRucAction(
  ruc: string,
): Promise<ActionResult<{ razonSocial: string; direccion: string; departamento: string; provincia: string; distrito: string; ubigeo: string | null }>> {
  if (!isRucLookupConfigured()) {
    return { error: "RUC lookup not configured" };
  }

  try {
    const { lookupRuc } = await import("@/lib/services/apiperu-lookup/client");
    const result = await lookupRuc(ruc);
    return {
      data: {
        razonSocial: result.razonSocial,
        direccion: result.direccion,
        departamento: result.departamento,
        provincia: result.provincia,
        distrito: result.distrito,
        ubigeo: result.ubigeo,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "RUC lookup failed" };
  }
}
