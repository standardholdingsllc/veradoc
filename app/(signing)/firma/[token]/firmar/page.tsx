"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PenLine, Loader2, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { initiateSignatureAction, completeSignatureAction } from "@/lib/actions/signing";
import { pollSignerStatus } from "@/lib/actions/firmeasy-status-poll";

type SigningState =
  | "idle"
  | "initiating"
  | "redirecting"
  | "signing_local"
  | "completing"
  | "waiting_webhook"
  | "success";

export default function DigitalSignaturePage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [state, setState] = useState<SigningState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ctx.signerStatus === "signed" || ctx.signerStatus === "complete") {
      router.replace(`/firma/${ctx.token}/completado`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  // Poll for status if waiting for webhook
  useEffect(() => {
    if (state !== "waiting_webhook") return;
    const interval = setInterval(async () => {
      const result = await pollSignerStatus(ctx.token);
      if (result.status === "signed" || result.status === "complete") {
        setState("success");
        toast.success("Documento firmado exitosamente");
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, ctx.token]);

  async function handleInitiate() {
    setState("initiating");
    setError(null);
    try {
      const result = await initiateSignatureAction(ctx.token);
      if (result.error) {
        setError(result.error);
        setState("idle");
        return;
      }

      setSessionId(result.sessionId ?? null);

      if (result.embedUrl) {
        // FirmEasy flow: redirect user to signing provider
        setEmbedUrl(result.embedUrl);
        setState("redirecting");
      } else {
        // Dev stub flow: local signing
        setState("signing_local");
      }
    } catch {
      setError("Error al iniciar la firma.");
      setState("idle");
    }
  }

  function handleRedirect() {
    if (embedUrl) {
      window.location.href = embedUrl;
    }
  }

  async function handleLocalSign() {
    if (!sessionId) return;
    setState("completing");
    setError(null);
    try {
      const result = await completeSignatureAction(ctx.token, sessionId);
      if (result.error) {
        setError(result.error);
        setState("signing_local");
        return;
      }
      setState("success");
      toast.success("Documento firmado exitosamente");
    } catch {
      setError("Error al completar la firma.");
      setState("signing_local");
    }
  }

  function handleContinue() {
    router.push(`/firma/${ctx.token}/completado`);
  }

  return (
    <>
      <ProductionStepProgress currentStep={6} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PenLine className="size-5 text-secondary" />
            <CardTitle>Firma digital</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                Al firmar, el documento será firmado digitalmente conforme a la
                normativa IOFE del Perú. Su firma tendrá validez legal
                equivalente a una firma manuscrita.
              </p>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium">{ctx.signerName}</p>
                <p className="text-xs text-muted-foreground">
                  {ctx.roleInLease === "landlord" ? "Arrendador" : "Arrendatario"} — {ctx.propertyAddress}
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" onClick={handleInitiate}>
                <PenLine className="mr-2 size-4" />
                Firmar documento
              </Button>
            </>
          )}

          {state === "initiating" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-secondary" />
              <p className="text-sm text-muted-foreground">
                Preparando firma digital...
              </p>
            </div>
          )}

          {state === "redirecting" && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <ExternalLink className="mx-auto mb-2 size-8 text-secondary" />
                <p className="text-sm font-medium">
                  Será redirigido a la plataforma de firma
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Complete el proceso de firma en FirmEasy. Será redirigido
                  automáticamente al finalizar.
                </p>
              </div>

              <Button className="w-full" onClick={handleRedirect}>
                <ExternalLink className="mr-2 size-4" />
                Ir a firmar
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline"
                onClick={() => setState("waiting_webhook")}
              >
                Ya firmé y regresé aquí
              </button>
            </>
          )}

          {state === "signing_local" && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <PenLine className="mx-auto mb-2 size-8 text-secondary" />
                <p className="text-sm font-medium">Firma lista para aplicar</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Presione el botón para aplicar su firma digital al documento.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" onClick={handleLocalSign}>
                <PenLine className="mr-2 size-4" />
                Aplicar firma digital
              </Button>
            </>
          )}

          {state === "completing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-secondary" />
              <p className="text-sm text-muted-foreground">
                Aplicando firma digital y verificando certificado...
              </p>
            </div>
          )}

          {state === "waiting_webhook" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-secondary" />
              <p className="text-sm text-muted-foreground text-center">
                Estamos procesando tu firma. Esto puede tomar unos segundos...
              </p>
              <p className="text-xs text-muted-foreground">
                No cierres esta página.
              </p>
            </div>
          )}

          {state === "success" && (
            <>
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="size-12 text-success" />
                <p className="text-base font-medium">Documento firmado</p>
                <p className="text-sm text-muted-foreground text-center">
                  Su firma digital ha sido aplicada exitosamente al contrato de
                  arrendamiento.
                </p>
              </div>

              <Button className="w-full" onClick={handleContinue}>
                <ArrowRight className="mr-2 size-4" />
                Continuar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
