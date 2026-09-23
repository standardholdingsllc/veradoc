import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { isAllowedDemoRequest } from "@/lib/demo/http";

describe("demo API request boundary", () => {
  it("accepts same-origin requests on the demo surface", () => {
    expect(
      isAllowedDemoRequest(
        new NextRequest("https://demo.veradoc.pe/api/demo/workspace", {
          method: "PUT",
          headers: { origin: "https://demo.veradoc.pe" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects cross-origin and wrong-surface requests", () => {
    expect(
      isAllowedDemoRequest(
        new NextRequest("https://demo.veradoc.pe/api/demo/workspace", {
          method: "PUT",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isAllowedDemoRequest(
        new NextRequest("https://app.veradoc.pe/api/demo/workspace", {
          method: "PUT",
          headers: { origin: "https://app.veradoc.pe" },
        }),
      ),
    ).toBe(false);
  });
});
