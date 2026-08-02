"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  Receipt,
  Scale,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

const PdfViewer = dynamic(
  () => import("@/components/pdf/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    ),
  },
);
import {
  generateEvidenceReportAction,
  submitToNotaryAction,
  getDocumentDownloadUrl,
} from "@/lib/actions/agente-actions";
import { isTerminalDbStatus } from "@/lib/domain/status-mapping";
import type { DocumentHashEntry, PacketStatus, SignerStatus } from "@/lib/domain/types";
import { SIGNER_STATUS_CONFIG } from "@/lib/domain/constants";
import { DocumentHashTimeline } from "@/components/evidence/document-hash-timeline";
import { formatCurrency, formatDateTime, truncateHash } from "@/lib/formatters";
import {
  ACTIONS,
  DOCUMENT,
  EVIDENCE,
  FORMS,
  PAGE_TITLES,
  PAYMENT,
  RECORD,
  REGISTRY,
  ROLES,
  TOAST,
  UI,
  WIZARD,
} from "@/lib/i18n/labels";

interface PacketRow {
  id: string;
  packet_code: string | null;
  status: string;
  property_address: string | null;
  property_unit: string | null;
  district: string | null;
  province: string | null;
  rental_amount: number | null;
  deposit_amount: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  document_hash: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SignerRow {
  id: string;
  signer_full_name: string;
  signer_email: string;
  signer_whatsapp: string;
  signer_dni: string;
  role_in_lease: string;
  status: string;
  displayStatus: SignerStatus;
}

interface DocumentRow {
  id: string;
  document_type: string;
  storage_path: string;
  file_hash: string | null;
  created_at: string | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_provider_ref: string | null;
  paid_at: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  metadata: unknown;
  created_at: string | null;
}

interface DuplicateCheck {
  overlap_count: number;
  earliest_start: string | null;
  latest_end: string | null;
}

interface PacketDetailClientProps {
  packet: PacketRow;
  displayStatus: PacketStatus;
  signers: SignerRow[];
  documents: DocumentRow[];
  payment: PaymentRow | null;
  auditLog: AuditRow[];
  duplicateCheck: DuplicateCheck | null;
  hashTimeline: DocumentHashEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  packet_created: "Paquete creado",
  payment_confirmed: "Pago confirmado",
  signing_links_sent: "Enlaces de firma enviados",
  submitted_to_notary: "Enviado a notario",
  evidence_report_generated: "Informe de evidencia generado",
  signer_status_advanced: "Firmante avanzó de estado",
  notary_review_started: "Revisión notarial iniciada",
  notary_decision: "Decisión notarial",
  document_hash_recorded: "Hash de documento registrado",
  document_downloaded: "Documento descargado",
};

export function PacketDetailClient({
  packet,
  displayStatus,
  signers,
  documents,
  payment,
  auditLog,
  duplicateCheck,
  hashTimeline,
}: PacketDetailClientProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  // Polling for non-terminal statuses
  useEffect(() => {
    if (isTerminalDbStatus(packet.status)) return;
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [packet.status, router]);

  const handleGenerateReport = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await generateEvidenceReportAction(packet.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(TOAST.informeGenerado);
        router.refresh();
      }
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [packet.id, processing, router]);

  const handleSubmitToNotary = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await submitToNotaryAction(packet.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(TOAST.paqueteEnviadoNotario);
        router.refresh();
      }
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [packet.id, processing, router]);

  const handleSendReminder = useCallback(() => {
    toast.success(TOAST.recordatorioEnviado);
  }, []);

  const handleDownload = useCallback(
    async (documentType: string) => {
      const result = await getDocumentDownloadUrl(packet.id, documentType);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data?.url) {
        window.open(result.data.url, "_blank");
      }
    },
    [packet.id],
  );

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const handleViewDocument = useCallback(
    async (documentType: string) => {
      setViewerLoading(true);
      try {
        const result = await getDocumentDownloadUrl(packet.id, documentType);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.data?.url) {
          setViewerUrl(result.data.url);
        }
      } catch {
        toast.error(TOAST.errorGenerico);
      } finally {
        setViewerLoading(false);
      }
    },
    [packet.id],
  );

  const showGenerateReport = packet.status === "all_signed";
  const showSubmitNotary = packet.status === "all_signed";
  const showReminder = packet.status === "signing";

  const leaseOriginal = documents.find(
    (d) => d.document_type === "lease_original",
  );
  const signedPdf = documents.find(
    (d) => d.document_type === "signed_pdf",
  );
  const evidenceReport = documents.find(
    (d) => d.document_type === "evidence_report",
  );
  const certifiedLease = documents.find(
    (d) => d.document_type === "certified_lease",
  );

  const isCertified = packet.status === "certified";
  const isPaid = payment?.status === "completed";
  const showFactura = isCertified && isPaid;

  return (
    <>
      <header className="mb-8 rounded-md border border-border bg-surface/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted">
              {PAGE_TITLES.detallePaquete}
            </p>
            <h1 className="font-mono text-2xl font-semibold text-primary">
              {packet.packet_code ?? packet.id.slice(0, 12)}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              {packet.created_at && (
                <span>
                  {UI.fechaCreacion}:{" "}
                  <time dateTime={packet.created_at}>
                    {formatDateTime(packet.created_at)}
                  </time>
                </span>
              )}
              <span className="font-mono">
                ID: {packet.id.slice(0, 12)}…
              </span>
            </div>
          </div>
          <StatusBadge status={displayStatus} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-muted" />
                {RECORD.lineaTiempo}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted">Sin eventos registrados.</p>
              ) : (
                <ol className="relative space-y-0">
                  {auditLog.map((event, index) => {
                    const isLast = index === auditLog.length - 1;
                    return (
                      <li
                        key={event.id}
                        className="relative flex gap-4 pb-6 last:pb-0"
                      >
                        {!isLast && (
                          <span
                            className="absolute left-[7px] top-4 h-full w-px bg-border"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 ${
                            isLast
                              ? "border-secondary bg-secondary"
                              : "border-border bg-background"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {ACTION_LABELS[event.action] ?? event.action}
                            </p>
                            {event.created_at && (
                              <time
                                className="font-mono text-xs text-muted"
                                dateTime={event.created_at}
                              >
                                {formatDateTime(event.created_at)}
                              </time>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Signers */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {UI.firmantes}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {signers.map((signer) => {
                const config = SIGNER_STATUS_CONFIG[signer.displayStatus];
                return (
                  <Card key={signer.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-sm">
                            {signer.signer_full_name}
                          </CardTitle>
                          <p className="font-mono text-xs text-muted">
                            {FORMS.dni}: {signer.signer_dni}
                          </p>
                        </div>
                        <Badge
                          variant={
                            signer.role_in_lease === "landlord"
                              ? "success"
                              : "info"
                          }
                        >
                          {signer.role_in_lease === "landlord"
                            ? ROLES.landlord
                            : ROLES.renter}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted">
                          Estado actual
                        </span>
                        <StatusBadge status={signer.displayStatus} />
                      </div>
                      {config && (
                        <p className="text-xs text-muted">{config.label}</p>
                      )}
                      <dl className="grid gap-1 border-t border-border pt-3 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">
                            {FORMS.correoElectronico}
                          </dt>
                          <dd className="truncate font-mono">
                            {signer.signer_email}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">{FORMS.whatsapp}</dt>
                          <dd className="font-mono">
                            {signer.signer_whatsapp}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Document info */}
          {leaseOriginal && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-muted" />
                  {EVIDENCE.documentoArrendamiento}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">
                      {DOCUMENT.nombreArchivo}
                    </dt>
                    <dd className="font-mono">
                      {leaseOriginal.storage_path.split("/").pop()}
                    </dd>
                  </div>
                  {leaseOriginal.created_at && (
                    <div>
                      <dt className="text-xs text-muted">
                        {DOCUMENT.fechaCarga}
                      </dt>
                      <dd>{formatDateTime(leaseOriginal.created_at)}</dd>
                    </div>
                  )}
                  {leaseOriginal.file_hash && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">
                        {DOCUMENT.hashInicial}
                      </dt>
                      <dd className="mt-1 font-mono text-xs">
                        {truncateHash(leaseOriginal.file_hash, 8)}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDocument("lease_original")}
                    disabled={viewerLoading}
                  >
                    {viewerLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                    Ver documento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload("lease_original")}
                  >
                    <FileText className="size-4" />
                    {UI.descargar}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document hash timeline */}
          {hashTimeline.length > 0 && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="size-4 text-muted" />
                  Integridad documental
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <DocumentHashTimeline entries={hashTimeline} />
              </CardContent>
            </Card>
          )}

          {/* Additional documents */}
          {(signedPdf || evidenceReport || certifiedLease) && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-muted" />
                  Documentos del paquete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {signedPdf && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">PDF firmado</p>
                      {signedPdf.file_hash && (
                        <p className="mt-1 font-mono text-xs text-muted">
                          {truncateHash(signedPdf.file_hash, 8)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDocument("signed_pdf")}
                        disabled={viewerLoading}
                        aria-label="Ver PDF firmado"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload("signed_pdf")}
                        aria-label="Descargar PDF firmado"
                      >
                        <FileText className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {evidenceReport && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        Informe de evidencia
                      </p>
                      {evidenceReport.file_hash && (
                        <p className="mt-1 font-mono text-xs text-muted">
                          {truncateHash(evidenceReport.file_hash, 8)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDocument("evidence_report")}
                        disabled={viewerLoading}
                        aria-label="Ver informe de evidencia"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload("evidence_report")}
                        aria-label="Descargar informe de evidencia"
                      >
                        <FileText className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {certifiedLease && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        Documento certificado
                      </p>
                      {certifiedLease.file_hash && (
                        <p className="mt-1 font-mono text-xs text-muted">
                          {truncateHash(certifiedLease.file_hash, 8)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDocument("certified_lease")}
                        disabled={viewerLoading}
                        aria-label="Ver documento certificado"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload("certified_lease")}
                        aria-label="Descargar documento certificado"
                      >
                        <FileText className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column (sidebar) */}
        <aside className="space-y-6">
          {/* Registry check */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">
                {WIZARD.verificacionRegistro}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {duplicateCheck && duplicateCheck.overlap_count > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-warning">
                      {WIZARD.coincidenciaEncontrada}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {duplicateCheck.overlap_count} arrendamiento(s) activo(s)
                      superpuesto(s)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <p className="text-success">{WIZARD.sinCoincidencias}</p>
                </div>
              )}
              <p className="text-xs text-muted">{REGISTRY.explicacion}</p>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-muted" />
                {PAYMENT.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {payment ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{PAYMENT.estado}</dt>
                    <dd>
                      <Badge
                        variant={
                          payment.status === "completed" ? "success" : "warning"
                        }
                      >
                        {payment.status === "completed"
                          ? PAYMENT.pagado
                          : PAYMENT.pendiente}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{PAYMENT.monto}</dt>
                    <dd className="font-mono">
                      {formatCurrency(payment.amount)}
                    </dd>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">{RECORD.timestamp}</dt>
                      <dd className="font-mono text-xs">
                        {formatDateTime(payment.paid_at)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{PAYMENT.metodo}</dt>
                    <dd className="text-xs">
                      {payment.payment_provider_ref ?? "Pendiente"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">{PAYMENT.pendiente}</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">{UI.acciones}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {showGenerateReport && (
                <Button
                  className="w-full justify-start"
                  onClick={handleGenerateReport}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  {ACTIONS.generarInforme}
                </Button>
              )}

              {showSubmitNotary && (
                <Button
                  className="w-full justify-start"
                  onClick={handleSubmitToNotary}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Scale className="size-4" />
                  )}
                  {ACTIONS.enviarANotario}
                </Button>
              )}

              {showReminder && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSendReminder}
                  disabled={processing}
                >
                  <Bell className="size-4" />
                  {ACTIONS.enviarRecordatorio}
                </Button>
              )}

              {!showGenerateReport && !showSubmitNotary && !showReminder && (
                <p className="text-xs text-muted">
                  Sin acciones disponibles en este momento.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Factura (Invoice) - data only, download disabled for MVP */}
          {showFactura && payment && (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="size-4 text-muted" />
                  Factura
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{PAYMENT.monto}</dt>
                    <dd className="font-mono">
                      {formatCurrency(payment.amount)}
                    </dd>
                  </div>
                  {payment.paid_at && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Fecha de pago</dt>
                      <dd className="font-mono text-xs">
                        {formatDateTime(payment.paid_at)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Referencia</dt>
                    <dd className="text-xs">
                      {payment.payment_provider_ref ?? "Pendiente"}
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  disabled
                  title="Factura disponible próximamente"
                >
                  <Receipt className="size-4" />
                  Descargar factura (próximamente)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Property info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{UI.propiedad}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{packet.property_address}</p>
              {packet.property_unit && (
                <p className="text-muted">{packet.property_unit}</p>
              )}
              <p className="font-mono text-xs text-muted">
                {packet.district}, {packet.province}
              </p>
              {packet.rental_amount != null && (
                <p className="mt-2 font-mono text-xs text-muted">
                  {formatCurrency(packet.rental_amount)} / mes
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* PDF Viewer Dialog */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Visor de documento"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewerUrl(null);
          }}
        >
          <div className="relative flex h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                {EVIDENCE.documentoArrendamiento}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewerUrl(null)}
                aria-label="Cerrar visor"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <PdfViewer url={viewerUrl} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
