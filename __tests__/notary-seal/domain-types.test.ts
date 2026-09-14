import { describe, it, expect } from "vitest";
import { PACKET_STATUS_CONFIG } from "@/lib/domain/constants";
import { canTransition, transition } from "@/lib/domain/packet-machine";
import { dbStatusToDisplay, displayStatusToDb } from "@/lib/domain/status-mapping";
import { domainPacketStatusToDb, dbPacketStatusToDomain } from "@/lib/adapters/status-maps";

describe("PacketStatus includes awaiting_notary_seal", () => {
  it("has a config entry in PACKET_STATUS_CONFIG", () => {
    expect(PACKET_STATUS_CONFIG).toHaveProperty("awaiting_notary_seal");
    expect(PACKET_STATUS_CONFIG.awaiting_notary_seal.label).toBe("Pendiente de sello notarial");
  });

  it("maps DB status to display status", () => {
    expect(dbStatusToDisplay("awaiting_notary_seal")).toBe("awaiting_notary_seal");
  });

  it("maps domain status to DB", () => {
    expect(domainPacketStatusToDb("awaiting_notary_seal")).toBe("awaiting_notary_seal");
  });

  it("maps DB status from adapter", () => {
    const domain = dbPacketStatusToDomain("awaiting_notary_seal", {});
    expect(domain).toBe("awaiting_notary_seal");
  });
});

describe("Physical-seal state transitions", () => {
  it("under_notary_review -> awaiting_notary_seal via approve_evidence_for_seal", () => {
    expect(
      canTransition("under_notary_review", {
        type: "approve_evidence_for_seal",
        actor: "notary",
      }),
    ).toBe(true);

    expect(
      transition("under_notary_review", {
        type: "approve_evidence_for_seal",
        actor: "notary",
      }),
    ).toBe("awaiting_notary_seal");
  });

  it("awaiting_notary_seal -> certified via finalize_certification", () => {
    expect(
      canTransition("awaiting_notary_seal", {
        type: "finalize_certification",
        actor: "notary",
      }),
    ).toBe(true);

    expect(
      transition("awaiting_notary_seal", {
        type: "finalize_certification",
        actor: "notary",
      }),
    ).toBe("certified");
  });

  it("awaiting_notary_seal -> needs_correction via return_for_correction", () => {
    expect(
      canTransition("awaiting_notary_seal", {
        type: "return_for_correction",
        actor: "notary",
      }),
    ).toBe(true);

    expect(
      transition("awaiting_notary_seal", {
        type: "return_for_correction",
        actor: "notary",
      }),
    ).toBe("needs_correction");
  });

  it("awaiting_notary_seal -> rejected via reject", () => {
    expect(
      canTransition("awaiting_notary_seal", {
        type: "reject",
        actor: "notary",
      }),
    ).toBe(true);
  });

  it("legacy certify from under_review still works", () => {
    expect(
      canTransition("under_notary_review", {
        type: "certify",
        actor: "notary",
      }),
    ).toBe(true);
  });

  it("non-notary cannot approve evidence for seal", () => {
    expect(
      canTransition("under_notary_review", {
        type: "approve_evidence_for_seal",
        actor: "realtor",
      }),
    ).toBe(false);
  });
});
