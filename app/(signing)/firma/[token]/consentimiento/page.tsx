"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileCheck, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { hasPassedStep } from "@/lib/domain/production-signer-machine";
import { recordConsentAction } from "@/lib/actions/signing";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/legal/consent-text";

export default function ConsentPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasPassedStep(ctx.signerStatus, 3)) {
      router.replace(`/firma/${ctx.token}/identidad`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  async function handleSubmit() {
    if (!accepted) return;
    setSubmitting(true);
    try {
      const result = await recordConsentAction(
        ctx.token,
        navigator.userAgent,
        CONSENT_VERSION,
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Consentimiento registrado");
        router.push(`/firma/${ctx.token}/identidad`);
      }
    } catch {
      toast.error("Error al registrar consentimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProductionStepProgress currentStep={3} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="size-5 text-secondary" />
            <CardTitle>Consentimiento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lea detenidamente el siguiente consentimiento para el tratamiento de
            sus datos personales y la presentación notarial.
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {CONSENT_TEXT}
            </pre>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-secondary"
            />
            <span className="text-sm">
              He leído y acepto los términos del consentimiento para el
              tratamiento de mis datos personales.
            </span>
          </label>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!accepted || submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 size-4" />
            )}
            Aceptar y continuar
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
