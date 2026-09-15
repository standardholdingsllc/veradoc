"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { completeSigningAction } from "@/lib/actions/signing";
import { pollSignerStatus } from "@/lib/actions/firmeasy-status-poll";

export default function CompletionPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(ctx.signerStatus === "complete");
  const [allComplete, setAllComplete] = useState(false);
  const [waitingForWebhook, setWaitingForWebhook] = useState(
    ctx.signerStatus === "identity_verified",
  );

  // Initial state covers terminal statuses; the effect only performs the
  // asynchronous transition from FirmEasy's signed state.
  useEffect(() => {
    if (ctx.signerStatus === "complete") {
      return;
    }

    // If "signed" (webhook already fired), call completeSigningAction to finalize
    if (ctx.signerStatus === "signed") {
      let cancelled = false;
      async function markComplete() {
        setCompleting(true);
        try {
          const result = await completeSigningAction(ctx.token);
          if (cancelled) return;
          if (result.error) {
            toast.error(result.error);
          } else {
            setCompleted(true);
            setAllComplete(result.allComplete ?? false);
          }
        } catch {
          toast.error("Error al finalizar.");
        } finally {
          if (!cancelled) setCompleting(false);
        }
      }
      markComplete();
      return () => { cancelled = true; };
    }

  }, [ctx.signerStatus, ctx.token]);

  // Poll for webhook-driven status change
  useEffect(() => {
    if (!waitingForWebhook) return;
    const interval = setInterval(async () => {
      const result = await pollSignerStatus(ctx.token);
      if (result.status === "signed" || result.status === "complete") {
        setWaitingForWebhook(false);
        setCompleted(true);
        toast.success("¡Firma procesada exitosamente!");
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [waitingForWebhook, ctx.token]);

  const roleLabel = ctx.roleInLease === "landlord" ? "Arrendador" : "Arrendatario";
  const dashboardPath = ctx.roleInLease === "landlord" ? "/arrendador" : "/arrendatario";

  if (completing || waitingForWebhook) {
    return (
      <>
        <ProductionStepProgress currentStep={7} />
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="size-8 animate-spin text-secondary" />
          <p className="text-sm text-muted-foreground text-center">
            {waitingForWebhook
              ? "Estamos procesando tu firma. Esto puede tomar unos segundos..."
              : "Finalizando proceso..."}
          </p>
          {waitingForWebhook && (
            <p className="text-xs text-muted-foreground">
              No cierres esta página.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ProductionStepProgress currentStep={7} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" />
            <CardTitle>Proceso completado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="size-16 text-success" />
            <p className="text-base font-medium text-center">
              ¡Firma completada exitosamente!
            </p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Ha firmado el contrato de arrendamiento para{" "}
            <span className="font-medium text-foreground">
              {ctx.propertyAddress}
            </span>{" "}
            como <span className="font-medium text-foreground">{roleLabel}</span>.
          </p>

          {allComplete && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-sm text-success text-center">
                Todos los firmantes han completado el proceso. El paquete será
                enviado para revisión notarial.
              </p>
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Firmante</span>
              <span className="font-medium">{ctx.signerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium">{roleLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propiedad</span>
              <span className="font-medium">{ctx.propertyAddress}</span>
            </div>
          </div>

          {(completed || ctx.signerStatus === "complete") && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(dashboardPath)}
            >
              <ExternalLink className="mr-2 size-4" />
              Ir a mi panel
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
