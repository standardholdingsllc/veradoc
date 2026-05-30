"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { AuditTrail } from "@/components/evidence/audit-trail";
import { DocumentHashTimeline } from "@/components/evidence/document-hash-timeline";
import {
  EVIDENCE_SECTIONS,
  EvidenceSectionNav,
  type EvidenceSectionId,
} from "@/components/evidence/evidence-section-nav";
import { HashDisplay } from "@/components/evidence/hash-display";
import { SignatureValidationPanel } from "@/components/evidence/signature-validation-panel";
import { SignerEvidenceCard } from "@/components/evidence/signer-evidence-card";
import { ChecklistPanel } from "@/components/notary/checklist-panel";
import {
  DecisionPanel,
  DecisionResultSummary,
} from "@/components/notary/decision-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPacketById } from "@/lib/services/packet-service";
import { startReview } from "@/lib/services/notary-service";
import { checkDuplicate } from "@/lib/services/registry-service";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/formatters";
import {
  ACTIONS,
  DOCUMENT,
  EVIDENCE,
  EVIDENCE_DETAILS,
  FORMS,
  PAGE_TITLES,
  REGISTRY,
  TOAST,
  UI,
} from "@/lib/i18n/labels";
import { usePacketById, usePackets, useUsers } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

function EvidenceSection({
  id,
  title,
  children,
  className,
}: {
  id: EvidenceSectionId;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const sectionIndex = EVIDENCE_SECTIONS.findIndex((section) => section.id === id);

  return (
    <section
      id={id}
      className={cn("scroll-mt-28 border-b border-border pb-10 last:border-b-0", className)}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface font-mono text-xs font-semibold text-muted">
          {sectionIndex + 1}
        </span>
        <h2 className="text-base font-semibold text-primary">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function DetailGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; mono?: boolean }[];
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-border bg-surface/30 px-3 py-2.5"
        >
          <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 text-sm text-foreground",
              item.mono && "font-mono text-xs",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentPreviewCard({
  fileName,
  timestamp,
  hash,
  timestampLabel,
}: {
  fileName: string;
  timestamp: string;
  hash: string;
  timestampLabel: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex aspect-[4/3] max-h-48 items-center justify-center rounded-md border border-dashed border-border bg-surface">
          <div className="text-center">
            <FileText
              className="mx-auto size-10 text-muted"
              aria-hidden="true"
            />
            <p className="mt-2 text-xs text-muted">{DOCUMENT.vistaPrevia}</p>
          </div>
        </div>
        <DetailGrid
          items={[
            { label: DOCUMENT.nombreArchivo, value: fileName },
            {
              label: timestampLabel,
              value: formatDateTime(timestamp),
              mono: true,
            },
            {
              label: UI.hash,
              value: <HashDisplay hash={hash} />,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

const SYSTEM_FLAG_LABELS: Record<string, string> = {
  duplicate_address_warning: REGISTRY.alertaDuplicado,
  identity_review_flagged: "Revisión de identidad marcada para verificación adicional",
  sunarp_observation: "Observación SUNARP pendiente de verificación",
};

export default function NotaryEvidenceReviewPage() {
  const params = useParams<{ packetId: string }>();
  const packetId = params.packetId;
  const [activeSection, setActiveSection] =
    useState<EvidenceSectionId>("summary");
  const [startingReview, setStartingReview] = useState(false);
  const [, setRefreshKey] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const packet = usePacketById(packetId);
  const users = useUsers();
  const allPackets = usePackets();

  const registryMatches = useMemo(() => {
    if (!packet) {
      return [];
    }
    return checkDuplicate(packet.property.normalizedAddressKey);
  }, [packet]);

  const isPreviewMode = packet?.status === "ready_for_notary";
  const isUnderReview = packet?.status === "under_notary_review";
  const isDecisionComplete =
    packet?.notaryReview?.status === "complete" &&
    packet.notaryReview.decision !== undefined;

  const checklistComplete = useMemo(() => {
    const checklist = packet?.notaryReview?.reviewChecklist ?? [];
    return checklist.length > 0 && checklist.every((item) => item.checked);
  }, [packet?.notaryReview?.reviewChecklist]);

  const showDecisionPanel = isUnderReview && checklistComplete;
  const showDecisionSection =
    isUnderReview || isDecisionComplete || packet?.status === "certified" ||
    packet?.status === "certified_with_observations" ||
    packet?.status === "needs_correction" ||
    packet?.status === "rejected";

  const realtorName =
    users.find((user) => user.id === packet?.createdByRealtorId)?.fullName ??
    "—";

  const hashEntries =
    packet?.evidenceReport?.documentHashHistory ?? packet?.documentHashes ?? [];

  const handleSectionSelect = useCallback((id: EvidenceSectionId) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleStartReview = useCallback(async () => {
    if (!packetId || startingReview) {
      return;
    }
    setStartingReview(true);
    try {
      startReview(packetId);
      toast.success(TOAST.revisionIniciada);
      setRefreshKey((key) => key + 1);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setStartingReview(false);
    }
  }, [packetId, startingReview]);

  if (!packet) {
    const fallback = getPacketById(packetId);
    if (!fallback) {
      return (
        <div className="px-6 py-8">
          <p className="text-sm text-muted">Paquete no encontrado.</p>
          <Link
            href="/demo/notario"
            className="mt-4 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
          >
            <ArrowLeft className="size-4" />
            {ACTIONS.volverAlPanel}
          </Link>
        </div>
      );
    }
  }

  if (!packet) {
    return null;
  }

  const propertyLabel = packet.property.unit
    ? `${packet.property.address}, ${packet.property.unit} — ${packet.property.district}`
    : `${packet.property.address} — ${packet.property.district}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <Link
              href="/demo/notario"
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-secondary"
            >
              <ArrowLeft className="size-3" />
              {ACTIONS.volverAlPanel}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-lg font-semibold text-primary">
                {packet.packetCode}
              </h1>
              <StatusBadge status={packet.status} />
              {isPreviewMode ? (
                <Badge variant="warning" className="gap-1">
                  <Eye className="size-3" aria-hidden="true" />
                  Vista previa — solo lectura
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">{propertyLabel}</p>
          </div>
          <p className="text-xs text-muted">{PAGE_TITLES.revisionEvidencia}</p>
        </div>

        {isPreviewMode ? (
          <div className="border-t border-border bg-warning/5 px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-sm text-foreground">
                  Expediente en modo vista previa. Inicie la revisión para activar
                  la lista de verificación y el panel de decisión.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartReview}
                disabled={startingReview}
              >
                {startingReview ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {ACTIONS.iniciarRevision}
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[200px] shrink-0 border-r border-border bg-surface/30 lg:block">
          <div className="sticky top-[var(--notary-header-offset,120px)] max-h-[calc(100vh-120px)] overflow-y-auto">
            <EvidenceSectionNav
              activeSection={activeSection}
              onSectionSelect={handleSectionSelect}
              showDecision={showDecisionSection}
            />
          </div>
        </aside>

        <div ref={mainRef} className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {packet.evidenceReport?.summaryForNotary ? (
            <Card className="mb-8 border-secondary/30 bg-secondary/5">
              <CardContent className="pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {EVIDENCE.resumenParaNotario}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {packet.evidenceReport.summaryForNotary}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <EvidenceSection id="summary" title={EVIDENCE.resumenPaquete}>
            <DetailGrid
              items={[
                { label: UI.codigo, value: packet.packetCode, mono: true },
                { label: UI.version, value: `v${packet.version}`, mono: true },
                {
                  label: UI.fechaCreacion,
                  value: formatDateTime(packet.createdAt),
                  mono: true,
                },
                { label: "Agente inmobiliario", value: realtorName },
                { label: UI.propiedad, value: propertyLabel },
                {
                  label: FORMS.rentaMensual,
                  value: formatCurrency(
                    packet.leaseTerms.monthlyRent,
                    packet.leaseTerms.currency,
                  ),
                },
                {
                  label: FORMS.deposito,
                  value: formatCurrency(
                    packet.leaseTerms.depositAmount,
                    packet.leaseTerms.currency,
                  ),
                },
                {
                  label: FORMS.fechaInicio,
                  value: formatDate(packet.leaseTerms.startDate),
                  mono: true,
                },
                {
                  label: FORMS.fechaVencimiento,
                  value: formatDate(packet.leaseTerms.expirationDate),
                  mono: true,
                },
                {
                  label: FORMS.duracion,
                  value: `${packet.leaseTerms.durationMonths} meses`,
                },
                { label: UI.estado, value: <StatusBadge status={packet.status} /> },
              ]}
            />
          </EvidenceSection>

          <EvidenceSection id="lease-document" title={EVIDENCE.documentoArrendamiento}>
            <DocumentPreviewCard
              fileName={packet.leaseDocument.fileName}
              timestamp={packet.leaseDocument.uploadedAt}
              hash={packet.leaseDocument.initialHash}
              timestampLabel={DOCUMENT.fechaCarga}
            />
          </EvidenceSection>

          <EvidenceSection id="signed-document" title={EVIDENCE.documentoFirmado}>
            {packet.finalSignedDocument ? (
              <DocumentPreviewCard
                fileName={packet.finalSignedDocument.fileName}
                timestamp={packet.finalSignedDocument.generatedAt}
                hash={packet.finalSignedDocument.hash}
                timestampLabel={DOCUMENT.fechaGeneracion}
              />
            ) : (
              <p className="rounded-md border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
                Pendiente de firma
              </p>
            )}
          </EvidenceSection>

          <EvidenceSection id="signer-evidence" title={EVIDENCE.evidenciaFirmante}>
            <div className="space-y-3">
              {packet.signers.map((signer, index) => (
                <SignerEvidenceCard
                  key={signer.id}
                  signer={signer}
                  evidenceReport={packet.evidenceReport}
                  defaultExpanded={index === 0}
                />
              ))}
            </div>
          </EvidenceSection>

          <EvidenceSection id="signature-validation" title={EVIDENCE.validacionFirma}>
            <SignatureValidationPanel
              signers={packet.signers}
              evidenceReport={packet.evidenceReport}
            />
          </EvidenceSection>

          <EvidenceSection id="hash-history" title={EVIDENCE.historialHashes}>
            <DocumentHashTimeline entries={hashEntries} />
          </EvidenceSection>

          <EvidenceSection id="property-evidence" title={EVIDENCE.evidenciaPropiedad}>
            <DetailGrid
              items={[
                { label: FORMS.direccion, value: packet.property.address },
                { label: FORMS.distrito, value: packet.property.district },
                { label: FORMS.unidad, value: packet.property.unit ?? "—" },
                {
                  label: EVIDENCE_DETAILS.sunarpPlaceholder,
                  value: packet.property.sunarpRecordPlaceholder ?? "—",
                },
                {
                  label: EVIDENCE_DETAILS.autoridadPropiedad,
                  value:
                    packet.evidenceReport?.propertyAuthorityEvidence ??
                    packet.property.propertyAuthorityEvidence ??
                    "—",
                },
              ]}
            />
          </EvidenceSection>

          <EvidenceSection id="registry-check" title={EVIDENCE.verificacionRegistro}>
            {packet.registryCheck.matchFound ||
            packet.evidenceReport?.duplicateRentalCheck.matchFound ||
            registryMatches.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4">
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-warning">
                      {REGISTRY.alertaDuplicado}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {packet.registryCheck.matchDetails ??
                        packet.evidenceReport?.duplicateRentalCheck.details ??
                        REGISTRY.explicacion}
                    </p>
                    {registryMatches.map((match) => {
                      const matchedPacket = allPackets.find(
                        (entry) => entry.id === match.packetId,
                      );
                      return (
                        <div
                          key={match.id}
                          className="mt-3 rounded-md border border-border bg-background p-3 text-sm"
                        >
                          <p className="font-mono font-medium text-primary">
                            {matchedPacket?.packetCode ?? match.packetId}
                          </p>
                          <p className="text-muted">{match.propertyAddress}</p>
                          <p className="mt-1 font-mono text-xs text-muted">
                            {formatDate(match.leaseStartDate)} —{" "}
                            {formatDate(match.leaseExpirationDate)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-border bg-surface/50 px-4 py-6 text-sm text-muted">
                Sin coincidencias en el registro activo
              </p>
            )}
          </EvidenceSection>

          <EvidenceSection id="audit-trail" title={EVIDENCE.registrosSesion}>
            <AuditTrail events={packet.auditEvents} users={users} />
          </EvidenceSection>

          <EvidenceSection id="system-flags" title={EVIDENCE.banderasSistema}>
            {packet.evidenceReport?.systemFlags.length ? (
              <div className="space-y-2">
                {packet.evidenceReport.systemFlags.map((flag) => (
                  <div
                    key={flag}
                    className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/5 p-4"
                  >
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-foreground">
                      {SYSTEM_FLAG_LABELS[flag] ?? flag}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Sin banderas del sistema</p>
            )}
          </EvidenceSection>

          <EvidenceSection id="checklist" title={EVIDENCE.listaVerificacion}>
            <ChecklistPanel
              packetId={packet.id}
              notaryReview={packet.notaryReview}
              interactive={isUnderReview}
              onToggle={() => setRefreshKey((key) => key + 1)}
            />
          </EvidenceSection>

          {showDecisionSection ? (
            <EvidenceSection id="decision" title={EVIDENCE.panelDecision}>
              {showDecisionPanel ? (
                <DecisionPanel packetId={packet.id} />
              ) : isUnderReview && !checklistComplete ? (
                <p className="rounded-md border border-border bg-surface/50 px-4 py-6 text-sm text-muted">
                  Complete todos los elementos de la lista de verificación para
                  habilitar el panel de decisión.
                </p>
              ) : (
                <DecisionResultSummary
                  decision={packet.notaryReview?.decision}
                  observations={packet.notaryReview?.observations}
                  rejectionReason={packet.notaryReview?.rejectionReason}
                  correctionReason={packet.notaryReview?.correctionReason}
                  certifiedAt={
                    packet.notaryReview?.certifiedAt
                      ? formatDateTime(packet.notaryReview.certifiedAt)
                      : undefined
                  }
                />
              )}
            </EvidenceSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
