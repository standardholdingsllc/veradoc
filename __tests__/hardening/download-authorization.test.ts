/**
 * Unit tests for the download authorization logic used by getDocumentDownloadUrl.
 *
 * All constants and the decision function are imported from the production
 * module at lib/domain/download-authorization.ts — the same module that the
 * server action imports at runtime. If production changes its allow-list,
 * guard order, or decision logic, these tests break.
 *
 * The tests cover every guard:
 *   - UUID format rejection
 *   - Document allow-list (DISTRIBUTABLE_TYPES)
 *   - Accepted-status enforcement
 *   - Physical artifact certification matching (notarial_scan + certification_report)
 *   - Non-artifact bypass
 */

import { describe, it, expect } from "vitest";
import {
  authorizeDownload,
  DISTRIBUTABLE_TYPES,
  PHYSICAL_ARTIFACT_TYPES,
  UUID_RE,
  type AuthzDocument,
  type AuthzPublishedCert,
} from "@/lib/domain/download-authorization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function doc(overrides: Partial<AuthzDocument> = {}): AuthzDocument {
  return {
    id: VALID_UUID,
    document_type: "signed_pdf",
    status: "accepted",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getDocumentDownloadUrl authorization logic", () => {
  // ── Constants match expected sets ──────────────────────────────────────

  describe("production constant integrity", () => {
    it("DISTRIBUTABLE_TYPES contains exactly the expected types", () => {
      expect([...DISTRIBUTABLE_TYPES].sort()).toEqual([
        "certification_report",
        "certified_lease",
        "evidence_report",
        "lease_original",
        "notarial_scan",
        "signed_pdf",
      ]);
    });

    it("PHYSICAL_ARTIFACT_TYPES is a strict subset of DISTRIBUTABLE_TYPES", () => {
      for (const t of PHYSICAL_ARTIFACT_TYPES) {
        expect(DISTRIBUTABLE_TYPES.has(t)).toBe(true);
      }
    });

    it("PHYSICAL_ARTIFACT_TYPES contains exactly the expected types", () => {
      expect([...PHYSICAL_ARTIFACT_TYPES].sort()).toEqual([
        "certification_report",
        "notarial_scan",
      ]);
    });

    it("UUID_RE accepts valid v4 UUIDs", () => {
      expect(UUID_RE.test("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
      expect(UUID_RE.test("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe(true);
    });

    it("UUID_RE rejects non-UUIDs", () => {
      expect(UUID_RE.test("not-a-uuid")).toBe(false);
      expect(UUID_RE.test("")).toBe(false);
      expect(UUID_RE.test("'; DROP TABLE --")).toBe(false);
    });
  });

  // ── UUID validation ────────────────────────────────────────────────────

  describe("UUID validation", () => {
    it("rejects non-UUID string", () => {
      const result = authorizeDownload("not-a-uuid", doc(), "certified", null);
      expect(result).toEqual({ allowed: false, reason: "invalid_uuid" });
    });

    it("rejects SQL injection attempt", () => {
      const result = authorizeDownload("'; DROP TABLE --", doc(), "certified", null);
      expect(result).toEqual({ allowed: false, reason: "invalid_uuid" });
    });

    it("rejects empty string", () => {
      const result = authorizeDownload("", doc(), "certified", null);
      expect(result).toEqual({ allowed: false, reason: "invalid_uuid" });
    });

    it("accepts valid UUID", () => {
      const result = authorizeDownload(VALID_UUID, doc(), "certified", null);
      expect(result).toEqual({ allowed: true });
    });

    it("accepts uppercase UUID", () => {
      const id = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
      const result = authorizeDownload(id, doc({ id }), "certified", null);
      expect(result).toEqual({ allowed: true });
    });
  });

  // ── Document existence ─────────────────────────────────────────────────

  describe("document existence", () => {
    it("returns not_found when doc is null", () => {
      const result = authorizeDownload(VALID_UUID, null, "certified", null);
      expect(result).toEqual({ allowed: false, reason: "not_found" });
    });
  });

  // ── Distributable type allow-list ──────────────────────────────────────

  describe("distributable type allow-list", () => {
    for (const type of DISTRIBUTABLE_TYPES) {
      it(`allows ${type}`, () => {
        let cert: AuthzPublishedCert | null = null;
        if (type === "notarial_scan") {
          cert = { notarial_scan_document_id: VALID_UUID, certification_report_document_id: null };
        } else if (type === "certification_report") {
          cert = { notarial_scan_document_id: null, certification_report_document_id: VALID_UUID };
        }
        const result = authorizeDownload(
          VALID_UUID, doc({ document_type: type }), "certified", cert,
        );
        expect(result).toEqual({ allowed: true });
      });
    }

    for (const type of ["identity_scan", "selfie", "internal_note", "random_type"]) {
      it(`rejects ${type}`, () => {
        const result = authorizeDownload(VALID_UUID, doc({ document_type: type }), "certified", null);
        expect(result).toEqual({ allowed: false, reason: "non_distributable" });
      });
    }
  });

  // ── Accepted-status enforcement ────────────────────────────────────────

  describe("accepted-status enforcement", () => {
    for (const status of ["superseded", "pending", "rejected", "uploading"]) {
      it(`rejects ${status} documents`, () => {
        const result = authorizeDownload(VALID_UUID, doc({ status }), "certified", null);
        expect(result).toEqual({ allowed: false, reason: "not_accepted" });
      });
    }

    it("allows accepted documents", () => {
      const result = authorizeDownload(VALID_UUID, doc({ status: "accepted" }), "certified", null);
      expect(result).toEqual({ allowed: true });
    });
  });

  // ── Physical artifact certification matching ───────────────────────────

  describe("physical artifact certification matching", () => {
    it("rejects notarial_scan when packet is not certified", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "notarial_scan" }),
        "awaiting_notary_seal", null,
      );
      expect(result).toEqual({ allowed: false, reason: "packet_not_certified" });
    });

    it("rejects certification_report when packet is not certified", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "certification_report" }),
        "under_review", null,
      );
      expect(result).toEqual({ allowed: false, reason: "packet_not_certified" });
    });

    it("rejects notarial_scan when no published certification exists", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "notarial_scan" }),
        "certified", null,
      );
      expect(result).toEqual({ allowed: false, reason: "no_published_cert" });
    });

    it("rejects notarial_scan whose ID does not match the published certification", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "notarial_scan" }),
        "certified",
        { notarial_scan_document_id: "different-id", certification_report_document_id: null },
      );
      expect(result).toEqual({ allowed: false, reason: "scan_not_matching_cert" });
    });

    it("rejects certification_report whose ID does not match the published certification", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "certification_report" }),
        "certified",
        { notarial_scan_document_id: null, certification_report_document_id: "different-id" },
      );
      expect(result).toEqual({ allowed: false, reason: "report_not_matching_cert" });
    });

    it("allows notarial_scan when cert matches", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "notarial_scan" }),
        "certified",
        { notarial_scan_document_id: VALID_UUID, certification_report_document_id: null },
      );
      expect(result).toEqual({ allowed: true });
    });

    it("allows certification_report when cert matches", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "certification_report" }),
        "certified",
        { notarial_scan_document_id: null, certification_report_document_id: VALID_UUID },
      );
      expect(result).toEqual({ allowed: true });
    });

    it("non-artifact types skip certification check even when uncertified", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "signed_pdf" }),
        "under_review", null,
      );
      expect(result).toEqual({ allowed: true });
    });
  });

  // ── Guard ordering ─────────────────────────────────────────────────────

  describe("guard ordering", () => {
    it("UUID check fires before document existence check", () => {
      const result = authorizeDownload("bad", null, "certified", null);
      expect(result).toEqual({ allowed: false, reason: "invalid_uuid" });
    });

    it("existence check fires before type check", () => {
      const result = authorizeDownload(VALID_UUID, null, "certified", null);
      expect(result).toEqual({ allowed: false, reason: "not_found" });
    });

    it("type check fires before status check", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "selfie", status: "superseded" }),
        "certified", null,
      );
      expect(result).toEqual({ allowed: false, reason: "non_distributable" });
    });

    it("status check fires before certification check", () => {
      const result = authorizeDownload(
        VALID_UUID, doc({ document_type: "notarial_scan", status: "superseded" }),
        "under_review", null,
      );
      expect(result).toEqual({ allowed: false, reason: "not_accepted" });
    });
  });
});
