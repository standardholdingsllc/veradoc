"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIONS, ERRORS } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export default function SignerCompletadoPage() {
  const context = useSignerContext();

  if (!context) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted">{ERRORS.enlaceInvalido}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={7} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <CheckCircle2 className="size-20 text-success" aria-hidden />

          <div className="flex flex-col gap-3">
            <h1 className="text-xl font-semibold">Su firma ha sido registrada</h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Recibirá acceso al contrato certificado una vez que el notario
              complete su revisión.
            </p>
          </div>

          <Link
            href="/demo"
            className={cn(
              "mt-4 inline-flex h-12 min-h-12 w-full items-center justify-center rounded-md",
              "border border-border bg-transparent px-6 text-base font-medium text-primary",
              "transition-colors hover:bg-surface",
            )}
          >
            {ACTIONS.volverAlPanel}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
