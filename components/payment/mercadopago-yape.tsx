"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { processYapePaymentAction } from "@/lib/actions/payment-actions";
import type { ProcessPaymentResult } from "@/lib/services/mercadopago/types";

interface MercadoPagoYapeProps {
  publicKey: string;
  paymentId: string;
  amount: number;
  payerEmail?: string;
  onResult: (result: ProcessPaymentResult) => void;
  onProcessing: (processing: boolean) => void;
}

export function MercadoPagoYape({
  publicKey,
  paymentId,
  amount,
  payerEmail,
  onResult,
  onProcessing,
}: MercadoPagoYapeProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpRef = useRef<any>(null);

  const handleSdkLoad = useCallback(() => {
    setSdkReady(true);
  }, []);

  useEffect(() => {
    if (!sdkReady) return;
    if (typeof window !== "undefined" && "MercadoPago" in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mpRef.current = new (window as any).MercadoPago(publicKey, { locale: "es-PE" });
    }
  }, [sdkReady, publicKey]);

  const isValid = phoneNumber.length === 9 && otp.length === 6 && !!payerEmail;

  const handleSubmit = async () => {
    if (!mpRef.current || !isValid || submitting) return;
    setSubmitting(true);
    onProcessing(true);

    try {
      const yapeToken = await mpRef.current
        .yape({ otp, phoneNumber })
        .create();

      let deviceSessionId: string | undefined;
      try {
        deviceSessionId = await mpRef.current.getDeviceSessionId();
      } catch {
        /* non-critical */
      }

      const result = await processYapePaymentAction({
        paymentId,
        token: yapeToken.id,
        payerEmail: payerEmail || "",
        deviceSessionId,
      });

      if (result.error) {
        onResult({ status: "error", errorDetail: result.error });
      } else if (result.data) {
        onResult(result.data);
      }
    } catch {
      onResult({ status: "error", errorDetail: "Error procesando pago con Yape." });
    } finally {
      setSubmitting(false);
      onProcessing(false);
    }
  };

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        onReady={handleSdkLoad}
        strategy="lazyOnload"
      />

      {!sdkReady ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Cargando...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted">Paga con Yape</p>
            <p className="mt-1 text-sm text-muted">
              Ingresa tu número de celular y el código de aprobación de 6 dígitos
              que genera la app de Yape.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="yape-phone">Número de celular</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">+51</span>
              <Input
                id="yape-phone"
                type="tel"
                inputMode="numeric"
                maxLength={9}
                placeholder="9 dígitos"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="yape-otp">Código de aprobación</Label>
            <Input
              id="yape-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 dígitos"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={submitting}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!isValid || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {submitting ? "Procesando..." : `Pagar S/ ${amount.toFixed(2)} con Yape`}
          </Button>
        </div>
      )}
    </>
  );
}
