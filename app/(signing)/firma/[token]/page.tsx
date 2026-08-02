"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { getResumeRoute } from "@/lib/domain/production-signer-machine";

export default function SigningLandingPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const resumeRoute = getResumeRoute(ctx.signerStatus);
    if (resumeRoute) {
      router.replace(`/firma/${ctx.token}${resumeRoute}`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  const roleLabel = ctx.roleInLease === "landlord" ? "Arrendador" : "Arrendatario";

  function handleStart() {
    setStarting(true);
    router.push(`/firma/${ctx.token}/verificar`);
  }

  if (getResumeRoute(ctx.signerStatus)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <ProductionStepProgress currentStep={0} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-secondary" />
            <CardTitle>Firma de contrato</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ha sido invitado a firmar un contrato de arrendamiento. Complete los
            siguientes pasos para verificar su identidad y firmar digitalmente.
          </p>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propiedad</span>
              <span className="font-medium">{ctx.propertyAddress}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Agente</span>
              <span className="font-medium">{ctx.realtorName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Su rol</span>
              <span className="font-medium">{roleLabel}</span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 size-4" />
            )}
            Comenzar verificación
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
