import { describe, expect, it } from "vitest";

import { getAdminTabs } from "@/components/admin/admin-tab-definitions";

describe("admin tab definitions", () => {
  it("hides every commercial-accounting tab while the schema gate is off", () => {
    expect(getAdminTabs(false).map((tab) => tab.id)).toEqual([
      "overview",
      "realtors",
      "invitations",
      "coverage",
      "users",
    ]);
  });

  it("shows commercial-accounting tabs only when explicitly enabled", () => {
    expect(getAdminTabs(true).map((tab) => tab.id)).toEqual([
      "overview",
      "realtors",
      "invitations",
      "coverage",
      "payouts",
      "finance",
      "refunds",
      "users",
    ]);
  });
});
