"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function AdminMfaClient() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepareFactor() {
      const supabase = createClient();
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (factorsError) {
        setError("No se pudo consultar la configuración MFA.");
        setLoading(false);
        return;
      }

      const verifiedFactor = factors.totp.find(
        (factor) => factor.status === "verified",
      );
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setLoading(false);
        return;
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "VeraDoc Admin",
      });
      if (cancelled) return;
      if (enrollError) {
        setError("No se pudo iniciar la inscripción MFA.");
      } else {
        setFactorId(data.id);
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
      }
      setLoading(false);
    }

    void prepareFactor();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify() {
    const selectedFactorId = enrollment?.factorId ?? factorId;
    if (!selectedFactorId || !/^\d{6}$/.test(code)) return;

    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({
        factorId: selectedFactorId,
      });
    if (challengeError) {
      setError("No se pudo iniciar la verificación MFA.");
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: selectedFactorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError("Código inválido o expirado.");
      setVerifying(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Acceso administrativo
            </span>
          </div>
          <CardTitle>Verificación en dos pasos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Preparando verificación…
            </div>
          ) : null}

          {enrollment ? (
            <div className="space-y-3 text-sm">
              <p>Escanee este código con su aplicación autenticadora.</p>
              <Image
                src={enrollment.qrCode}
                alt="Código QR para configurar TOTP"
                width={220}
                height={220}
                unoptimized
                className="mx-auto border border-border bg-white p-2"
              />
              <p className="break-all font-mono text-xs text-muted">
                Clave manual: {enrollment.secret}
              </p>
            </div>
          ) : null}

          {!loading && factorId ? (
            <div className="space-y-3">
              <label htmlFor="mfa-code" className="text-sm font-medium">
                Código de 6 dígitos
              </label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
              />
              <Button
                type="button"
                className="w-full"
                disabled={verifying || !/^\d{6}$/.test(code)}
                onClick={verify}
              >
                {verifying ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Verificar y continuar
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
