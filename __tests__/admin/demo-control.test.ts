import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMfa, writeAdminDemoControl, revalidatePath } = vi.hoisted(() => ({
  requireAdminMfa: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })),
  writeAdminDemoControl: vi.fn(async (enabled: boolean, actorId: string) => ({
    enabled,
    updatedAt: "2026-09-21T00:00:00.000Z",
    updatedBy: actorId,
  })),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/mfa", () => ({ requireAdminMfa }));
vi.mock("@/lib/demo/admin-control", () => ({ writeAdminDemoControl }));

import { setDemoAvailability } from "@/lib/admin/demo-actions";

describe("admin demo kill switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the MFA-gated admin identity and audits that actor remotely", async () => {
    const result = await setDemoAvailability(false);
    expect(requireAdminMfa).toHaveBeenCalledOnce();
    expect(writeAdminDemoControl).toHaveBeenCalledWith(
      false,
      "11111111-1111-4111-8111-111111111111",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(result.enabled).toBe(false);
  });
});
