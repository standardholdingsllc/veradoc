import { beforeEach, describe, expect, it } from "vitest";
import { MOCK_PACKETS, MOCK_REGISTRY, MOCK_USERS } from "@/lib/store/initial-data";
import { useVeraDocStore } from "@/lib/store";
import {
  advanceDemoSeal,
  approveDemoEvidenceForSeal,
  recordDemoAuthorityCheck,
  startReview,
  toggleChecklistItem,
} from "@/lib/services/notary-service";

const packetId = "pkt-2024-002";

beforeEach(() => {
  useVeraDocStore.getState().replaceSnapshot({
    users: structuredClone(MOCK_USERS),
    packets: structuredClone(MOCK_PACKETS),
    registry: structuredClone(MOCK_REGISTRY),
    currentRole: "notary",
  });
});

describe("demo notary certification", () => {
  it("publishes only after evidence review, authority check, and all seal steps", () => {
    expect(() => approveDemoEvidenceForSeal(packetId)).toThrow();
    startReview(packetId);
    const checklist = useVeraDocStore.getState().getPacketById(packetId)!.notaryReview!.reviewChecklist;
    for (const item of checklist) toggleChecklistItem(packetId, item.itemKey);
    expect(() => approveDemoEvidenceForSeal(packetId)).toThrow("autoridad");
    recordDemoAuthorityCheck(packetId, {
      titleNumber: "DEMO-123", ownerNames: "Persona de ejemplo", result: "verified", notes: "Consulta simulada",
    });
    approveDemoEvidenceForSeal(packetId);
    expect(useVeraDocStore.getState().getPacketById(packetId)!.status).toBe("awaiting_notary_seal");
    expect(() => advanceDemoSeal(packetId, "publish")).toThrow("paso anterior");
    advanceDemoSeal(packetId, "prepare_document");
    const scan = {
      fileName: "escaneo-notarial-demo.pdf",
      fileSizeBytes: 2048,
      pageCount: 3,
      sha256: "a".repeat(64),
      additionalCertificationPages: 0,
    };
    expect(() => advanceDemoSeal(packetId, "attest")).toThrow("paso anterior");
    advanceDemoSeal(packetId, "upload_scan", scan);
    advanceDemoSeal(packetId, "attest");
    advanceDemoSeal(packetId, "prepare_report");
    advanceDemoSeal(packetId, "publish");
    const published = useVeraDocStore.getState().getPacketById(packetId)!;
    expect(published.status).toBe("certified");
    expect(published.certifiedDocument?.fileName).toContain("certificado-demo");
    expect(published.demoSealWorkflow?.publishedAt).toBeTruthy();
    expect(published.demoSealWorkflow?.notarialScan?.sha256).toBe(scan.sha256);
    expect(published.documentHashes.some((entry) => entry.stage === "notarial_scan" && entry.hash === scan.sha256)).toBe(true);
    expect(useVeraDocStore.getState().registry.some((entry) => entry.packetId === packetId)).toBe(true);
  });

  it("keeps a missing property authority result out of certification", () => {
    startReview(packetId);
    for (const item of useVeraDocStore.getState().getPacketById(packetId)!.notaryReview!.reviewChecklist) {
      toggleChecklistItem(packetId, item.itemKey);
    }
    recordDemoAuthorityCheck(packetId, {
      titleNumber: "DEMO-404", ownerNames: "Persona de ejemplo", result: "not_found", notes: "Sin coincidencia",
    });
    expect(() => approveDemoEvidenceForSeal(packetId)).toThrow("no fue encontrada");
    expect(useVeraDocStore.getState().getPacketById(packetId)!.status).toBe("under_notary_review");
  });
});
