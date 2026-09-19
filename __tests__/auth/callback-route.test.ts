import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    PUBLIC_ORIGIN: "https://veradoc.pe",
    APP_ORIGIN: "https://app.veradoc.pe",
    NOTARY_ORIGIN: "https://notario.veradoc.pe",
    ADMIN_ORIGIN: "https://admin.veradoc.pe",
    DEMO_ORIGIN: "https://demo.veradoc.pe",
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.createClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
        getUser: mocks.getUser,
      },
    });
  });

  it("rejects obsolete invitation callbacks before session exchange", async () => {
    const response = await GET(
      new Request(
        "https://notario.veradoc.pe/auth/callback?code=secret&invitation=obsolete",
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("preserves ordinary callback exchange and safe next handling", async () => {
    const response = await GET(
      new Request("https://app.veradoc.pe/auth/callback?code=secret&next=/agente"),
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("secret");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.veradoc.pe/agente",
    );
  });
});
