"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  DOCUMENT,
  ERRORS,
  FORMS,
  PAGE_TITLES,
  TOAST,
  UI,
} from "@/lib/i18n/labels";
import { reviewLease } from "@/lib/services/signer-service";
import { cn } from "@/lib/utils";

const DEMO_PAGE_COUNT = 12;

const PAST_REVIEW_STATUSES = new Set([
  "lease_reviewed",
  "signature_started",
  "signed",
  "complete",
]);

export default function SignerRevisionPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (context && PAST_REVIEW_STATUSES.has(context.signer.status)) {
      router.replace(`${context.basePath}/firmar`);
    }
  }, [context, router]);

  if (!context) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted">{ERRORS.enlaceInvalido}</p>
        </CardContent>
      </Card>
    );
  }

  const { basePath, packet, signer, propertyAddress } = context;

  if (PAST_REVIEW_STATUSES.has(signer.status)) {
    return null;
  }

  function handleContinue() {
    if (!reviewed || loading) {
      return;
    }

    setLoading(true);
    try {
      reviewLease(signer.id, packet.id);
      router.push(`${basePath}/firmar`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={5} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{PAGE_TITLES.revisionContrato}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{UI.propiedad}</dt>
              <dd className="font-medium">{propertyAddress}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{FORMS.rentaMensual}</dt>
              <dd className="font-medium">
                {formatCurrency(packet.leaseTerms.monthlyRent)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{UI.arrendamiento}</dt>
              <dd className="font-medium">
                {formatDate(packet.leaseTerms.startDate)} —{" "}
                {formatDate(packet.leaseTerms.expirationDate)}
              </dd>
            </div>
          </dl>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-surface p-6">
              <FileText className="size-12 text-muted" aria-hidden />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {packet.leaseDocument.fileName}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {DEMO_PAGE_COUNT} páginas · {DOCUMENT.vistaPrevia}
                </p>
              </div>
            </div>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
              "transition-colors has-[:checked]:border-secondary has-[:checked]:bg-secondary/5",
            )}
          >
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-secondary"
            />
            <span className="text-sm leading-relaxed">
              He revisado el contrato completo de arrendamiento
            </span>
          </label>

          <Button
            className="h-12 min-h-12 w-full text-base"
            size="lg"
            disabled={!reviewed || loading}
            onClick={handleContinue}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            Continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
