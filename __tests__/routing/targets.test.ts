import { describe, expect, it } from "vitest";
import { getPublicTargetForRole } from "@/lib/routing/targets";

describe("role targets", () => {
  it.each([
    ["admin", "admin", "/"],
    ["notary", "notary", "/"],
    ["realtor", "app", "/agente"],
    ["landlord", "app", "/arrendador"],
    ["renter", "app", "/arrendatario"],
  ] as const)("maps %s to %s%s", (role, surface, path) => {
    expect(getPublicTargetForRole(role)).toEqual({ surface, path });
  });
});
