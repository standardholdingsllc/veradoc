/**
 * Pure authorization logic for document downloads.
 *
 * Imported by the getDocumentDownloadUrl server action and by unit tests.
 * No server-only dependencies — safe to import from any context.
 */

export const DISTRIBUTABLE_TYPES = new Set([
  "lease_original",
  "signed_pdf",
  "evidence_report",
  "certified_lease",
  "notarial_scan",
  "certification_report",
]);

export const PHYSICAL_ARTIFACT_TYPES = new Set([
  "notarial_scan",
  "certification_report",
]);

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthzDocument {
  id: string;
  document_type: string;
  status: string;
}

export interface AuthzPublishedCert {
  notarial_scan_document_id: string | null;
  certification_report_document_id: string | null;
}

export type AuthzDenial =
  | "invalid_uuid"
  | "not_found"
  | "non_distributable"
  | "not_accepted"
  | "packet_not_certified"
  | "no_published_cert"
  | "scan_not_matching_cert"
  | "report_not_matching_cert";

export type AuthzResult =
  | { allowed: true }
  | { allowed: false; reason: AuthzDenial };

// ── Decision function ──────────────────────────────────────────────────────

export function authorizeDownload(
  documentId: string,
  doc: AuthzDocument | null,
  packetStatus: string,
  publishedCert: AuthzPublishedCert | null,
): AuthzResult {
  if (!UUID_RE.test(documentId)) {
    return { allowed: false, reason: "invalid_uuid" };
  }

  if (!doc) {
    return { allowed: false, reason: "not_found" };
  }

  if (!DISTRIBUTABLE_TYPES.has(doc.document_type)) {
    return { allowed: false, reason: "non_distributable" };
  }

  if (doc.status !== "accepted") {
    return { allowed: false, reason: "not_accepted" };
  }

  if (PHYSICAL_ARTIFACT_TYPES.has(doc.document_type)) {
    if (packetStatus !== "certified") {
      return { allowed: false, reason: "packet_not_certified" };
    }

    if (!publishedCert) {
      return { allowed: false, reason: "no_published_cert" };
    }

    if (
      doc.document_type === "notarial_scan" &&
      publishedCert.notarial_scan_document_id !== doc.id
    ) {
      return { allowed: false, reason: "scan_not_matching_cert" };
    }

    if (
      doc.document_type === "certification_report" &&
      publishedCert.certification_report_document_id !== doc.id
    ) {
      return { allowed: false, reason: "report_not_matching_cert" };
    }
  }

  return { allowed: true };
}
