import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
} from "next/experimental/testing/server";
import { unstable_doesMiddlewareMatch } from "next/dist/experimental/testing/server/middleware-testing-utils";

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

let mockUser: { app_metadata: Record<string, string> } | null = null;

vi.mock("@/lib/supabase/proxy", () => ({
  createProxyClient: (_request: NextRequest, response: NextResponse) => ({
    auth: {
      getUser: async () => {
        response.cookies.set("sb-refresh", "refreshed", {
          path: "/",
          httpOnly: true,
        });
        return { data: { user: mockUser } };
      },
      signOut: async () => ({ error: null }),
    },
  }),
}));

import proxy, { config } from "@/proxy";

describe("Proxy hostname routing", () => {
  beforeEach(() => {
    mockUser = null;
    vi.stubEnv("HOST_ROUTING_MODE", "enforce");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches application pages and excludes framework assets", () => {
    // Next 16.2.6 documents unstable_doesProxyMatch, but the installed package
    // still exports the equivalent utility under its pre-rename symbol.
    expect(unstable_doesMiddlewareMatch({ config, url: "/agente" })).toBe(true);
    expect(
      unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunk.js" }),
    ).toBe(false);
    expect(
      unstable_doesMiddlewareMatch({ config, url: "/brand/logo.svg" }),
    ).toBe(false);
  });

  it("serves marketing pages on the apex", async () => {
    const response = await proxy(new NextRequest("https://veradoc.pe/precios"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("temporarily redirects legacy signing GETs and preserves queries", async () => {
    const response = await proxy(
      new NextRequest("https://veradoc.pe/firma/t?source=old"),
    );
    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      "https://app.veradoc.pe/firma/t?source=old",
    );
  });

  it("rejects legacy signing POSTs instead of replaying them cross-host", async () => {
    const response = await proxy(
      new NextRequest("https://veradoc.pe/firma/t", { method: "POST" }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("rewrites authenticated clean notary paths and marks them noindex", async () => {
    mockUser = { app_metadata: { role: "notary", status: "active" } };
    const response = await proxy(
      new NextRequest("https://notario.veradoc.pe/paquetes/p"),
    );
    expect(isRewrite(response)).toBe(true);
    expect(getRewrittenUrl(response)).toBe(
      "https://notario.veradoc.pe/notario/paquetes/p",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("rewrites authenticated admin root and preserves refreshed cookies", async () => {
    mockUser = { app_metadata: { role: "admin", status: "active" } };
    const response = await proxy(new NextRequest("https://admin.veradoc.pe/"));
    expect(getRewrittenUrl(response)).toBe("https://admin.veradoc.pe/admin");
    expect(response.headers.get("set-cookie")).toContain(
      "sb-refresh=refreshed",
    );
  });

  it("rejects auth callbacks on the admin hostname", async () => {
    const response = await proxy(
      new NextRequest("https://admin.veradoc.pe/auth/callback?code=secret"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("rewrites demo signing routes only into the demo tree", async () => {
    const response = await proxy(
      new NextRequest("https://demo.veradoc.pe/firma/t"),
    );
    expect(getRewrittenUrl(response)).toBe(
      "https://demo.veradoc.pe/demo/firma/t",
    );
  });

  it("rejects demo Server Action posts", async () => {
    const response = await proxy(
      new NextRequest("https://demo.veradoc.pe/agente", {
        method: "POST",
        headers: { "next-action": "forged" },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("fails closed for unknown production hosts", async () => {
    const response = await proxy(new NextRequest("https://evil.example/"));
    expect(response.status).toBe(404);
  });

  it("preserves refreshed cookies on anonymous auth redirects", async () => {
    const response = await proxy(
      new NextRequest("https://app.veradoc.pe/agente"),
    );
    expect(getRedirectUrl(response)).toBe(
      "https://app.veradoc.pe/auth/login?next=%2Fagente",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "sb-refresh=refreshed",
    );
  });
});
