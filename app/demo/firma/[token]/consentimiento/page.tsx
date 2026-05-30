"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERRORS, SIGNER, TOAST } from "@/lib/i18n/labels";
import { acceptConsent } from "@/lib/services/signer-service";
import { cn } from "@/lib/utils";

const CONSENT_PARAGRAPHS = [
  "Al continuar, acepto que mis datos personales y evidencia de identidad sean procesados por VeraDoc.pe y presentados a un notario para revisión del paquete de arrendamiento.",
  "Acepto que la evidencia recopilada forme parte del Paquete de Evidencia Notarial.",
] as const;

export default function SignerConsentimientoPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!context) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted">{ERRORS.enlaceInvalido}</p>
        </CardContent>
      </Card>
    );
  }

  const { basePath, packet, signer } = context;

  function handleContinue() {
    if (!accepted || loading) {
      return;
    }

    setLoading(true);
    try {
      acceptConsent(signer.id, packet.id);
      toast.success(TOAST.consentimientoAceptado);
      router.push(`${basePath}/identidad`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={3} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {SIGNER.consentimientoTitulo}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
            {CONSENT_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
              "transition-colors has-[:checked]:border-secondary has-[:checked]:bg-secondary/5",
            )}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-secondary"
            />
            <span className="text-sm leading-relaxed">
              Acepto los términos de procesamiento de datos y presentación
              notarial
            </span>
          </label>

          <Button
            className="h-12 min-h-12 w-full text-base"
            size="lg"
            disabled={!accepted || loading}
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
