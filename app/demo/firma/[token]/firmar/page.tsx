"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIONS,
  ERRORS,
  PAGE_TITLES,
  SIGNER,
  TOAST,
} from "@/lib/i18n/labels";
import { simulateSignature } from "@/lib/services/signer-service";
import { toast } from "sonner";

type SignPhase = "idle" | "processing" | "complete";

export default function SignerFirmarPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [phase, setPhase] = useState<SignPhase>("idle");
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

  function handleSign() {
    if (loading || phase !== "idle") {
      return;
    }

    setLoading(true);
    setPhase("processing");

    window.setTimeout(() => {
      try {
        simulateSignature(signer.id, packet.id);
        setPhase("complete");
        setLoading(false);
      } catch {
        toast.error(TOAST.errorGenerico);
        setPhase("idle");
        setLoading(false);
      }
    }, 1500);
  }

  function handleContinue() {
    router.push(`${basePath}/completado`);
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={6} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{PAGE_TITLES.firmaDigital}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {phase === "complete" ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="size-16 text-success" aria-hidden />
              <p className="text-lg font-semibold text-success">
                Firma completada exitosamente
              </p>
              <p className="text-sm text-muted">{SIGNER.firmaCompletada}</p>
              <Button
                className="mt-2 h-12 min-h-12 w-full text-base"
                size="lg"
                onClick={handleContinue}
              >
                Continuar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface p-6 text-center">
                <PenLine className="size-10 text-secondary" aria-hidden />
                <p className="text-base font-medium">
                  {ACTIONS.continuarConFirma}
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  Será redirigido al proveedor de firma digital IOFE para
                  completar su firma electrónica.
                </p>
              </div>

              {phase === "processing" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2
                    className="size-10 animate-spin text-secondary"
                    aria-hidden
                  />
                  <p className="text-sm text-muted">Procesando firma…</p>
                </div>
              ) : (
                <Button
                  className="h-12 min-h-12 w-full text-base"
                  size="lg"
                  disabled={loading}
                  onClick={handleSign}
                >
                  Firmar documento
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
