import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const originalMercadoPagoEnvironment = process.env.MERCADOPAGO_ENVIRONMENT;

afterEach(() => {
  if (originalSupabaseSecretKey === undefined) {
    delete process.env.SUPABASE_SECRET_KEY;
  } else {
    process.env.SUPABASE_SECRET_KEY = originalSupabaseSecretKey;
  }

  if (originalMercadoPagoEnvironment === undefined) {
    delete process.env.MERCADOPAGO_ENVIRONMENT;
  } else {
    process.env.MERCADOPAGO_ENVIRONMENT = originalMercadoPagoEnvironment;
  }

  vi.resetModules();
});

describe("server environment", () => {
  it.each([
    [" production\r\n", "production"],
    ["PRODUCTION", "production"],
    ["live", "production"],
    ["sandbox", "test"],
  ])("normalizes Mercado Pago environment %j to %s", async (input, expected) => {
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.MERCADOPAGO_ENVIRONMENT = input;

    const { serverEnv } = await import("@/lib/env/server");

    expect(serverEnv.MERCADOPAGO_ENVIRONMENT).toBe(expected);
  });
});
