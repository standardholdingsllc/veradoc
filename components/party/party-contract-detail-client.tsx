"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FileText,
  Fingerprint,
  Home,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PdfViewerModal = dynamic(
  () => import("@/components/pdf/pdf-viewer-modal").then((m) => m.PdfViewerModal),
  { ssr: false },
);
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PacketStatus, SignerStatus } from "@/lib/domain/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  isLeaseExpired,
  truncateHash,
} from "@/lib/formatters";
import {
  ACTIONS,
  DASHBOARD,
  DOCUMENT,
  EVIDENCE,
  FORMS,
  PARTY_ACCOUNT,
  RECORD,
  UI,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PacketRow {
  id: string;
  packet_code: string | null;
  status: string;
  property_address: string | null;
  property_unit: string | null;
  district: string | null;
  province: string | null;
  rental_amount: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  document_hash: string | null;
  created_at: string | null;
  updated_at: string | null;
  certified_at: string | null;
}

interface SignerRow {
  id: string;
  signer_full_name: string;
  signer_email: string;
  signer_whatsapp: string;
  signer_dni: string;
  role_in_lease: string;
  status: string;
}

interface DocumentRow {
  id: string;
  document_type: string;
  storage_path: string;
  file_hash: string | null;
  created_at: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  metadata: unknown;
  created_at: string | null;
}

interface EvidenceRow {
  id: string;
  evidence_type: string;
  metadata: unknown;
  storage_path: string | null;
  created_at: string | null;
}

export interface PartyContractDetailProps {
  role: "landlord" | "renter";
  packet: PacketRow;
  displayStatus: PacketStatus;
  signerRecord: SignerRow;
  signerDisplayStatus: SignerStatus;
  documents: DocumentRow[];
  auditLog: AuditRow[];
  evidence: EvidenceRow[];
  onDownload: (
    packetId: string,
    documentId: string,
  ) => Promise<{ error?: string; data?: { url: string } | null }>;
  onStartRenewal?: (
    packetId: string,
  ) => Promise<{ error?: string; data?: { renewalPacketId: string } | null }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  packet_created: "Paquete creado",
  payment_confirmed: "Pago confirmado",
  signing_links_sent: "Enlaces de firma enviados",
  submitted_to_notary: "Enviado a notario",
  evidence_report_generated: "Informe de evidencia generado",
  signer_status_advanced: "Firmante avanzó de estado",
  notary_review_started: "Revisión notarial iniciada",
  notary_certified: "Certificado por notario",
  notary_decision: "Decisión notarial",
  notary_returned_for_correction: "Devuelto para corrección",
  document_hash_recorded: "Hash de documento registrado",
  document_downloaded: "Documento descargado",
  lease_reviewed: "Contrato revisado",
  signed_document_uploaded: "Documento firmado cargado",
  all_signers_complete: "Todos los firmantes completaron",
};

function isCertifiedStatus(status: PacketStatus): boolean {
  return (
    status === "certified" ||
    status === "certified_with_observations" ||
    status === "expired"
  );
}

function getPropertyLabel(packet: PacketRow): string {
  const parts = [packet.property_address];
  if (packet.property_unit) parts.push(packet.property_unit);
  if (packet.district) parts.push(packet.district);
  return parts.filter(Boolean).join(", ");
}

function bestDocument(
  documents: DocumentRow[],
  certified: boolean,
): DocumentRow | null {
  const accepted = documents.filter(
    (d) => !("status" in d) || d.status === "accepted",
  );
  const byType = (t: string) => accepted.find((d) => d.document_type === t);
  if (certified) {
    const scan = byType("notarial_scan");
    if (scan) return scan;
    const cert = byType("certified_lease");
    if (cert) return cert;
  }
  const signed = byType("signed_pdf");
  if (signed) return signed;
  return byType("lease_original") ?? null;
}

function evidenceCount(evidence: EvidenceRow[]): number {
  const types = new Set(evidence.map((e) => e.evidence_type));
  return types.size;
}

function consentTimestamp(evidence: EvidenceRow[]): string | null {
  const consent = evidence.find((e) => e.evidence_type === "consent_record");
  if (!consent?.metadata) return null;
  const meta = consent.metadata as Record<string, unknown>;
  return (meta.acceptedAt as string) ?? null;
}

function hasDigitalSignature(evidence: EvidenceRow[]): boolean {
  return evidence.some((e) => e.evidence_type === "digital_signature");
}

// ---------------------------------------------------------------------------
// Detail Item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface/30 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PartyContractDetailClient({
  role,
  packet,
  displayStatus,
  signerRecord,
  signerDisplayStatus,
  documents,
  auditLog,
  evidence,
  onDownload,
  onStartRenewal,
}: PartyContractDetailProps) {
  const [downloading, setDownloading] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>(
    DOCUMENT.contratoCertificado,
  );
  const router = useRouter();
  const base = role === "landlord" ? "/arrendador" : "/arrendatario";
  const certified = isCertifiedStatus(displayStatus);
  const bestDoc = bestDocument(documents, certified);
  const certifiedDoc = documents.find(
    (d) => d.document_type === "certified_lease",
  );
  const notarialScan = documents.find(
    (d) => d.document_type === "notarial_scan" && (!("status" in d) || d.status === "accepted"),
  );
  const certificationReport = documents.find(
    (d) => d.document_type === "certification_report" && (!("status" in d) || d.status === "accepted"),
  );
  const evidenceReport = documents.find(
    (d) => d.document_type === "evidence_report",
  );
  const signedPdf = documents.find(
    (d) => d.document_type === "signed_pdf",
  );
  const hasPhysicalSealArtifacts = !!notarialScan;
  const isPending =
    signerDisplayStatus !== "complete" && signerDisplayStatus !== "signed";
  const renewalAvailable =
    role === "landlord" &&
    displayStatus === "expired" &&
    !!packet.lease_end_date &&
    isLeaseExpired(packet.lease_end_date);

  const handleViewDocument = useCallback(
    async (documentId: string, title: string = DOCUMENT.contratoCertificado) => {
      setDownloading(true);
      try {
        const result = await onDownload(packet.id, documentId);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data?.url) {
          setViewerTitle(title);
          setViewerUrl(result.data.url);
        }
      } catch {
        toast.error("Error al cargar documento.");
      } finally {
        setDownloading(false);
      }
    },
    [onDownload, packet.id],
  );

  const handleStartRenewal = useCallback(async () => {
    if (!onStartRenewal) return;
    setRenewing(true);
    try {
      const result = await onStartRenewal(packet.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data?.renewalPacketId) {
        toast.success("Renovación iniciada.");
        router.push(`${base}/contratos/${result.data.renewalPacketId}`);
      }
    } catch {
      toast.error("Error al iniciar renovación.");
    } finally {
      setRenewing(false);
    }
  }, [base, onStartRenewal, packet.id, router]);

  return (
    <div className="mx-auto w-full max-w-[1050px] px-4 py-8 md:px-8">
      <Link
        href={`${base}/contratos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ACTIONS.volverAlPanel}
      </Link>

      {/* Header */}
      <header className="mb-8 rounded-md border border-border bg-surface/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {PARTY_ACCOUNT.detalleContrato}
            </p>
            <h1 className="mt-2 font-mono text-2xl font-semibold text-primary">
              {packet.packet_code ?? packet.id.slice(0, 8)}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {getPropertyLabel(packet)}
            </p>
          </div>
          <StatusBadge status={displayStatus} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {/* Lease Document Card */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText
                  className="size-4 text-secondary"
                  aria-hidden="true"
                />
                {DOCUMENT.contratoArrendamiento}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                {packet.document_hash && (
                  <DetailItem
                    label={DOCUMENT.hashInicial}
                    value={truncateHash(packet.document_hash, 10)}
                    mono
                  />
                )}
                {packet.rental_amount != null && (
                  <DetailItem
                    label={FORMS.rentaMensual}
                    value={formatCurrency(packet.rental_amount)}
                    mono
                  />
                )}
                {packet.lease_start_date && (
                  <DetailItem
                    label={FORMS.fechaInicio}
                    value={formatDate(packet.lease_start_date)}
                    mono
                  />
                )}
                {packet.lease_end_date && (
                  <DetailItem
                    label={FORMS.fechaVencimiento}
                    value={formatDate(packet.lease_end_date)}
                    mono
                  />
                )}
              </dl>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={downloading}
                onClick={() => bestDoc && handleViewDocument(bestDoc.id, DOCUMENT.contratoArrendamiento)}
              >
                {downloading ? (
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                {certified
                  ? "Descargar contrato certificado"
                  : "Descargar contrato"}
              </Button>
            </CardContent>
          </Card>

          {/* Evidence Summary Card */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Fingerprint
                  className="size-4 text-secondary"
                  aria-hidden="true"
                />
                {PARTY_ACCOUNT.evidenciaIdentidad}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label={FORMS.nombreCompleto}
                  value={signerRecord.signer_full_name}
                />
                <DetailItem
                  label={FORMS.dni}
                  value={signerRecord.signer_dni}
                  mono
                />
                <DetailItem
                  label={FORMS.whatsapp}
                  value={signerRecord.signer_whatsapp}
                  mono
                />
                <DetailItem
                  label={PARTY_ACCOUNT.evidenciaRegistrada}
                  value={`${evidenceCount(evidence)} registros`}
                  mono
                />
                <DetailItem
                  label={RECORD.timestamp}
                  value={
                    consentTimestamp(evidence)
                      ? formatDateTime(consentTimestamp(evidence)!)
                      : UI.sinResultados
                  }
                  mono
                />
                <DetailItem
                  label={EVIDENCE.validacionFirma}
                  value={
                    hasDigitalSignature(evidence)
                      ? "Firma digital completada"
                      : PARTY_ACCOUNT.firmaPendiente
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {/* Property Card (landlord only) */}
          {role === "landlord" && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Home
                    className="size-4 text-secondary"
                    aria-hidden="true"
                  />
                  {PARTY_ACCOUNT.autoridadPropiedad}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    label="Dirección"
                    value={packet.property_address ?? UI.sinResultados}
                  />
                  {packet.property_unit && (
                    <DetailItem label="Unidad" value={packet.property_unit} />
                  )}
                  <DetailItem
                    label="Distrito"
                    value={packet.district ?? UI.sinResultados}
                  />
                  <DetailItem
                    label="Provincia"
                    value={packet.province ?? UI.sinResultados}
                  />
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Status Timeline */}
          {auditLog.length > 0 && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base">
                  Línea de tiempo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ol className="relative border-l border-border">
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="mb-4 ml-4 last:mb-0">
                      <div className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-surface" />
                      <p className="text-sm font-medium text-primary">
                        {ACTION_LABELS[entry.action] ??
                          entry.action.replace(/_/g, " ")}
                      </p>
                      {entry.created_at && (
                        <time className="text-xs text-muted">
                          {formatDateTime(entry.created_at)}
                        </time>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{UI.acciones}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isPending && (
                <p className="text-sm text-warning">
                  {PARTY_ACCOUNT.firmaPendiente}
                </p>
              )}

              {certified && hasPhysicalSealArtifacts && (
                <>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={downloading}
                    onClick={() =>
                      notarialScan && handleViewDocument(
                        notarialScan.id,
                        "Documento con certificación notarial de firmas",
                      )
                    }
                  >
                    {downloading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                    Documento con certificación notarial
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={downloading}
                    onClick={() =>
                      signedPdf && handleViewDocument(
                        signedPdf.id,
                        "Original firmado por las partes",
                      )
                    }
                  >
                    {downloading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                    Original firmado por las partes
                  </Button>
                  {certificationReport && (
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      disabled={downloading}
                      onClick={() =>
                        handleViewDocument(
                          certificationReport.id,
                          "Reporte de verificación VeraDoc",
                        )
                      }
                    >
                      {downloading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-4" aria-hidden="true" />
                      )}
                      Reporte de verificación VeraDoc
                    </Button>
                  )}
                </>
              )}

              {certified && !hasPhysicalSealArtifacts && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={downloading}
                  onClick={() => certifiedDoc && handleViewDocument(certifiedDoc.id)}
                >
                  {downloading ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download className="size-4" aria-hidden="true" />
                  )}
                  {ACTIONS.descargarContrato}
                </Button>
              )}

              {evidenceReport && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={downloading}
                  onClick={() =>
                    evidenceReport && handleViewDocument(
                      evidenceReport.id,
                      "Informe de evidencia",
                    )
                  }
                >
                  {downloading ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download className="size-4" aria-hidden="true" />
                  )}
                  Descargar informe de evidencia
                </Button>
              )}

              {renewalAvailable && (
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  disabled={renewing || !onStartRenewal}
                  onClick={handleStartRenewal}
                >
                  {renewing ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  {ACTIONS.iniciarRenovacion}
                </Button>
              )}

              {!isPending && !certified && !renewalAvailable && (
                <p className="text-sm text-muted">
                  {PARTY_ACCOUNT.sinAccionesPendientes}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Renewal Info Card */}
          {renewalAvailable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {DASHBOARD.renovacionDisponible}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted">
                <p>{PARTY_ACCOUNT.renovacionLista}</p>
                <Badge variant="warning">Disponible</Badge>
              </CardContent>
            </Card>
          )}

          {/* Certified Document Card */}
          {certifiedDoc && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {DOCUMENT.contratoCertificado}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {certifiedDoc.file_hash && (
                  <p className="font-mono text-xs text-muted">
                    {truncateHash(certifiedDoc.file_hash, 8)}
                  </p>
                )}
                <Badge variant="success">
                  <BadgeCheck className="size-3" aria-hidden="true" />
                  {PARTY_ACCOUNT.documentoCertificadoDisponible}
                </Badge>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {viewerUrl && (
        <PdfViewerModal
          url={viewerUrl}
          title={viewerTitle}
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}
