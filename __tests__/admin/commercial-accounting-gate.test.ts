import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createRefund: vi.fn(),
  getPayment: vi.fn(),
  hasRequiredAdminMfa: vi.fn(),
  recordPaymentResult: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/auth/mfa", () => ({
  hasRequiredAdminMfa: mocks.hasRequiredAdminMfa,
  requireAdminMfa: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  isCommercialAccountingEnabled: () => false,
}));
vi.mock("@/lib/routing/origins", () => ({
  buildNotaryInvitationCallbackUrl: vi.fn(),
}));
vi.mock("@/lib/services/commercial-service", () => ({
  hashPrivatePromoCode: vi.fn(),
  promoCodeHint: vi.fn(),
}));
vi.mock("@/lib/services/mercadopago/service", () => ({
  createRefund: mocks.createRefund,
  getPayment: mocks.getPayment,
  MercadoPagoAPIError: class MercadoPagoAPIError extends Error {},
}));
vi.mock("@/lib/services/mercadopago/transition", () => ({
  recordPaymentResult: mocks.recordPaymentResult,
}));

const adminUserId = "00000000-0000-4000-8000-000000000001";
const resourceId = "00000000-0000-4000-8000-000000000002";

function createProfileQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({
    data: { role: "admin", status: "active" },
  });
  return query;
}

describe("commercial accounting feature gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const profileQuery = createProfileQuery();
    const adminClient = {
      from: vi.fn(() => profileQuery),
      rpc: vi.fn(),
    };
    const sessionClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: adminUserId } },
        }),
      },
      rpc: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue(adminClient);
    mocks.createClient.mockResolvedValue(sessionClient);
    mocks.hasRequiredAdminMfa.mockResolvedValue(true);
  });

  it("skips payout and finance schema queries while disabled", async () => {
    const { getCommercialFinanceData, getNotaryPayoutAdminData } =
      await import("@/lib/admin/queries");

    await expect(getNotaryPayoutAdminData()).resolves.toEqual({
      rates: [],
      payouts: [],
    });
    await expect(getCommercialFinanceData()).resolves.toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects every payout and finance action before an RPC is called", async () => {
    const actions = await import("@/lib/admin/actions");
    const calls = [
      () => actions.setNotaryContractedRate(resourceId, 40, "2026-09-01"),
      () => actions.confirmNotaryMonthlyPayout(resourceId, "2026-08"),
      () => actions.approveNotaryMonthlyPayout(resourceId, "invoice-test", 0),
      () => actions.markNotaryPayoutPaid(resourceId, "payment-test"),
      () =>
        actions.createPrivatePromoCodeAction({
          code: "TEST",
          description: "Synthetic test",
          discountPen: 10,
          validUntil: "2026-12-31",
          maxRedemptions: 1,
        }),
      () =>
        actions.recordPacketDirectCostAction({
          packetId: resourceId,
          category: "signing",
          provider: "test",
          amountPen: 1,
          costStatus: "actual" as const,
          evidenceReference: "synthetic evidence",
          sourceId: "synthetic-source",
        }),
      () =>
        actions.setPacketArchivalHoldAction({
          packetId: resourceId,
          holdUntil: "2026-12-31",
          reason: "Synthetic hold",
        }),
    ];

    for (const call of calls) {
      await expect(call()).resolves.toEqual({
        error: "Las funciones de contabilidad comercial no están habilitadas.",
      });
    }

    const sessionClient = await mocks.createClient.mock.results[0].value;
    expect(sessionClient.rpc).not.toHaveBeenCalled();
  });

  it("rejects refund and reconciliation actions before provider access", async () => {
    const { reconcilePaymentAction, refundPaymentAction } = await import(
      "@/lib/actions/admin-payment-actions"
    );

    await expect(
      refundPaymentAction({
        paymentId: resourceId,
        requestId: "00000000-0000-4000-8000-000000000003",
        amountCentimos: 100,
        reasonCode: "01",
        reasonDescription: "Synthetic test refund",
        policyReason: "veradoc_failure",
        approvalEvidence: "Synthetic approval evidence",
      }),
    ).resolves.toEqual({
      error: "Las funciones de contabilidad comercial no están habilitadas.",
    });
    await expect(reconcilePaymentAction(resourceId)).resolves.toEqual({
      error: "Las funciones de contabilidad comercial no están habilitadas.",
    });

    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.getPayment).not.toHaveBeenCalled();
    expect(mocks.recordPaymentResult).not.toHaveBeenCalled();
  });
});
