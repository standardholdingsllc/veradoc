import { describe, expect, it } from "vitest";
import { MOCK_PACKETS, MOCK_REGISTRY, MOCK_USERS } from "@/lib/store/initial-data";
import { parseDemoSnapshot } from "@/lib/demo/validation";

function snapshot() {
  const packets = structuredClone(MOCK_PACKETS);
  let index = 0;
  for (const packet of packets) {
    for (const signer of packet.signers) {
      signer.email = index++ % 2 === 0
        ? "jonahllarson@gmail.com"
        : "Kimberlydayanara08@gmail.com";
      signer.whatsapp = `+5100000000${index % 10}`;
    }
  }
  return {
    users: structuredClone(MOCK_USERS),
    packets,
    registry: structuredClone(MOCK_REGISTRY),
    currentRole: "realtor" as const,
  };
}

describe("demo snapshot validation", () => {
  it("accepts only the approved founder email allowlist", () => {
    expect(parseDemoSnapshot(snapshot()).packets.length).toBeGreaterThan(0);
    const unsafe = snapshot();
    unsafe.packets[0].signers[0].email = "someone@example.com";
    expect(() => parseDemoSnapshot(unsafe)).toThrow("DEMO_EMAIL_NOT_ALLOWED");
  });

  it("rejects non-synthetic DNI values", () => {
    const unsafe = snapshot();
    unsafe.packets[0].signers[0].dni = "12345678";
    expect(() => parseDemoSnapshot(unsafe)).toThrow("DEMO_DNI_MUST_BE_SYNTHETIC");
  });
});
