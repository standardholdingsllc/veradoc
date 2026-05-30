"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERRORS, PAGE_TITLES, SIGNER, TOAST } from "@/lib/i18n/labels";
import { verifyOtp } from "@/lib/services/signer-service";
import { cn } from "@/lib/utils";

const PAST_OTP_STATUSES = new Set([
  "otp_verified",
  "account_created",
  "consent_accepted",
  "identity_uploaded",
  "identity_verified_demo",
  "lease_reviewed",
  "signature_started",
  "signed",
  "complete",
]);

export default function SignerVerificarPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (context && PAST_OTP_STATUSES.has(context.signer.status)) {
      router.replace(`${context.basePath}/crear-cuenta`);
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

  const { basePath, packet, signer } = context;

  if (PAST_OTP_STATUSES.has(signer.status)) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim() || loading) {
      return;
    }

    setLoading(true);
    try {
      verifyOtp(signer.id, packet.id, code.trim());
      toast.success(TOAST.otpVerificado);
      router.push(`${basePath}/crear-cuenta`);
    } catch {
      toast.error(ERRORS.otpInvalido);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={1} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{PAGE_TITLES.verificacionWhatsapp}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex items-start gap-3 rounded-md bg-surface p-4">
              <MessageCircle
                className="mt-0.5 size-5 shrink-0 text-secondary"
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-muted">
                {SIGNER.codigoWhatsapp}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="otp" className="text-sm font-medium">
                {SIGNER.ingreseCodigo}
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={cn(
                  "h-14 w-full rounded-md border border-border bg-background px-4",
                  "text-center text-2xl font-semibold tracking-[0.4em]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30",
                )}
              />
              <p className="text-center text-xs text-muted">
                Use 123456 para la demostración
              </p>
            </div>

            <Button
              type="submit"
              className="h-12 min-h-12 w-full text-base"
              size="lg"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : null}
              Verificar código
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
