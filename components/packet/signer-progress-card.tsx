"use client";

import { SIGNER_STEPS, getSignerStepIndex } from "@/lib/domain/signer-machine";
import { SIGNER_STATUS_CONFIG } from "@/lib/domain/constants";
import type { Signer } from "@/lib/domain/types";
import { FORMS, ROLES } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export interface SignerProgressCardProps {
  signer: Signer;
  className?: string;
}

const ROLE_VARIANT = {
  landlord: "success",
  renter: "info",
} as const;

export function SignerProgressCard({ signer, className }: SignerProgressCardProps) {
  const stepIndex = getSignerStepIndex(signer.status);
  const currentStep =
    stepIndex >= 0 ? SIGNER_STEPS[stepIndex] : null;
  const statusConfig = SIGNER_STATUS_CONFIG[signer.status];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm">{signer.fullName}</CardTitle>
            <p className="font-mono text-xs text-muted">
              {FORMS.dni}: {signer.dni}
            </p>
          </div>
          <Badge variant={ROLE_VARIANT[signer.roleInLease]}>
            {signer.roleInLease === "landlord"
              ? ROLES.landlord
              : ROLES.renter}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Estado actual</span>
          <StatusBadge status={signer.status} />
        </div>

        {currentStep ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Paso del flujo</span>
              <span className="font-medium">
                {currentStep.label} ({stepIndex + 1}/{SIGNER_STEPS.length})
              </span>
            </div>

            <div className="flex gap-1">
              {SIGNER_STEPS.map((step, index) => (
                <div
                  key={step.key}
                  className={cn(
                    "h-1.5 flex-1 rounded-sm",
                    index <= stepIndex ? "bg-secondary" : "bg-surface",
                  )}
                  title={step.label}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-error">
            {statusConfig?.label ?? signer.status}
          </p>
        )}

        <dl className="grid gap-1 border-t border-border pt-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">{FORMS.correoElectronico}</dt>
            <dd className="truncate font-mono">{signer.email}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">{FORMS.whatsapp}</dt>
            <dd className="font-mono">{signer.whatsapp}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
