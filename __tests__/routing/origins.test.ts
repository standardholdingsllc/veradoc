import { describe, expect, it } from "vitest";
import {
  buildAbsoluteUrlFromOrigins,
  parseOriginMap,
} from "@/lib/routing/origin-config";

const values = {
  marketing: "https://veradoc.pe/",
  app: "https://app.veradoc.pe",
  notary: "https://notario.veradoc.pe",
  admin: "https://admin.veradoc.pe",
  demo: "https://demo.veradoc.pe",
} as const;

describe("origin configuration", () => {
  it("normalizes root trailing slashes", () => {
    expect(parseOriginMap(values, { requireHttps: true }).marketing).toBe(
      "https://veradoc.pe",
    );
  });

  it.each([
    "https://user:pass@app.veradoc.pe",
    "https://app.veradoc.pe/path",
    "https://app.veradoc.pe?x=1",
    "https://app.veradoc.pe#fragment",
  ])("rejects a non-origin value %s", (app) => {
    expect(() =>
      parseOriginMap({ ...values, app }, { requireHttps: true }),
    ).toThrow();
  });

  it("requires HTTPS for production origins", () => {
    expect(() =>
      parseOriginMap(
        { ...values, app: "http://app.veradoc.pe" },
        { requireHttps: true },
      ),
    ).toThrow(/HTTPS/);
  });

  it("builds a typed URL and encodes explicit query values", () => {
    const origins = parseOriginMap(values, { requireHttps: true });
    expect(
      buildAbsoluteUrlFromOrigins(
        origins,
        { surface: "notary", path: "/paquetes/abc" },
        { invitation: "a+b c" },
      ),
    ).toBe("https://notario.veradoc.pe/paquetes/abc?invitation=a%2Bb+c");
  });

  it("rejects scheme-relative paths", () => {
    const origins = parseOriginMap(values, { requireHttps: true });
    expect(() =>
      buildAbsoluteUrlFromOrigins(origins, {
        surface: "app",
        path: "//evil.example",
      }),
    ).toThrow(/exactly one slash/);
  });
});
