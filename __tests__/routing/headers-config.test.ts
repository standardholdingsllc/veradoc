import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const expectedOrigins = new Map([
  ["veradoc.pe", "https://veradoc.pe"],
  ["www.veradoc.pe", "https://www.veradoc.pe"],
  ["app.veradoc.pe", "https://app.veradoc.pe"],
  ["notario.veradoc.pe", "https://notario.veradoc.pe"],
  ["admin.veradoc.pe", "https://admin.veradoc.pe"],
  ["demo.veradoc.pe", "https://demo.veradoc.pe"],
]);

describe("production surface response headers", () => {
  it("overrides Vercel's static wildcard ACAO with the matching same-origin value", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();

    expect(rules).toHaveLength(expectedOrigins.size);
    for (const rule of rules) {
      const host = rule.has?.find((condition) => condition.type === "host")?.value;
      const acao = rule.headers.find(
        (header) => header.key.toLowerCase() === "access-control-allow-origin",
      )?.value;

      expect(host).toBeTruthy();
      expect(acao).toBe(expectedOrigins.get(host!));
      expect(acao).not.toBe("*");
    }
  });
});
