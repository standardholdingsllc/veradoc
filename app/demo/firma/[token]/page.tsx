"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import {
  ACTIONS,
  ERRORS,
  FORMS,
  META,
  SIGNER,
  TOAST,
  UI,
} from "@/lib/i18n/labels";
import { openLink } from "@/lib/services/signer-service";

export default function SignerInicioPage() {
  const router = useRouter();
  const context = useSignerContext();
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

  const { basePath, packet, signer, realtorName, propertyAddress } = context;

  function handleStart() {
    setLoading(true);
    try {
      if (signer.status === "link_sent") {
        openLink(signer.id, packet.id);
      }
      router.push(`${basePath}/verificar`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setLoading(false);
    }
  }

  const openingMessage = SIGNER.mensajeApertura.replace(
    "{direccion}",
    propertyAddress,
  );

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={0} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Firma de contrato</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-base leading-relaxed text-foreground">
            {openingMessage}
          </p>

          <dl className="flex flex-col gap-3 rounded-md bg-surface p-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{FORMS.direccion}</dt>
              <dd className="font-medium">{propertyAddress}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">Agente inmobiliario</dt>
              <dd className="font-medium">{realtorName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">Firmante</dt>
              <dd className="font-medium">{signer.fullName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{UI.arrendamiento}</dt>
              <dd className="font-medium">
                {formatDate(packet.leaseTerms.startDate)} —{" "}
                {formatDate(packet.leaseTerms.expirationDate)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-3 rounded-md border border-border bg-background p-4">
            <Shield className="size-5 shrink-0 text-secondary" aria-hidden />
            <div>
              <p className="text-sm font-medium">{META.siteName}</p>
              <p className="text-sm text-muted">Proceso seguro de verificación</p>
            </div>
          </div>

          <Button
            className="h-12 min-h-12 w-full text-base"
            size="lg"
            disabled={loading}
            onClick={handleStart}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : null}
            {ACTIONS.comenzarVerificacion}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
