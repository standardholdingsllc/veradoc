"use client";

import type { EvidenceReport, Signer } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { EVIDENCE_DETAILS, ROLES, VALIDATION_STATUS } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HashDisplay } from "./hash-display";

interface SignatureValidationPanelProps {
  signers: Signer[];
  evidenceReport?: EvidenceReport;
  className?: string;
}

function validationBadge(
  value: string,
  positive: string[],
): "success" | "error" | "warning" {
  if (positive.includes(value)) {
    return "success";
  }
  if (value === "unknown" || value === "missing") {
    return "warning";
  }
  return "error";
}

function ValidationBadge({
  value,
  positiveValues,
  labelMap,
}: {
  value: string;
  positiveValues: string[];
  labelMap: Record<string, string>;
}) {
  const variant = validationBadge(value, positiveValues);
  return (
    <Badge variant={variant}>
      {labelMap[value as keyof typeof labelMap] ?? value}
    </Badge>
  );
}

export function SignatureValidationPanel({
  signers,
  evidenceReport,
  className,
}: SignatureValidationPanelProps) {
  const signersWithSignature = signers.filter((signer) => signer.signatureEvidence);

  if (signersWithSignature.length === 0) {
    return (
      <p className="text-sm text-muted">{VALIDATION_STATUS.pending}</p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {signersWithSignature.map((signer) => {
        const signature =
          evidenceReport?.signatureValidationResults.find(
            (result) => result.signerId === signer.id,
          )?.details ?? signer.signatureEvidence!;

        const roleLabel =
          signer.roleInLease === "landlord" ? ROLES.landlord : ROLES.renter;

        return (
          <Card key={signer.id}>
            <CardHeader className="border-b border-border bg-surface/30 pb-3">
              <CardTitle className="text-sm">
                {signer.fullName}
                <span className="ml-2 font-normal text-muted">· {roleLabel}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {EVIDENCE_DETAILS.sujetoCertificado}
                  </p>
                  <p className="font-mono text-xs leading-relaxed text-foreground">
                    {signature.certificateSubject}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {EVIDENCE_DETAILS.emisorCertificado}
                  </p>
                  <p className="font-mono text-xs leading-relaxed text-foreground">
                    {signature.certificateIssuer}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  {EVIDENCE_DETAILS.numeroSerie}
                </p>
                <HashDisplay hash={signature.certificateSerial} truncateChars={14} />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  {EVIDENCE_DETAILS.periodoValidez}
                </p>
                <p className="font-mono text-xs text-foreground">
                  {formatDate(signature.certificateValidityStart)} →{" "}
                  {formatDate(signature.certificateValidityEnd)}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {EVIDENCE_DETAILS.cadenaCertificados}
                  </p>
                  <ValidationBadge
                    value={signature.certificateChainResult}
                    positiveValues={["valid"]}
                    labelMap={{
                      valid: "Válida",
                      invalid: "Inválida",
                      unknown: VALIDATION_STATUS.unknown,
                    }}
                  />
                </div>
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {EVIDENCE_DETAILS.revocacion}
                  </p>
                  <ValidationBadge
                    value={signature.revocationResult}
                    positiveValues={["good"]}
                    labelMap={VALIDATION_STATUS}
                  />
                </div>
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {EVIDENCE_DETAILS.timestamp}
                  </p>
                  <ValidationBadge
                    value={signature.timestampResult}
                    positiveValues={["valid"]}
                    labelMap={VALIDATION_STATUS}
                  />
                </div>
                <div className="rounded-md border border-border bg-surface/40 p-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {EVIDENCE_DETAILS.integridadPdf}
                  </p>
                  <ValidationBadge
                    value={signature.pdfIntegrityResult}
                    positiveValues={["intact"]}
                    labelMap={VALIDATION_STATUS}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  {EVIDENCE_DETAILS.hashDocumentoFirmado}
                </p>
                <HashDisplay hash={signature.finalDocumentHash} />
                <p className="mt-2 font-mono text-xs text-muted">
                  {formatDateTime(signature.signedAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
