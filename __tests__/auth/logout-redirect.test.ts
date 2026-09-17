import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({ logout: mocks.logout }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("logoutAndRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logout.mockResolvedValue({ redirect: "/auth/login" });
  });

  it("signs out through the shared action and redirects on the same host", async () => {
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const { logoutAndRedirect } = await import("@/lib/auth/logout-actions");

    await expect(logoutAndRedirect()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
  });
});
