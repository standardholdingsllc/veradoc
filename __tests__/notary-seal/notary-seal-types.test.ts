import { describe, it, expect } from "vitest";
import {
  ATTESTATION_TEXT_VERSION,
  ATTESTATION_TEXT_ES,
  deriveSealWorkflowSteps,
  type SealWorkflowState,
} from "@/lib/domain/notary-seal-types";
import { computeSha256 } from "@/lib/utils/document-hash";

describe("Attestation text", () => {
  it("has a version identifier", () => {
    expect(ATTESTATION_TEXT_VERSION).toMatch(/^v\d+/);
  });

  it("contains key legal statements in Spanish", () => {
    expect(ATTESTATION_TEXT_ES).toContain("certificación notarial");
    expect(ATTESTATION_TEXT_ES).toContain("sello");
    expect(ATTESTATION_TEXT_ES).toContain("firma física");
  });

  it("produces a deterministic hash", () => {
    const hash1 = computeSha256(Buffer.from(ATTESTATION_TEXT_ES, "utf-8"));
    const hash2 = computeSha256(Buffer.from(ATTESTATION_TEXT_ES, "utf-8"));
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});

function baseState(overrides: Partial<SealWorkflowState> = {}): SealWorkflowState {
  return {
    printDownloadIssued: false,
    signedDocument: null,
    acceptedScan: null,
    attestation: null,
    preparedCertification: null,
    ...overrides,
  };
}

describe("deriveSealWorkflowSteps", () => {
  it("starts with download as active when nothing done", () => {
    const steps = deriveSealWorkflowSteps(baseState());
    expect(steps[0].id).toBe("download");
    expect(steps[0].active).toBe(true);
    expect(steps[0].completed).toBe(false);
    expect(steps[1].active).toBe(false);
  });

  it("activates upload after download", () => {
    const steps = deriveSealWorkflowSteps(baseState({
      printDownloadIssued: true,
    }));
    expect(steps[0].completed).toBe(true);
    expect(steps[1].id).toBe("upload");
    expect(steps[1].active).toBe(true);
  });

  it("activates attest after upload", () => {
    const steps = deriveSealWorkflowSteps(baseState({
      printDownloadIssued: true,
      acceptedScan: { id: "scan-1", hash: "h1", pageCount: 5, metadata: {} },
    }));
    expect(steps[2].id).toBe("attest");
    expect(steps[2].active).toBe(true);
  });

  it("activates prepare after attestation bound to current scan", () => {
    const steps = deriveSealWorkflowSteps(baseState({
      printDownloadIssued: true,
      acceptedScan: { id: "scan-1", hash: "h1", pageCount: 5, metadata: {} },
      attestation: { id: "att-1", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-1" },
    }));
    expect(steps[3].id).toBe("prepare");
    expect(steps[3].active).toBe(true);
  });

  it("activates publish after preparation and report", () => {
    const steps = deriveSealWorkflowSteps(baseState({
      printDownloadIssued: true,
      acceptedScan: { id: "scan-1", hash: "h1", pageCount: 5, metadata: {} },
      attestation: { id: "att-1", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-1" },
      preparedCertification: { id: "cert-1", reportDocumentId: "rep-1", scanId: "scan-1" },
    }));
    expect(steps[4].id).toBe("publish");
    expect(steps[4].active).toBe(true);
  });

  describe("scan-replacement invalidation", () => {
    it("invalidates attestation when scan changes", () => {
      const steps = deriveSealWorkflowSteps(baseState({
        printDownloadIssued: true,
        acceptedScan: { id: "scan-2", hash: "h2", pageCount: 5, metadata: {} },
        attestation: { id: "att-1", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-1" },
      }));
      expect(steps[2].id).toBe("attest");
      expect(steps[2].completed).toBe(false);
      expect(steps[2].active).toBe(true);
    });

    it("invalidates preparation when scan changes", () => {
      const steps = deriveSealWorkflowSteps(baseState({
        printDownloadIssued: true,
        acceptedScan: { id: "scan-2", hash: "h2", pageCount: 5, metadata: {} },
        attestation: { id: "att-2", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-2" },
        preparedCertification: { id: "cert-1", reportDocumentId: "rep-1", scanId: "scan-1" },
      }));
      expect(steps[3].id).toBe("prepare");
      expect(steps[3].completed).toBe(false);
      expect(steps[3].active).toBe(true);
    });

    it("does not activate publish when preparation lacks report", () => {
      const steps = deriveSealWorkflowSteps(baseState({
        printDownloadIssued: true,
        acceptedScan: { id: "scan-1", hash: "h1", pageCount: 5, metadata: {} },
        attestation: { id: "att-1", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-1" },
        preparedCertification: { id: "cert-1", reportDocumentId: null, scanId: "scan-1" },
      }));
      expect(steps[4].active).toBe(false);
    });
  });
});
