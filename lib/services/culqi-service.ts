import "server-only";
import { serverEnv } from "@/lib/env/server";
import type { CreateChargeInput, CreateChargeResult, GetChargeResult } from "./culqi-types";
import { CulqiChargeSchema, CulqiErrorSchema, looksLike3DSRequired } from "./culqi-types";

const TIMEOUT_MS = 15_000;

export async function createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const sk = serverEnv.CULQI_SECRET_KEY;
  if (!sk) {
    return { kind: "uncertain", reason: "CULQI_SECRET_KEY not configured", userMessage: "Pagos no disponibles." };
  }

  const url = `${serverEnv.CULQI_API_BASE_URL}/v2/charges`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${sk}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { kind: "uncertain", reason: `Non-JSON response (HTTP ${res.status})`, userMessage: "Estamos verificando el estado de su pago." };
    }

    // Shape-first classification

    const chargeParse = CulqiChargeSchema.safeParse(json);
    if (chargeParse.success) {
      const charge = chargeParse.data;
      if (charge.response_code === "venta_exitosa") {
        return { kind: "succeeded", charge };
      }
      return {
        kind: "declined",
        error: {
          object: "error" as const,
          type: "charge_error",
          code: charge.response_code,
          merchant_message: charge.merchant_message,
          user_message: charge.user_message,
        },
      };
    }

    const errorParse = CulqiErrorSchema.safeParse(json);
    if (errorParse.success) {
      return { kind: "declined", error: errorParse.data };
    }

    if (looksLike3DSRequired(json, res.status)) {
      return { kind: "requires_3ds", httpStatus: res.status, httpBody: json };
    }

    return { kind: "uncertain", reason: `Unrecognized response shape (HTTP ${res.status})`, userMessage: "Estamos verificando el estado de su pago." };
  } catch (err) {
    return {
      kind: "uncertain",
      reason: err instanceof Error ? err.message : "Unknown error",
      userMessage: "Estamos verificando el estado de su pago. No intente pagar nuevamente por ahora.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCharge(chargeId: string): Promise<GetChargeResult> {
  const sk = serverEnv.CULQI_SECRET_KEY;
  if (!sk) return { ok: false, reason: "No secret key" };

  const url = `${serverEnv.CULQI_API_BASE_URL}/v2/charges/${chargeId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${sk}` },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const json = await res.json();
    const parsed = CulqiChargeSchema.safeParse(json);
    if (!parsed.success) return { ok: false, reason: "Invalid charge shape" };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown" };
  } finally {
    clearTimeout(timeout);
  }
}
