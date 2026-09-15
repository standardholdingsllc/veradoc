import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalSupabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const originalMercadoPagoEnvironment = process.env.MERCADOPAGO_ENVIRONMENT;
const originalCommercialAccountingEnabled =
  process.env.COMMERCIAL_ACCOUNTING_ENABLED;

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

  if (originalCommercialAccountingEnabled === undefined) {
    delete process.env.COMMERCIAL_ACCOUNTING_ENABLED;
  } else {
    process.env.COMMERCIAL_ACCOUNTING_ENABLED =
      originalCommercialAccountingEnabled;
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

  it("keeps commercial accounting disabled by default", async () => {
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    delete process.env.COMMERCIAL_ACCOUNTING_ENABLED;

    const { isCommercialAccountingEnabled } = await import("@/lib/env/server");

    expect(isCommercialAccountingEnabled()).toBe(false);
  });

  it("enables commercial accounting only for the exact true value", async () => {
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.COMMERCIAL_ACCOUNTING_ENABLED = "true";

    const { isCommercialAccountingEnabled } = await import("@/lib/env/server");

    expect(isCommercialAccountingEnabled()).toBe(true);
  });
});
