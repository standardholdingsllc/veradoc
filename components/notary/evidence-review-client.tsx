"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Eye,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatCalendarDate,
  formatPeruDate,
  formatPeruDateTime,
} from "@/lib/date-time";

const PdfViewer = dynamic(
  () => import("@/components/pdf/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface/30 h-[500px]">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    ),
  },
);
import {
  EvidenceSectionNav,
} from "@/components/evidence/evidence-section-nav";
import { useEvidenceSectionNavigation } from "@/components/evidence/use-evidence-section-navigation";
import { DocumentHashTimeline } from "@/components/evidence/document-hash-timeline";
import { HashDisplay } from "@/components/evidence/hash-display";
import {
  startReviewAction,
  recordPropertyAuthorityCheckAction,
  type PacketEvidenceData,
} from "@/lib/actions/notary";
import { ProductionChecklistPanel } from "@/components/notary/checklist-panel";
import { ProductionDecisionPanel, DecisionResultSummary } from "@/components/notary/decision-panel";
import { SealWorkflowPanel } from "@/components/notary/seal-workflow-panel";
import {
  STATUS_LABELS,
  EVIDENCE,
  EVIDENCE_DETAILS,
  FORMS,
  ACTIONS,
  REGISTRY,
  CHECKLIST,
} from "@/lib/i18n/labels";
import type { DocumentHashEntry } from "@/lib/domain/types";

function statusColor(status: string): string {
  if (status === "certified") return "bg-green-50 text-green-700";
  if (status === "under_review") return "bg-blue-50 text-blue-700";
  if (status === "awaiting_notary_seal") return "bg-purple-50 text-purple-700";
  if (status === "needs_correction") return "bg-amber-50 text-amber-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-gray-50 text-gray-700";
}

// ---------------------------------------------------------------------------
// Helpers to map production data → domain shapes for existing components
// ---------------------------------------------------------------------------

function buildHashEntries(data: PacketEvidenceData): DocumentHashEntry[] {
  const entries: DocumentHashEntry[] = [];
  const leaseDoc = data.documents.find((d) => d.documentType === "lease_original");
  if (leaseDoc?.fileHash) {
    entries.push({
      hash: leaseDoc.fileHash,
      stage: "initial_upload",
      algorithm: "SHA-256",
      timestamp: leaseDoc.createdAt ?? data.packet.createdAt,
    });
  } else if (data.packet.documentHash) {
    entries.push({
      hash: data.packet.documentHash,
      stage: "initial_upload",
      algorithm: "SHA-256",
      timestamp: data.packet.createdAt,
    });
  }

  const signedDoc = data.documents.find((d) => d.documentType === "signed_pdf");
  if (signedDoc?.fileHash) {
    entries.push({
      hash: signedDoc.fileHash,
      stage: "post_signatures",
      algorithm: "SHA-256",
      timestamp: signedDoc.createdAt ?? "",
    });
  }

  const certDoc = data.documents.find((d) => d.documentType === "certified_lease");
  if (certDoc?.fileHash) {
    entries.push({
      hash: certDoc.fileHash,
      stage: "final_certified",
      algorithm: "SHA-256",
      timestamp: certDoc.createdAt ?? "",
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface EvidenceReviewClientProps {
  data: PacketEvidenceData;
}

export function EvidenceReviewClient({ data }: EvidenceReviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isPreview = data.packet.status === "pending_notary";
  const isUnderReview = data.packet.status === "under_review";
  const isAwaitingSeal = data.packet.status === "awaiting_notary_seal";
  const isTerminal = ["certified", "needs_correction", "rejected"].includes(
    data.packet.status,
  );
  const isDecisionProcessing = isUnderReview
    && ["certified", "certified_with_observations"].includes(
      data.assignment.decision ?? "",
    );
  const isWorkflowJobActive = Boolean(data.decisionJob);

  const checklistKeys = Object.keys(CHECKLIST);
  const allChecked =
    checklistKeys.length > 0 &&
    checklistKeys.every((key) => data.checklist[key]?.checked === true);

  const statusLabel =
    (STATUS_LABELS as Record<string, string>)[data.packet.status] ??
    data.packet.status;

  const { activeSection, selectSection } = useEvidenceSectionNavigation({
    showDecision: !isPreview,
    showRealtorVerification: true,
    headerId: "notary-review-header",
  });

  const handleStartReview = () => {
    startTransition(async () => {
      try {
        await startReviewAction(data.packet.id);
        toast.success("Revisión iniciada");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Error al iniciar revisión",
        );
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div id="notary-review-header" className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            Cola
          </Link>
          <span className="font-mono text-sm font-semibold text-primary">
            {data.packet.packetCode}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              statusColor(data.packet.status),
            )}
          >
            {statusLabel}
          </span>
          {isPreview && (
            <Badge variant="warning" className="ml-auto text-xs">
              <Eye className="mr-1 size-3" /> Vista previa
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {data.packet.propertyAddress}
          {data.packet.propertyUnit ? ` - ${data.packet.propertyUnit}` : ""}
          {data.packet.district ? `, ${data.packet.district}` : ""}
        </p>
      </div>

      {/* Preview banner */}
      {isPreview && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-800">
              Este paquete está pendiente de revisión. Inicie la revisión para
              interactuar con la lista de verificación.
            </p>
            <Button
              onClick={handleStartReview}
              disabled={isPending}
              size="sm"
            >
              {isPending ? "Iniciando…" : ACTIONS.iniciarRevision}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar nav */}
        <aside className="hidden w-[220px] shrink-0 border-r border-border lg:block">
          <div className="sticky top-20">
            <EvidenceSectionNav
              activeSection={activeSection}
              onSectionSelect={selectSection}
              showDecision={!isPreview}
              showRealtorVerification
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-8 px-4 py-6 md:px-8">
          {/* 1. Summary */}
          <Section id="summary" number={1} title={EVIDENCE.resumenPaquete}>
            <EvidenceSummaryPanel data={data} />
            <DetailGrid
              items={[
                { label: "Código", value: data.packet.packetCode },
                { label: "Estado", value: statusLabel },
                { label: "Propiedad", value: `${data.packet.propertyAddress}${data.packet.propertyUnit ? ` - ${data.packet.propertyUnit}` : ""}` },
                { label: "Distrito", value: data.packet.district ?? "—" },
                { label: "Provincia", value: data.packet.province ?? "—" },
                { label: "Departamento", value: data.packet.department ?? "—" },
                { label: "Renta mensual", value: data.packet.rentalAmount ? `S/ ${data.packet.rentalAmount}` : "—" },
                { label: "Depósito", value: data.packet.depositAmount ? `S/ ${data.packet.depositAmount}` : "—" },
                { label: "Fecha inicio", value: formatCalendarDate(data.packet.leaseStartDate) },
                { label: "Fecha fin", value: formatCalendarDate(data.packet.leaseEndDate) },
                { label: "Enviado al notario", value: formatPeruDateTime(data.packet.submittedAt) },
                { label: "Firmantes", value: String(data.signers.length) },
              ]}
            />
          </Section>

          {/* 2. Lease document */}
          <Section id="lease-document" number={2} title={EVIDENCE.documentoArrendamiento}>
            <DocumentCard
              label="Contrato original"
              doc={data.documents.find((d) => d.documentType === "lease_original")}
            />
          </Section>

          {/* 3. Signed document */}
          <Section id="signed-document" number={3} title={EVIDENCE.documentoFirmado}>
            <DocumentCard
              label="PDF firmado"
              doc={data.documents.find((d) => d.documentType === "signed_pdf")}
            />
          </Section>

          {/* 4. Signer evidence */}
          <Section id="signer-evidence" number={4} title={EVIDENCE.evidenciaFirmante}>
            {data.signers.length === 0 ? (
              <p className="text-sm text-muted">Sin firmantes registrados.</p>
            ) : (
              <div className="space-y-4">
                {data.signers.map((signer) => (
                  <SignerEvidenceSection key={signer.id} signer={signer} />
                ))}
              </div>
            )}
          </Section>

          {/* 5. Signature validation */}
          <Section id="signature-validation" number={5} title={EVIDENCE.validacionFirma}>
            {data.signers.filter((s) => s.signatureRecord).length === 0 ? (
              <p className="text-sm text-muted">Sin registros de firma digital.</p>
            ) : (
              <div className="space-y-4">
                {data.signers
                  .filter((s) => s.signatureRecord)
                  .map((signer) => (
                    <Card key={signer.id}>
                      <CardHeader className="border-b border-border pb-3">
                        <CardTitle className="text-sm">
                          {signer.fullName}
                          <span className="ml-2 font-normal text-muted">
                            · {signer.roleInLease === "landlord" ? "Arrendador" : "Arrendatario"}
                          </span>
                          {signer.signatureRecord!.providerName && (
                            <Badge variant="muted" className="ml-2 text-[10px]">
                              {signer.signatureRecord!.providerName}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-4">
                        <DetailGrid
                          items={[
                            { label: EVIDENCE_DETAILS.sujetoCertificado, value: signer.signatureRecord!.certificateSubject ?? "—", mono: true },
                            { label: EVIDENCE_DETAILS.emisorCertificado, value: signer.signatureRecord!.certificateIssuer ?? "—", mono: true },
                            { label: EVIDENCE_DETAILS.numeroSerie, value: signer.signatureRecord!.certificateSerial ?? "—", mono: true },
                            { label: EVIDENCE_DETAILS.periodoValidez, value: `${formatPeruDate(signer.signatureRecord!.certificateValidFrom)} → ${formatPeruDate(signer.signatureRecord!.certificateValidTo)}`, mono: true },
                            ...(signer.signatureRecord!.providerSignedAt ? [{ label: "Firmado en", value: formatPeruDateTime(signer.signatureRecord!.providerSignedAt), mono: true as const }] : []),
                          ]}
                        />
                        <div className="grid gap-3 sm:grid-cols-4">
                          <ValidBadge label={EVIDENCE_DETAILS.cadenaCertificados} value={signer.signatureRecord!.chainValidationResult} good="valid" />
                          <ValidBadge label={EVIDENCE_DETAILS.revocacion} value={signer.signatureRecord!.revocationResult} good="good" />
                          <ValidBadge label={EVIDENCE_DETAILS.timestamp} value={signer.signatureRecord!.timestampResult} good="valid" />
                          <ValidBadge label={EVIDENCE_DETAILS.integridadPdf} value={signer.signatureRecord!.pdfIntegrityValid ? "intact" : signer.signatureRecord!.pdfIntegrityValid === false ? "modified" : null} good="intact" />
                        </div>
                        {signer.signatureRecord!.signedDocumentHash && (
                          <div className="border-t border-border pt-3">
                            <p className="mb-1 text-xs font-medium uppercase text-muted">
                              {EVIDENCE_DETAILS.hashDocumentoFirmado}
                            </p>
                            <HashDisplay hash={signer.signatureRecord!.signedDocumentHash} />
                          </div>
                        )}
                        {signer.signatureRecord!.verificationUrl && (
                          <div className="border-t border-border pt-3">
                            <a
                              href={signer.signatureRecord!.verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:underline"
                            >
                              <Shield className="size-3.5" />
                              Verificar firma en FirmEasy
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </Section>

          {/* 6. Hash history */}
          <Section id="hash-history" number={6} title={EVIDENCE.historialHashes}>
            <DocumentHashTimeline entries={buildHashEntries(data)} />
          </Section>

          {/* 7. Property evidence */}
          <Section id="property-evidence" number={7} title={EVIDENCE.evidenciaPropiedad}>
            <PropertyAuthorityPanel
              packetId={data.packet.id}
              property={data.packet}
              checks={data.propertyAuthorityChecks}
              uploadedEvidence={data.signers.flatMap((signer) =>
                signer.evidence.filter((evidence) =>
                  evidence.evidenceType === "property_authority"
                )
              )}
              interactive={isUnderReview && !isDecisionProcessing}
            />
          </Section>

          {/* 8. Registry check */}
          <Section id="registry-check" number={8} title={EVIDENCE.verificacionRegistro}>
            {data.duplicateCheck.overlapCount > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {data.duplicateCheck.overlapCount > 1
                        ? REGISTRY.alertaDuplicadoMultiple
                        : REGISTRY.alertaDuplicado}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      {data.duplicateCheck.overlapCount} arrendamiento(s)
                      activo(s) superpuesto(s).
                      {data.duplicateCheck.earliestStart &&
                        ` Desde: ${formatCalendarDate(data.duplicateCheck.earliestStart)}`}
                      {data.duplicateCheck.latestEnd &&
                        ` Hasta: ${formatCalendarDate(data.duplicateCheck.latestEnd)}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="size-4" />
                Sin coincidencias de arrendamiento duplicado.
              </div>
            )}
          </Section>

          {/* 9. Audit trail */}
          <Section id="audit-trail" number={9} title={EVIDENCE.registrosSesion}>
            {data.auditLog.length === 0 ? (
              <p className="text-sm text-muted">Sin eventos de auditoría.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-medium uppercase text-muted">
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Acción</th>
                      <th className="px-2 py-2">Actor</th>
                      <th className="px-2 py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.auditLog.map((event) => (
                      <tr key={event.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-2 py-2 font-mono">
                          {formatPeruDateTime(event.createdAt)}
                        </td>
                        <td className="px-2 py-2">{event.action}</td>
                        <td className="px-2 py-2 font-mono text-muted">
                          {event.actorId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="px-2 py-2 font-mono text-muted">
                          {event.ipAddress ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 10. Realtor verification */}
          <Section id="realtor-verification" number={10} title="Verificación del agente">
            <DetailGrid
              items={[
                { label: FORMS.nombreCompleto, value: data.realtor.fullName },
                { label: FORMS.correoElectronico, value: data.realtor.email },
                { label: FORMS.dni, value: data.realtor.dni ?? "—", mono: true },
                { label: "Licencia", value: data.realtor.licenseNumber ?? "—", mono: true },
                { label: "Empresa", value: data.realtor.companyName ?? "—" },
                { label: "RUC", value: data.realtor.ruc ?? "—", mono: true },
                { label: "Teléfono", value: data.realtor.phone ?? "—" },
              ]}
            />
          </Section>

          {/* 11. System flags */}
          <Section id="system-flags" number={11} title={EVIDENCE.banderasSistema}>
            {data.systemFlags.length > 0 ? (
              <div className="space-y-2">
                {data.systemFlags.map((flag, index) => (
                  <SystemFlagRow key={`${flag.code}-${index}`} flag={flag} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="size-4" />
                Sin banderas del sistema.
              </div>
            )}
          </Section>

          {/* 12. Checklist */}
          <Section id="checklist" number={12} title={EVIDENCE.listaVerificacion}>
            <ProductionChecklistPanel
              packetId={data.packet.id}
              checklistData={data.checklist}
              interactive={isUnderReview && !isDecisionProcessing}
            />
          </Section>

          {/* 13. Decision panel / Seal workflow */}
          {!isPreview && (
            <Section id="decision" number={13} title={
              isAwaitingSeal ? "Certificación física" : EVIDENCE.panelDecision
            }>
              {isTerminal ? (
                <DecisionResultSummary
                  decision={data.assignment.decision ?? undefined}
                  observations={data.assignment.observations ?? undefined}
                  decidedAt={data.assignment.decidedAt ?? undefined}
                />
              ) : isDecisionProcessing || (isAwaitingSeal && isWorkflowJobActive) ? (
                <DecisionProcessingPanel job={data.decisionJob} />
              ) : isAwaitingSeal && data.sealWorkflowState ? (
                <SealWorkflowPanel packetId={data.packet.id} workflowState={data.sealWorkflowState} />
              ) : isUnderReview && allChecked ? (
                <ProductionDecisionPanel
                  packetId={data.packet.id}
                  workflowVersion={data.packet.notaryWorkflowVersion ?? undefined}
                />
              ) : isUnderReview ? (
                <p className="text-sm text-muted">
                  Complete todos los elementos de la lista de verificación para
                  habilitar el panel de decisión.
                </p>
              ) : null}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded bg-surface font-mono text-xs font-semibold text-muted">
          {number}
        </span>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EvidenceSummaryPanel({ data }: { data: PacketEvidenceData }) {
  const report = data.documents.find(
    (document) => document.documentType === "evidence_report",
  );
  const criticalCount = data.systemFlags.filter(
    (flag) => flag.severity === "critical",
  ).length;
  const warningCount = data.systemFlags.filter(
    (flag) => flag.severity === "warning",
  ).length;

  return (
    <Card className="mb-5 border-secondary/30 bg-secondary/5">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">
              Resumen del informe de evidencia
            </p>
            <p className="mt-1 text-xs text-muted">
              {data.evidenceSummary.completedChecks} de {data.evidenceSummary.totalChecks} controles automáticos disponibles
              {data.evidenceSummary.generatedAt
                ? ` · informe ${formatPeruDateTime(data.evidenceSummary.generatedAt)}`
                : " · informe pendiente"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={criticalCount ? "error" : warningCount ? "warning" : "success"}>
              {criticalCount
                ? `${criticalCount} crítica${criticalCount === 1 ? "" : "s"}`
                : warningCount
                  ? `${warningCount} advertencia${warningCount === 1 ? "" : "s"}`
                  : "Sin alertas"}
            </Badge>
            {report?.signedUrl && (
              <a
                href={report.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
              >
                Ver informe <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-secondary transition-[width]"
            style={{ width: `${data.evidenceSummary.completenessPercent}%` }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryMetric
            label="Completitud"
            value={`${data.evidenceSummary.completenessPercent}%`}
          />
          <SummaryMetric
            label="Imágenes de identidad"
            value={String(data.evidenceSummary.identityImages)}
          />
          <SummaryMetric
            label="Firmas válidas"
            value={`${data.evidenceSummary.validSignatures}/${data.evidenceSummary.signerCount}`}
          />
          <SummaryMetric
            label="Consulta SUNARP"
            value={data.propertyAuthorityChecks[0]?.verificationStatus === "verified"
              ? "Verificada"
              : data.propertyAuthorityChecks.length > 0
                ? "Con observación"
                : "Pendiente"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-medium uppercase text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-primary">{value}</p>
    </div>
  );
}

function PropertyAuthorityPanel({
  packetId,
  property,
  checks,
  uploadedEvidence,
  interactive,
}: {
  packetId: string;
  property: PacketEvidenceData["packet"];
  checks: PacketEvidenceData["propertyAuthorityChecks"];
  uploadedEvidence: PacketEvidenceData["signers"][number]["evidence"];
  interactive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [titleNumber, setTitleNumber] = useState("");
  const [status, setStatus] = useState<"verified" | "observation" | "not_found">("verified");
  const [checkedAt, setCheckedAt] = useState("");
  const [zone, setZone] = useState("");
  const [office, setOffice] = useState("");
  const [queryReference, setQueryReference] = useState("");
  const [ownerNames, setOwnerNames] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    startTransition(async () => {
      try {
        await recordPropertyAuthorityCheckAction(packetId, {
          titleNumber,
          verificationStatus: status,
          checkedAt,
          registryZone: zone,
          registryOffice: office,
          queryReference,
          ownerNames: ownerNames.split(","),
          sourceUrl,
          notes,
        });
        toast.success("Consulta SUNARP registrada");
        setShowForm(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo registrar la consulta");
      }
    });
  };

  return (
    <div className="space-y-4">
      <DetailGrid
        items={[
          { label: "Dirección", value: property.propertyAddress },
          { label: "Unidad", value: property.propertyUnit ?? "—" },
          { label: "Distrito", value: property.district ?? "—" },
          { label: "Provincia", value: property.province ?? "—" },
          { label: "Departamento", value: property.department ?? "—" },
        ]}
      />

      {uploadedEvidence.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">
            Documentos de autoridad aportados
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadedEvidence.map((evidence) => (
              evidence.signedUrl ? (
                <a
                  key={evidence.id}
                  href={evidence.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-secondary hover:bg-surface"
                >
                  <FileText className="size-4" /> Documento aportado
                  <ExternalLink className="size-3" />
                </a>
              ) : null
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted">
            Consultas oficiales registradas
          </p>
          {interactive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!showForm) {
                  setCheckedAt(new Date().toISOString().slice(0, 16));
                }
                setShowForm((value) => !value);
              }}
            >
              <Database className="mr-1 size-3.5" /> Registrar consulta
            </Button>
          )}
        </div>
        {checks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            No hay una consulta SUNARP registrada. Adjunte la referencia oficial consultada antes de decidir.
          </p>
        ) : (
          <div className="space-y-2">
            {checks.map((check) => (
              <div key={check.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold text-primary">
                      {check.provider} · Partida {check.titleNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {check.registryZone ?? "Zona no indicada"}
                      {check.registryOffice ? ` · ${check.registryOffice}` : ""}
                      {` · ${formatPeruDateTime(check.checkedAt)}`}
                    </p>
                  </div>
                  <Badge variant={
                    check.verificationStatus === "verified"
                      ? "success"
                      : check.verificationStatus === "not_found"
                        ? "error"
                        : "warning"
                  }>
                    {check.verificationStatus === "verified"
                      ? "Verificada"
                      : check.verificationStatus === "not_found"
                        ? "No encontrada"
                        : "Con observación"}
                  </Badge>
                </div>
                {check.ownerNames.length > 0 && (
                  <p className="mt-2 text-xs">
                    <span className="text-muted">Titular(es):</span> {check.ownerNames.join(", ")}
                  </p>
                )}
                {check.queryReference && (
                  <p className="mt-1 font-mono text-xs">
                    <span className="font-sans text-muted">Consulta:</span> {check.queryReference}
                  </p>
                )}
                {check.notes && <p className="mt-2 text-xs text-muted">{check.notes}</p>}
                {check.sourceUrl && (
                  <a
                    href={check.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                  >
                    Abrir constancia fuente <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Card className="bg-surface/20">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <AuthorityInput label="Número de partida *" value={titleNumber} onChange={setTitleNumber} />
            <label className="space-y-1 text-xs font-medium text-muted">
              Resultado *
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
              >
                <option value="verified">Titularidad verificada</option>
                <option value="observation">Con observación</option>
                <option value="not_found">Partida no encontrada</option>
              </select>
            </label>
            <AuthorityInput label="Fecha y hora de consulta *" type="datetime-local" value={checkedAt} onChange={setCheckedAt} />
            <AuthorityInput label="Referencia de consulta" value={queryReference} onChange={setQueryReference} />
            <AuthorityInput label="Zona registral" value={zone} onChange={setZone} />
            <AuthorityInput label="Oficina registral" value={office} onChange={setOffice} />
            <AuthorityInput label="Titulares (separados por coma)" value={ownerNames} onChange={setOwnerNames} />
            <AuthorityInput label="URL de constancia" type="url" value={sourceUrl} onChange={setSourceUrl} />
            <label className="space-y-1 text-xs font-medium text-muted sm:col-span-2">
              Observaciones
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
              />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={isPending || !titleNumber.trim() || !checkedAt}>
                {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
                Guardar evidencia SUNARP
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuthorityInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
      />
    </label>
  );
}

function SystemFlagRow({
  flag,
}: {
  flag: PacketEvidenceData["systemFlags"][number];
}) {
  const isCritical = flag.severity === "critical";
  const isWarning = flag.severity === "warning";
  return (
    <div className={cn(
      "flex items-start gap-2 rounded-md border p-3",
      isCritical
        ? "border-red-200 bg-red-50 text-red-800"
        : isWarning
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-blue-200 bg-blue-50 text-blue-800",
    )}>
      {isCritical || isWarning
        ? <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        : <Shield className="mt-0.5 size-4 shrink-0" />}
      <div>
        <p className="text-sm font-medium">{flag.title}</p>
        <p className="mt-0.5 text-xs opacity-80">{flag.detail}</p>
      </div>
    </div>
  );
}

function DecisionProcessingPanel({
  job,
}: {
  job: PacketEvidenceData["decisionJob"];
}) {
  const failed = job?.status === "failed";
  const activeDescription = job?.jobType === "prepare_physical_certificate"
    ? "VeraDoc está preparando la certificación y generando el reporte verificable."
    : job?.jobType === "finalize_physical_certification"
      ? "VeraDoc está publicando la certificación, creando la entrada registral y encolando las notificaciones."
      : "VeraDoc está generando el certificado, creando la entrada registral y encolando las notificaciones.";
  return (
    <Card className={failed ? "border-red-200 bg-red-50/40" : "border-blue-200 bg-blue-50/40"}>
      <CardContent className="flex items-start gap-3 p-4">
        {failed
          ? <AlertTriangle className="mt-0.5 size-5 text-red-600" />
          : <Loader2 className="mt-0.5 size-5 animate-spin text-blue-600" />}
        <div>
          <p className="text-sm font-semibold text-primary">
            {failed ? "La certificación requiere reintento" : "Certificación en procesamiento durable"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {failed
              ? job?.lastError ?? "El trabajo agotó sus intentos automáticos."
              : activeDescription}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailGrid({
  items,
}: {
  items: { label: string; value: string; mono?: boolean }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs font-medium text-muted">{item.label}</p>
          <p
            className={cn(
              "mt-0.5 text-sm text-primary",
              item.mono && "font-mono text-xs",
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function DocumentCard({
  label,
  doc,
}: {
  label: string;
  doc?: PacketEvidenceData["documents"][number];
}) {
  if (!doc) {
    return <p className="text-sm text-muted">Documento no disponible.</p>;
  }
  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-muted" />
            <div>
              <p className="text-sm font-medium text-primary">{label}</p>
              {doc.fileHash && (
                <HashDisplay hash={doc.fileHash} truncateChars={12} />
              )}
            </div>
          </div>
          {doc.signedUrl && (
            <a
              href={doc.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-secondary hover:underline"
            >
              Abrir en pestaña nueva
            </a>
          )}
        </div>
        {doc.signedUrl && (
          <PdfViewer
            url={doc.signedUrl}
            downloadUrl={doc.signedUrl}
            height="h-[500px]"
          />
        )}
      </CardContent>
    </Card>
  );
}

function SignerEvidenceSection({
  signer,
}: {
  signer: PacketEvidenceData["signers"][number];
}) {
  const roleLabel =
    signer.roleInLease === "landlord" ? "Arrendador" : "Arrendatario";

  const otpEvidence = signer.evidence.filter(
    (e) => e.evidenceType === "whatsapp_otp",
  );
  const consentEvidence = signer.evidence.filter(
    (e) => e.evidenceType === "consent_record",
  );
  const identityEvidence = signer.evidence.filter((e) =>
    ["dni_front", "dni_back", "selfie", "liveness"].includes(e.evidenceType),
  );
  const firmEasyEvidence = signer.evidence.filter(
    (e) => e.evidenceType === "firmeasy_signature",
  );

  return (
    <Card>
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="size-4 text-muted" />
          {signer.fullName}
          <span className="font-normal text-muted">· {roleLabel}</span>
          <Badge variant="muted" className="ml-auto text-xs">
            {signer.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Identity evidence */}
        {identityEvidence.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">
              {EVIDENCE_DETAILS.identidad}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {identityEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-md border border-border p-2"
                >
                  <p className="text-xs font-medium text-primary">
                    {evidenceTypeLabel(ev.evidenceType)}
                  </p>
                  {ev.signedUrl ? (
                    <a
                      href={ev.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group mt-2 block overflow-hidden rounded border border-border bg-surface/30"
                    >
                      {/* Signed evidence URLs are intentionally rendered directly so
                          sensitive images are not copied through the image optimizer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ev.signedUrl}
                        alt={`${evidenceTypeLabel(ev.evidenceType)} de ${signer.fullName}`}
                        loading="lazy"
                        className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                      <span className="flex items-center justify-between px-2 py-1.5 text-[10px] font-medium text-secondary">
                        Vista protegida · abrir imagen
                        <ImageIcon className="size-3" />
                      </span>
                    </a>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      {ev.storagePath ? "Archivo disponible" : "Pendiente"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp OTP */}
        {otpEvidence.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">
              {EVIDENCE_DETAILS.verificacionWhatsapp}
            </p>
            {otpEvidence.map((ev) => (
              <div key={ev.id} className="grid gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.canal}</p>
                  <p className="font-medium">
                    {(ev.metadata.channel as string) ?? "WhatsApp"}
                  </p>
                </div>
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.codigoEnviado}</p>
                  <p className="font-mono">
                    {formatPeruDateTime(ev.metadata.sentAt as string | null)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.verificadoEn}</p>
                  <p className="font-mono">
                    {formatPeruDateTime(ev.metadata.verifiedAt as string | null)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Consent */}
        {consentEvidence.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">
              {EVIDENCE_DETAILS.consentimiento}
            </p>
            {consentEvidence.map((ev) => (
              <div key={ev.id} className="grid gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.tipo}</p>
                  <p>{(ev.metadata.consentType as string) ?? "Consentimiento"}</p>
                </div>
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.aceptadoEn}</p>
                  <p className="font-mono">
                    {formatPeruDateTime(ev.metadata.acceptedAt as string | null)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.dispositivo}</p>
                  <p className="truncate font-mono">
                    {(ev.metadata.device as string) ?? (ev.metadata.ip as string) ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FirmEasy digital signature */}
        {firmEasyEvidence.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted">
              Firma digital (FirmEasy)
            </p>
            {firmEasyEvidence.map((ev) => (
              <div key={ev.id} className="grid gap-2 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-muted">Proveedor</p>
                  <p className="font-medium">
                    {(ev.metadata.provider as string) ?? "FirmEasy"}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Firmado</p>
                  <p className="font-mono">
                    {formatPeruDateTime(ev.metadata.signed_at as string | null)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">Verificación</p>
                  {ev.metadata.verification_url ? (
                    <a
                      href={ev.metadata.verification_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary hover:underline"
                    >
                      Verificar firma
                    </a>
                  ) : (
                    <p className="text-muted">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidBadge({
  label,
  value,
  good,
}: {
  label: string;
  value: string | null;
  good: string;
}) {
  const isGood = value === good;
  return (
    <div className="border-t border-border pt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <Badge variant={isGood ? "success" : value ? "error" : "muted"}>
        {value ?? "—"}
      </Badge>
    </div>
  );
}

function evidenceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    dni_front: EVIDENCE_DETAILS.dniFrente,
    dni_back: EVIDENCE_DETAILS.dniReverso,
    selfie: EVIDENCE_DETAILS.selfieLiveness,
    liveness: "Liveness",
    whatsapp_otp: EVIDENCE_DETAILS.verificacionWhatsapp,
    consent_record: EVIDENCE_DETAILS.consentimiento,
    property_authority: EVIDENCE_DETAILS.autoridadPropiedad,
    firmeasy_signature: "Firma digital (FirmEasy)",
  };
  return map[type] ?? type;
}
