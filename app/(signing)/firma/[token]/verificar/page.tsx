"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { hasPassedStep } from "@/lib/domain/production-signer-machine";
import { sendOtpAction, verifyOtpSubmission } from "@/lib/actions/signing";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasPassedStep(ctx.signerStatus, 1)) {
      router.replace(`/firma/${ctx.token}/crear-cuenta`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSendOtp() {
    setSending(true);
    setError(null);
    try {
      const result = await sendOtpAction(ctx.token);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setOtpSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success("Código enviado a su WhatsApp");
        inputRef.current?.focus();
      }
    } catch {
      setError("Error al enviar el código. Intente nuevamente.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== OTP_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyOtpSubmission(ctx.token, otp);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        setOtp("");
        inputRef.current?.focus();
      } else {
        toast.success("Verificación exitosa");
        router.push(`/firma/${ctx.token}/crear-cuenta`);
      }
    } catch {
      setError("Error al verificar el código.");
    } finally {
      setVerifying(false);
    }
  }

  const maskedPhone = ctx.signerWhatsapp
    ? `***${ctx.signerWhatsapp.slice(-4)}`
    : "su número registrado";

  return (
    <>
      <ProductionStepProgress currentStep={1} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-secondary" />
            <CardTitle>Verificación WhatsApp</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!otpSent ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enviaremos un código de 6 dígitos a su WhatsApp ({maskedPhone})
                para verificar su identidad.
              </p>
              <Button
                className="w-full"
                onClick={handleSendOtp}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <MessageCircle className="mr-2 size-4" />
                )}
                Enviar código
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ingrese el código de 6 dígitos enviado a su WhatsApp ({maskedPhone}).
              </p>

              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={OTP_LENGTH}
                placeholder="000000"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                  setOtp(val);
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={otp.length !== OTP_LENGTH || verifying}
              >
                {verifying ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 size-4" />
                )}
                Verificar código
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={handleSendOtp}
                disabled={cooldown > 0 || sending}
              >
                {cooldown > 0
                  ? `Reenviar código (${cooldown}s)`
                  : "Reenviar código"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
