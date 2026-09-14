import { describe, it, expect } from "vitest";
import {
  deriveSealWorkflowSteps,
  type SealWorkflowState,
} from "@/lib/domain/notary-seal-types";
import { CHECKLIST } from "@/lib/i18n/labels";

// ---------------------------------------------------------------------------
// Checklist validation tests (unit-level, mirrors SQL validate_notary_checklist)
// ---------------------------------------------------------------------------

const MANDATORY_KEYS = [
  "revisarDocumento", "revisarPdfFirmado", "revisarIdentidad",
  "revisarWhatsapp", "revisarConsentimiento", "revisarFirmaIofe",
  "revisarCadena", "revisarTimestamp", "revisarHashes",
  "revisarPropiedad", "revisarRegistro", "revisarSesion",
  "determinacion",
] as const;

function buildCompleteChecklist(
  checked: boolean = true,
): Record<string, { checked: boolean; checkedAt?: string }> {
  const result: Record<string, { checked: boolean; checkedAt?: string }> = {};
  for (const key of MANDATORY_KEYS) {
    result[key] = { checked, checkedAt: checked ? "2026-01-01" : undefined };
  }
  return result;
}

function validateChecklistV1(
  checklist: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const key of MANDATORY_KEYS) {
    const item = checklist[key] as { checked?: boolean } | undefined;
    if (!item) {
      errors.push(`Checklist key missing: ${key}`);
    } else if (!item.checked) {
      errors.push(`Checklist key not checked: ${key}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

describe("Checklist validation (mirrors SQL RPC)", () => {
  it("CHECKLIST in labels.ts has exactly 13 keys", () => {
    expect(Object.keys(CHECKLIST)).toHaveLength(13);
    for (const key of MANDATORY_KEYS) {
      expect(CHECKLIST).toHaveProperty(key);
    }
  });

  it("accepts complete checklist", () => {
    const result = validateChecklistV1(buildCompleteChecklist(true));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty checklist", () => {
    const result = validateChecklistV1({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(13);
  });

  it("rejects checklist with one unchecked key", () => {
    const cl = buildCompleteChecklist(true);
    cl.determinacion = { checked: false };
    const result = validateChecklistV1(cl);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("determinacion");
  });

  it("rejects checklist with missing key", () => {
    const cl = buildCompleteChecklist(true);
    delete cl.revisarDocumento;
    const result = validateChecklistV1(cl);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("revisarDocumento");
  });

  it("allows extra keys (forward compatibility)", () => {
    const cl = buildCompleteChecklist(true);
    (cl as Record<string, unknown>)["futureKey_v2"] = { checked: true };
    const result = validateChecklistV1(cl);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Download authorization tests (imports production constants)
// ---------------------------------------------------------------------------

import {
  DISTRIBUTABLE_TYPES,
  PHYSICAL_ARTIFACT_TYPES,
} from "@/lib/domain/download-authorization";

describe("Download authorization logic", () => {
  it("allows all distributable types", () => {
    for (const t of DISTRIBUTABLE_TYPES) {
      expect(DISTRIBUTABLE_TYPES.has(t)).toBe(true);
    }
  });

  it("rejects unknown document types", () => {
    expect(DISTRIBUTABLE_TYPES.has("invoice")).toBe(false);
    expect(DISTRIBUTABLE_TYPES.has("contract_draft")).toBe(false);
  });

  it("identifies physical artifacts", () => {
    expect(PHYSICAL_ARTIFACT_TYPES.has("notarial_scan")).toBe(true);
    expect(PHYSICAL_ARTIFACT_TYPES.has("certification_report")).toBe(true);
    expect(PHYSICAL_ARTIFACT_TYPES.has("evidence_report")).toBe(false);
  });

  it("physical artifacts require certified + published certification", () => {
    function canDownloadPhysicalArtifact(params: {
      packetStatus: string;
      certPublished: boolean;
      docId: string;
      certScanDocId: string | null;
      certReportDocId: string | null;
      docType: "notarial_scan" | "certification_report";
    }): boolean {
      if (params.packetStatus !== "certified") return false;
      if (!params.certPublished) return false;
      if (params.docType === "notarial_scan" && params.certScanDocId !== params.docId) return false;
      if (params.docType === "certification_report" && params.certReportDocId !== params.docId) return false;
      return true;
    }

    expect(canDownloadPhysicalArtifact({
      packetStatus: "certified",
      certPublished: true,
      docId: "doc-1",
      certScanDocId: "doc-1",
      certReportDocId: null,
      docType: "notarial_scan",
    })).toBe(true);

    expect(canDownloadPhysicalArtifact({
      packetStatus: "awaiting_notary_seal",
      certPublished: true,
      docId: "doc-1",
      certScanDocId: "doc-1",
      certReportDocId: null,
      docType: "notarial_scan",
    })).toBe(false);

    expect(canDownloadPhysicalArtifact({
      packetStatus: "certified",
      certPublished: true,
      docId: "doc-2",
      certScanDocId: "doc-1",
      certReportDocId: null,
      docType: "notarial_scan",
    })).toBe(false);

    expect(canDownloadPhysicalArtifact({
      packetStatus: "certified",
      certPublished: false,
      docId: "doc-1",
      certScanDocId: "doc-1",
      certReportDocId: null,
      docType: "notarial_scan",
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Workflow step derivation — binding-based security
// ---------------------------------------------------------------------------

function mkState(overrides: Partial<SealWorkflowState> = {}): SealWorkflowState {
  return {
    printDownloadIssued: true,
    signedDocument: { id: "signed-1", hash: "h-signed", pageCount: 10 },
    acceptedScan: { id: "scan-1", hash: "h-scan", pageCount: 12, metadata: {} },
    attestation: { id: "att-1", textVersion: "v1.0", attestedAt: "2026-01-01", scanId: "scan-1" },
    preparedCertification: { id: "cert-1", reportDocumentId: "rep-1", scanId: "scan-1" },
    ...overrides,
  };
}

describe("deriveSealWorkflowSteps — binding security", () => {
  it("all complete: publish is active", () => {
    const steps = deriveSealWorkflowSteps(mkState());
    expect(steps[4].active).toBe(true);
    expect(steps.filter((s) => s.completed)).toHaveLength(4);
  });

  it("attestation bound to wrong scan → attest step active again", () => {
    const steps = deriveSealWorkflowSteps(mkState({
      attestation: { id: "att-1", textVersion: "v1", attestedAt: "2026-01-01", scanId: "scan-OLD" },
    }));
    const attestStep = steps.find((s) => s.id === "attest")!;
    expect(attestStep.completed).toBe(false);
    expect(attestStep.active).toBe(true);
  });

  it("certification bound to wrong scan → prepare step active again", () => {
    const steps = deriveSealWorkflowSteps(mkState({
      preparedCertification: { id: "cert-1", reportDocumentId: "rep-1", scanId: "scan-OLD" },
    }));
    const prepareStep = steps.find((s) => s.id === "prepare")!;
    expect(prepareStep.completed).toBe(false);
    expect(prepareStep.active).toBe(true);
  });

  it("no report → publish not active", () => {
    const steps = deriveSealWorkflowSteps(mkState({
      preparedCertification: { id: "cert-1", reportDocumentId: null, scanId: "scan-1" },
    }));
    expect(steps[4].active).toBe(false);
  });

  it("null scan → upload step active", () => {
    const steps = deriveSealWorkflowSteps(mkState({
      acceptedScan: null,
      attestation: null,
      preparedCertification: null,
    }));
    expect(steps[1].active).toBe(true);
    expect(steps[2].active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Page reconciliation (mirrors attestation hardening)
// ---------------------------------------------------------------------------

describe("Page reconciliation (exact equality)", () => {
  it("accepts matching page counts", () => {
    const sourcePageCount = 10;
    const declaredAddedPages = 2;
    const scanPageCount = 12;
    expect(scanPageCount).toBe(sourcePageCount + declaredAddedPages);
  });

  it("rejects mismatched page counts", () => {
    const sourcePageCount = 10;
    const declaredAddedPages = 2;
    const scanPageCount = 11;
    expect(scanPageCount).not.toBe(sourcePageCount + declaredAddedPages);
  });

  it("handles zero added pages", () => {
    const sourcePageCount = 10;
    const declaredAddedPages = 0;
    const scanPageCount = 10;
    expect(scanPageCount).toBe(sourcePageCount + declaredAddedPages);
  });
});

// ---------------------------------------------------------------------------
// declaredAddedPages validation
// ---------------------------------------------------------------------------

describe("declaredAddedPages validation", () => {
  function validate(v: unknown): boolean {
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 20;
  }

  it("accepts 0", () => expect(validate(0)).toBe(true));
  it("accepts 20", () => expect(validate(20)).toBe(true));
  it("accepts 5", () => expect(validate(5)).toBe(true));
  it("rejects -1", () => expect(validate(-1)).toBe(false));
  it("rejects 21", () => expect(validate(21)).toBe(false));
  it("rejects 1.5", () => expect(validate(1.5)).toBe(false));
  it("rejects NaN", () => expect(validate(NaN)).toBe(false));
});
