import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commercialAccountingEnabled: false,
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  isCommercialAccountingEnabled: () => mocks.commercialAccountingEnabled,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

function createPricingQuery(data: Record<string, unknown>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.single.mockResolvedValue({ data, error: null });
  return query;
}

describe("packet pricing schema gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commercialAccountingEnabled = false;
  });

  it("uses only legacy pricing columns while commercial accounting is disabled", async () => {
    const query = createPricingQuery({
      amount_centimos: 8_900,
      currency: "PEN",
      description: "Paquete de arrendamiento estándar",
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const { getPacketPricing } = await import("@/lib/services/pricing-service");
    await expect(getPacketPricing()).resolves.toMatchObject({
      amountCentimos: 8_900,
      policyVersion: "legacy_v1",
      serviceWindowDays: 90,
    });

    expect(query.select).toHaveBeenCalledWith(
      "amount_centimos, currency, description",
    );
    expect(query.lte).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
  });

  it("uses effective-date pricing only after commercial accounting is enabled", async () => {
    mocks.commercialAccountingEnabled = true;
    const query = createPricingQuery({
      amount_centimos: 19_900,
      currency: "PEN",
      description: "Paquete estándar",
      policy_version: "commercial_v1",
      service_window_days: 90,
      included_services: ["Firma"],
      excluded_services: ["Gastos notariales"],
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const { getPacketPricing } = await import("@/lib/services/pricing-service");
    await expect(getPacketPricing()).resolves.toMatchObject({
      amountCentimos: 19_900,
      policyVersion: "commercial_v1",
      includedServices: ["Firma"],
    });

    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.lte).toHaveBeenCalledWith("effective_from", expect.any(String));
    expect(query.or).toHaveBeenCalledWith(
      expect.stringContaining("effective_to.is.null"),
    );
  });
});
