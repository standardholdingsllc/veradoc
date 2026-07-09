import "server-only";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", ""])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SITE_URL: z.string().url().default("https://veradoc.pe"),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  IOFE_SIGNING_API_KEY: z.string().optional(),
  IOFE_SIGNING_API_URL: z.string().url().optional(),
  INVOICE_PROVIDER_API_KEY: z.string().optional(),
  // Culqi payment gateway
  CULQI_SECRET_KEY: z.string().optional(),
  CULQI_API_BASE_URL: z.string().url().default("https://api.culqi.com"),
  CULQI_MODE: z.enum(["test", "live"]).default("test"),
  CULQI_USE_MOCK: booleanFromString,
  DEMO_PAYMENTS_ENABLED: booleanFromString,
});

export const serverEnv = schema.parse(process.env);

export function validateCulqiConfig(): void {
  const { CULQI_MODE, CULQI_USE_MOCK, DEMO_PAYMENTS_ENABLED, CULQI_API_BASE_URL,
          CULQI_SECRET_KEY } = serverEnv;
  const pk = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;

  if (CULQI_MODE === "live") {
    if (CULQI_USE_MOCK) throw new Error("FATAL: CULQI_USE_MOCK=true forbidden in live mode");
    if (DEMO_PAYMENTS_ENABLED) throw new Error("FATAL: DEMO_PAYMENTS_ENABLED=true forbidden in live mode");
    if (CULQI_API_BASE_URL !== "https://api.culqi.com") throw new Error("FATAL: CULQI_API_BASE_URL must be https://api.culqi.com in live mode");
    if (!CULQI_SECRET_KEY?.startsWith("sk_live_")) throw new Error("FATAL: CULQI_SECRET_KEY must start with sk_live_ in live mode");
    if (!pk?.startsWith("pk_live_")) throw new Error("FATAL: NEXT_PUBLIC_CULQI_PUBLIC_KEY must start with pk_live_ in live mode");
  }
  if (CULQI_MODE === "test") {
    if (CULQI_SECRET_KEY && !CULQI_SECRET_KEY.startsWith("sk_test_")) {
      throw new Error("FATAL: CULQI_SECRET_KEY must start with sk_test_ in test mode");
    }
    if (pk && !pk.startsWith("pk_test_")) {
      throw new Error("FATAL: NEXT_PUBLIC_CULQI_PUBLIC_KEY must start with pk_test_ in test mode");
    }
  }
}

export function shouldUseMockPayment(): boolean {
  if (serverEnv.CULQI_MODE === "live") return false;
  return serverEnv.CULQI_USE_MOCK;
}

export function requireCulqiReady(): { ok: true } | { ok: false; reason: string } {
  if (shouldUseMockPayment()) return { ok: true };
  if (!serverEnv.CULQI_SECRET_KEY) {
    return { ok: false, reason: "CULQI_SECRET_KEY not configured. Cannot process real charges." };
  }
  return { ok: true };
}

export function isDemoPaymentsEnabled(): boolean {
  if (serverEnv.CULQI_MODE === "live") return false;
  return serverEnv.DEMO_PAYMENTS_ENABLED;
}
