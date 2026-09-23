import { describe, expect, it } from "vitest";
import { classifyHost, normalizeHostname } from "@/lib/routing/surfaces";

describe("hostname normalization", () => {
  it.each([
    ["VERADOC.PE", "veradoc.pe"],
    ["app.veradoc.pe:443", "app.veradoc.pe"],
    ["notario.veradoc.pe.", "notario.veradoc.pe"],
    ["localhost:3000", "localhost"],
    ["[::1]:3000", "[::1]"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "bad host",
    "user@example.com",
    "example.com/path",
    "a,b",
  ])("rejects invalid host %j", (input) => {
    expect(normalizeHostname(input)).toBeNull();
  });
});

describe("surface classification", () => {
  it.each([
    ["veradoc.pe", "marketing"],
    ["www.veradoc.pe", "marketing"],
    ["app.veradoc.pe", "app"],
    ["notario.veradoc.pe", "notary"],
    ["admin.veradoc.pe", "admin"],
    ["demo.veradoc.pe", "demo"],
    ["localhost:3000", "local"],
    ["demo.localhost:3000", "demo"],
    ["app.localhost:3000", "app"],
  ])("classifies %s as %s", (host, expected) => {
    expect(classifyHost(host).surface).toBe(expected);
  });

  it("allows Vercel preview hosts only outside production", () => {
    expect(
      classifyHost("feature-veradoc.vercel.app", {
        vercelEnvironment: "preview",
      }).surface,
    ).toBe("preview");
    expect(
      classifyHost("feature-veradoc.vercel.app", {
        vercelEnvironment: "production",
      }).surface,
    ).toBe("unknown");
  });

  it("recognizes only the exact configured production deployment host", () => {
    const result = classifyHost("veradoc-prod.vercel.app", {
      vercelEnvironment: "production",
      vercelHostname: "veradoc-prod.vercel.app",
    });
    expect(result.surface).toBe("preview");
    expect(result.isProductionDeploymentHost).toBe(true);
  });

  it("routes the isolated demo deployment host to the demo surface", () => {
    const result = classifyHost("veradoc-demo.vercel.app", {
      vercelEnvironment: "production",
      vercelHostname: "veradoc-demo.vercel.app",
      isolatedDemoDeployment: true,
    });
    expect(result.surface).toBe("demo");
    expect(result.isProductionDeploymentHost).toBe(true);
    expect(classifyHost("other-demo.vercel.app", {
      vercelEnvironment: "production",
      vercelHostname: "veradoc-demo.vercel.app",
      isolatedDemoDeployment: true,
    }).surface).toBe("unknown");
  });
});
