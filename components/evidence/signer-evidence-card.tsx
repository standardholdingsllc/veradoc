"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import type { EvidenceReport, Signer } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import {
  EVIDENCE_DETAILS,
  ROLES,
  STATUS_LABELS,
  UI,
  VALIDATION_STATUS,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HashDisplay } from "./hash-display";

interface SignerEvidenceCardProps {
  signer: Signer;
  evidenceReport?: EvidenceReport;
  defaultExpanded?: boolean;
}

function statusVariant(
  value: string,
): "success" | "warning" | "error" | "muted" {
  if (
    value.includes("valid") ||
    value.includes("passed") ||
    value.includes("verified") ||
    value.includes("accepted") ||
    value === "complete"
  ) {
    return "success";
  }
  if (value.includes("pending") || value.includes("needs")) {
    return "warning";
  }
  if (value.includes("invalid") || value.includes("revoked")) {
    return "error";
  }
  return "muted";
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function SignerEvidenceCard({
  signer,
  evidenceReport,
  defaultExpanded = false,
}: SignerEvidenceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const otpRecord = evidenceReport?.otpRecords.find(
    (record) => record.signerId === signer.id,
  );
  const consentRecord = evidenceReport?.consentRecords.find(
    (record) => record.signerId === signer.id,
  );
  const signature = signer.signatureEvidence;
  const roleLabel =
    signer.roleInLease === "landlord" ? ROLES.landlord : ROLES.renter;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center gap-3 border-b border-border bg-surface/40 px-4 py-3 text-left transition-colors hover:bg-surface/70"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
        )}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <User className="size-4 text-muted" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">
            {signer.fullName}
          </p>
          <p className="font-mono text-xs text-muted">
            DNI {signer.dni} · {roleLabel}
          </p>
        </div>
        <Badge variant={statusVariant(signer.status)}>
          {STATUS_LABELS[signer.status as keyof typeof STATUS_LABELS] ??
            signer.status}
        </Badge>
      </button>

      {expanded ? (
        <CardContent className="p-0">
          <div className="border-b border-border px-4 py-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {EVIDENCE_DETAILS.verificacionWhatsapp}
            </h4>
            <dl>
              <DetailRow
                label={EVIDENCE_DETAILS.canal}
                value={otpRecord?.channel === "whatsapp" ? "WhatsApp" : (otpRecord?.channel ?? "WhatsApp")}
              />
              <DetailRow
                label={EVIDENCE_DETAILS.codigoEnviado}
                value={
                  otpRecord
                    ? formatDateTime(otpRecord.sentAt)
                    : "—"
                }
                mono
              />
              <DetailRow
                label={EVIDENCE_DETAILS.verificadoEn}
                value={
                  otpRecord
                    ? formatDateTime(otpRecord.verifiedAt)
                    : "—"
                }
                mono
              />
            </dl>
          </div>

          <div className="border-b border-border px-4 py-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {EVIDENCE_DETAILS.consentimiento}
            </h4>
            <dl>
              <DetailRow
                label={EVIDENCE_DETAILS.tipo}
                value={
                  consentRecord?.consentType === "arrendamiento_digital"
                    ? "Arrendamiento digital"
                    : (consentRecord?.consentType ?? "Arrendamiento digital")
                }
              />
              <DetailRow
                label={EVIDENCE_DETAILS.aceptadoEn}
                value={
                  consentRecord
                    ? formatDateTime(consentRecord.acceptedAt)
                    : signer.consentTimestamp
                      ? formatDateTime(signer.consentTimestamp)
                      : "—"
                }
                mono
              />
              <DetailRow
                label="IP"
                value={consentRecord?.ip ?? "—"}
                mono
              />
              <DetailRow
                label={EVIDENCE_DETAILS.dispositivo}
                value={consentRecord?.device ?? "—"}
              />
            </dl>
          </div>

          <div className="border-b border-border px-4 py-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              {EVIDENCE_DETAILS.identidad}
            </h4>
            <dl>
              <DetailRow
                label={EVIDENCE_DETAILS.dniFrente}
                value={
                  VALIDATION_STATUS[
                    signer.identityEvidence
                      .dniFrontStatus as keyof typeof VALIDATION_STATUS
                  ] ?? signer.identityEvidence.dniFrontStatus
                }
              />
              <DetailRow
                label={EVIDENCE_DETAILS.dniReverso}
                value={
                  VALIDATION_STATUS[
                    signer.identityEvidence
                      .dniBackStatus as keyof typeof VALIDATION_STATUS
                  ] ?? signer.identityEvidence.dniBackStatus
                }
              />
              <DetailRow
                label={EVIDENCE_DETAILS.selfieLiveness}
                value={
                  VALIDATION_STATUS[
                    signer.identityEvidence
                      .selfieLivenessStatus as keyof typeof VALIDATION_STATUS
                  ] ?? signer.identityEvidence.selfieLivenessStatus
                }
              />
              <DetailRow
                label={EVIDENCE_DETAILS.resultadoRevision}
                value={
                  VALIDATION_STATUS[
                    signer.identityEvidence
                      .reviewStatus as keyof typeof VALIDATION_STATUS
                  ] ?? signer.identityEvidence.reviewStatus
                }
              />
            </dl>
          </div>

          {signature ? (
            <div className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                {EVIDENCE_DETAILS.firmaDigital}
              </h4>
              <dl>
                <DetailRow
                  label={EVIDENCE_DETAILS.proveedor}
                  value={signature.providerName}
                />
                <DetailRow
                  label={UI.estado}
                  value={
                    VALIDATION_STATUS[
                      signature.signatureStatus as keyof typeof VALIDATION_STATUS
                    ] ?? signature.signatureStatus
                  }
                />
                <DetailRow
                  label={EVIDENCE_DETAILS.sujetoCertificado}
                  value={signature.certificateSubject}
                  mono
                />
                <DetailRow
                  label={EVIDENCE_DETAILS.emisorCertificado}
                  value={signature.certificateIssuer}
                  mono
                />
                <DetailRow
                  label={EVIDENCE_DETAILS.numeroSerie}
                  value={
                    <HashDisplay
                      hash={signature.certificateSerial}
                      truncateChars={12}
                    />
                  }
                />
              </dl>
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted">
              {VALIDATION_STATUS.pending}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
