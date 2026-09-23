import { describe, expect, it } from "vitest";
import { decideRoute } from "@/lib/routing/policy";

describe("hostname route policy", () => {
  it.each([
    ["marketing", "/precios", "GET", "allow", undefined],
    ["marketing", "/firma/t", "GET", "redirect", "app"],
    ["marketing", "/firma/t", "POST", "reject", undefined],
    ["app", "/agente", "GET", "allow", undefined],
    ["app", "/admin", "GET", "redirect", "admin"],
    ["notary", "/", "GET", "rewrite", "/notario"],
    ["notary", "/paquetes/p", "GET", "rewrite", "/notario/paquetes/p"],
    ["notary", "/notario/paquetes/p", "GET", "redirect", "notary"],
    ["admin", "/", "GET", "rewrite", "/admin"],
    ["demo", "/firma/t", "GET", "rewrite", "/demo/firma/t"],
    ["demo", "/firma/t", "POST", "reject", undefined],
    ["demo", "/api/demo/workspace", "POST", "allow", undefined],
    ["app", "/api/demo/workspace", "POST", "reject", undefined],
    ["unknown", "/", "GET", "reject", undefined],
  ] as const)(
    "%s %s %s returns %s",
    (surface, pathname, method, expectedKind, expectedValue) => {
      const decision = decideRoute({ surface, pathname, method });
      expect(decision.kind).toBe(expectedKind);
      if (decision.kind === "rewrite") {
        expect(decision.internalPath).toBe(expectedValue);
      }
      if (decision.kind === "redirect") {
        expect(decision.target.surface).toBe(expectedValue);
      }
    },
  );

  it("keeps legacy callback compatibility narrowly on the apex", () => {
    expect(
      decideRoute({
        surface: "marketing",
        pathname: "/auth/callback",
        method: "GET",
      }).kind,
    ).toBe("allow");
    expect(
      decideRoute({
        surface: "marketing",
        pathname: "/auth/login",
        method: "GET",
      }).kind,
    ).toBe("redirect");
  });

  it.each(["marketing", "app", "notary", "admin", "demo"] as const)(
    "rejects retired invitation routes on %s",
    (surface) => {
      for (const method of ["GET", "POST"] as const) {
        expect(
          decideRoute({ surface, pathname: "/auth/invite/obsolete", method }),
        ).toMatchObject({ kind: "reject", status: 404 });
      }
    },
  );

  it("never redirects a wrong-host mutation", () => {
    const decision = decideRoute({
      surface: "app",
      pathname: "/notario",
      method: "PATCH",
    });
    expect(decision).toMatchObject({ kind: "reject", status: 404 });
  });

  it("rejects token-bearing auth callbacks on the admin surface", () => {
    const decision = decideRoute({
      surface: "admin",
      pathname: "/auth/callback",
      method: "GET",
    });
    expect(decision).toMatchObject({ kind: "reject", status: 404 });
  });

  it("allows infrastructure only on apex and exact Vercel deployment hosts", () => {
    expect(
      decideRoute({
        surface: "marketing",
        pathname: "/api/webhooks/firmeasy",
        method: "POST",
      }).kind,
    ).toBe("allow");
    expect(
      decideRoute({
        surface: "app",
        pathname: "/api/webhooks/firmeasy",
        method: "POST",
      }).kind,
    ).toBe("reject");
    expect(
      decideRoute({
        surface: "preview",
        pathname: "/api/internal/notification-outbox/process",
        method: "GET",
        isProductionDeploymentHost: true,
      }).kind,
    ).toBe("allow");
  });
});
