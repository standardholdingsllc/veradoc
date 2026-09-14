"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pollPaymentStatusAction } from "@/lib/actions/payment-actions";
import type { MercadoPago3DSInfo, ProcessPaymentResult } from "@/lib/services/mercadopago/types";

const CHALLENGE_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 3_000;

interface ThreeDSChallengeProps {
  paymentId: string;
  threeDSInfo: NonNullable<MercadoPago3DSInfo>;
  onResult: (result: ProcessPaymentResult) => void;
}

export function ThreeDSChallenge({
  paymentId,
  threeDSInfo,
  onResult,
}: ThreeDSChallengeProps) {
  const [timedOut, setTimedOut] = useState(false);
  const [polling, setPolling] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    setPolling(true);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await pollPaymentStatusAction(paymentId);
        if (result.data && result.data.status !== "requires_action" && result.data.status !== "processing") {
          stopPolling();
          setPolling(false);
          onResult(result.data);
        } else if (result.error) {
          stopPolling();
          setPolling(false);
          onResult({ status: "error", errorDetail: result.error });
        }
      } catch {
        /* keep polling */
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setPolling(false);
      setTimedOut(true);
    }, CHALLENGE_TIMEOUT_MS);
  }, [paymentId, onResult, stopPolling]);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    // Auto-submit the hidden form to POST creq to the 3DS challenge URL
    requestAnimationFrame(() => {
      formRef.current?.submit();
    });

    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleIframeLoad = useCallback(() => {
    startPolling();
  }, [startPolling]);

  if (timedOut) {
    return (
      <div className="space-y-4 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">
          El tiempo de verificación 3D Secure ha expirado.
        </p>
        <p className="text-xs text-muted">
          Tu pago no fue procesado. Puedes intentar de nuevo.
        </p>
        <Button
          variant="outline"
          onClick={() => onResult({ status: "rejected", errorDetail: "Tiempo de verificación expirado." })}
        >
          Volver a intentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface/50 p-4 text-center">
        <p className="text-sm font-medium">Verificación de seguridad del banco</p>
        <p className="mt-1 text-xs text-muted">
          Completa la verificación 3D Secure en el formulario de tu banco a continuación.
        </p>
      </div>

      {polling && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted">
          <Loader2 className="size-3 animate-spin" />
          Esperando confirmación...
        </div>
      )}

      {/* Hidden form that POSTs creq to the 3DS challenge URL inside the iframe */}
      <form
        ref={formRef}
        method="POST"
        action={threeDSInfo.external_resource_url}
        target="mp-3ds-iframe"
        className="hidden"
      >
        <input type="hidden" name="creq" value={threeDSInfo.creq} />
      </form>

      <iframe
        ref={iframeRef}
        name="mp-3ds-iframe"
        title="3D Secure Challenge"
        className="h-[500px] w-full rounded-md border border-border"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}
