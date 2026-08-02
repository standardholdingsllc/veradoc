"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  type EvidenceSectionId,
} from "@/components/evidence/evidence-section-nav";
import { DocumentHashTimeline } from "@/components/evidence/document-hash-timeline";
import { HashDisplay } from "@/components/evidence/hash-display";
import {
  startReviewAction,
  type PacketEvidenceData,
} from "@/lib/actions/notary";
import { ProductionChecklistPanel } from "@/components/notary/checklist-panel";
import { ProductionDecisionPanel, DecisionResultSummary } from "@/components/notary/decision-panel";
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  if (status === "certified") return "bg-green-50 text-green-700";
  if (status === "under_review") return "bg-blue-50 text-blue-700";
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
  const [activeSection, setActiveSection] = useState<EvidenceSectionId>("summary");
  const [isPending, startTransition] = useTransition();

  const isPreview = data.packet.status === "pending_notary";
  const isUnderReview = data.packet.status === "under_review";
  const isTerminal = ["certified", "needs_correction", "rejected"].includes(
    data.packet.status,
  );

  const checklistKeys = Object.keys(CHECKLIST);
  const allChecked =
    checklistKeys.length > 0 &&
    checklistKeys.every((key) => data.checklist[key]?.checked === true);

  const statusLabel =
    (STATUS_LABELS as Record<string, string>)[data.packet.status] ??
    data.packet.status;

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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSectionSelect = (id: EvidenceSectionId) => {
    setActiveSection(id);
    scrollTo(id);
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/notario"
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
          <div className="sticky top-14">
            <EvidenceSectionNav
              activeSection={activeSection}
              onSectionSelect={handleSectionSelect}
              showDecision={!isPreview}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-8 px-4 py-6 md:px-8">
          {/* 1. Summary */}
          <Section id="summary" number={1} title={EVIDENCE.resumenPaquete}>
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
                { label: "Fecha inicio", value: formatDate(data.packet.leaseStartDate) },
                { label: "Fecha fin", value: formatDate(data.packet.leaseEndDate) },
                { label: "Enviado al notario", value: formatDateTime(data.packet.submittedAt) },
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
                            { label: EVIDENCE_DETAILS.periodoValidez, value: `${formatDate(signer.signatureRecord!.certificateValidFrom)} → ${formatDate(signer.signatureRecord!.certificateValidTo)}`, mono: true },
                            ...(signer.signatureRecord!.providerSignedAt ? [{ label: "Firmado en", value: formatDateTime(signer.signatureRecord!.providerSignedAt), mono: true as const }] : []),
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
            <DetailGrid
              items={[
                { label: "Dirección", value: data.packet.propertyAddress },
                { label: "Unidad", value: data.packet.propertyUnit ?? "—" },
                { label: "Distrito", value: data.packet.district ?? "—" },
                { label: "Provincia", value: data.packet.province ?? "—" },
                { label: "Departamento", value: data.packet.department ?? "—" },
              ]}
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
                        ` Desde: ${formatDate(data.duplicateCheck.earliestStart)}`}
                      {data.duplicateCheck.latestEnd &&
                        ` Hasta: ${formatDate(data.duplicateCheck.latestEnd)}`}
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
                          {formatDateTime(event.createdAt)}
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
            {data.duplicateCheck.overlapCount > 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="size-4" />
                Superposición de registro detectada.
              </div>
            ) : (
              <p className="text-sm text-green-700">
                Sin banderas del sistema.
              </p>
            )}
          </Section>

          {/* 12. Checklist */}
          <Section id="checklist" number={12} title={EVIDENCE.listaVerificacion}>
            <ProductionChecklistPanel
              packetId={data.packet.id}
              checklistData={data.checklist}
              interactive={isUnderReview}
            />
          </Section>

          {/* 13. Decision panel */}
          {!isPreview && (
            <Section id="decision" number={13} title={EVIDENCE.panelDecision}>
              {isTerminal ? (
                <DecisionResultSummary
                  decision={data.assignment.decision ?? undefined}
                  observations={data.assignment.observations ?? undefined}
                  decidedAt={data.assignment.decidedAt ?? undefined}
                />
              ) : isUnderReview && allChecked ? (
                <ProductionDecisionPanel packetId={data.packet.id} />
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
                      className="mt-1 inline-block text-xs text-secondary hover:underline"
                    >
                      Ver imagen
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
                    {formatDateTime(ev.metadata.sentAt as string | null)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">{EVIDENCE_DETAILS.verificadoEn}</p>
                  <p className="font-mono">
                    {formatDateTime(ev.metadata.verifiedAt as string | null)}
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
                    {formatDateTime(ev.metadata.acceptedAt as string | null)}
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
                    {formatDateTime(ev.metadata.signed_at as string | null)}
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
