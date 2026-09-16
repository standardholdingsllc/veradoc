import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ host: "app.veradoc.pe" })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/mfa", () => ({ hasRequiredAdminMfa: vi.fn() }));
vi.mock("@/lib/services/notifications", () => ({
  notifyRealtorSignupReceived: vi.fn(),
  notifyRealtorApproved: vi.fn(),
  notifyRealtorRejected: vi.fn(),
}));
vi.mock("@/lib/routing/surfaces", () => ({
  classifyHost: () => ({ surface: "app" }),
}));
vi.mock("@/lib/routing/targets", () => ({
  getPublicTargetForRole: () => ({ surface: "app", path: "/agente" }),
}));
vi.mock("@/lib/routing/origins", () => ({
  buildAbsoluteUrl: ({ surface, path }: { surface: string; path: string }) =>
    `https://${surface}.veradoc.pe${path}`,
}));

describe("suspended account login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: null,
          data: {
            user: {
              app_metadata: { role: "realtor", status: "suspended" },
            },
          },
        }),
        signOut: mocks.signOut.mockResolvedValue({ error: null }),
      },
    });
  });

  it("invalidates the new session and returns a visible-action error", async () => {
    const { login } = await import("@/lib/auth/actions");

    await expect(login("suspended@example.com", "valid-password")).resolves.toEqual({
      error:
        "Esta cuenta está suspendida. Comuníquese con soporte para solicitar una revisión.",
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
