import type { DocumentArtifactStatus } from "./types";

export const ATTESTATION_TEXT_VERSION = "v1.0-2026-08";

export const ATTESTATION_TEXT_ES = `Declaro bajo mi responsabilidad profesional que:

1. El documento escaneado adjunto corresponde exactamente al paquete de arrendamiento identificado en esta atestación.
2. Todas las páginas del documento firmado por las partes están presentes y son legibles en el escaneo.
3. Se aplicaron las marcas de certificación notarial de firmas requeridas (sello y firma física).
4. No se modificó el contenido contractual del documento, salvo las marcas notariales declaradas y las páginas adicionales de certificación indicadas.
5. El escaneo cargado es una reproducción fiel del documento físico resultante.

La verificación de las firmas digitales de las partes consta en el expediente de evidencia original, no en el escaneo físico.`;

export interface NotaryAttestationData {
  page_count_matches: boolean;
  all_pages_legible: boolean;
  sello_applied: boolean;
  physical_signature_applied: boolean;
  no_content_altered: boolean;
  additional_certification_pages: number;
}

export interface NotarialScanValidationResult {
  valid: boolean;
  pdf_header_ok: boolean;
  pdf_structure_ok: boolean;
  not_encrypted: boolean;
  page_count: number | null;
  file_size_bytes: number;
  file_hash: string;
  source_document_id: string;
  source_document_hash: string;
  declared_added_pages: number;
  validator_version: string;
  validated_at: string;
  errors: string[];
  warnings: string[];
}

export interface SealWorkflowStep {
  id: "download" | "upload" | "attest" | "prepare" | "publish";
  label: string;
  completed: boolean;
  active: boolean;
}

export interface SealWorkflowState {
  printDownloadIssued: boolean;
  signedDocument: { id: string; hash: string; pageCount: number | null } | null;
  acceptedScan: {
    id: string;
    hash: string;
    pageCount: number | null;
    metadata: Record<string, unknown>;
  } | null;
  attestation: {
    id: string;
    textVersion: string;
    attestedAt: string;
    scanId: string;
  } | null;
  preparedCertification: {
    id: string;
    reportDocumentId: string | null;
    scanId: string | null;
  } | null;
}

export function deriveSealWorkflowSteps(state: SealWorkflowState): SealWorkflowStep[] {
  const hasDownload = state.printDownloadIssued;
  const hasScan = !!state.acceptedScan;

  const hasValidAttestation = !!state.attestation
    && !!state.acceptedScan
    && state.attestation.scanId === state.acceptedScan.id;

  const hasValidPreparation = !!state.preparedCertification
    && !!state.acceptedScan
    && state.preparedCertification.scanId === state.acceptedScan.id;

  const hasReport = hasValidPreparation
    && !!state.preparedCertification?.reportDocumentId;

  const steps: SealWorkflowStep[] = [
    {
      id: "download",
      label: "Descargar para imprimir",
      completed: hasDownload,
      active: !hasDownload,
    },
    {
      id: "upload",
      label: "Subir escaneo con sello",
      completed: hasScan,
      active: hasDownload && !hasScan,
    },
    {
      id: "attest",
      label: "Confirmar atestación",
      completed: hasValidAttestation,
      active: hasScan && !hasValidAttestation,
    },
    {
      id: "prepare",
      label: "Preparar reporte",
      completed: hasValidPreparation && hasReport,
      active: hasValidAttestation && !hasValidPreparation,
    },
    {
      id: "publish",
      label: "Publicar documento certificado",
      completed: false,
      active: hasValidPreparation && hasReport,
    },
  ];
  return steps;
}

export function getAcceptedDocumentFilter() {
  return { status: "accepted" as DocumentArtifactStatus };
}
