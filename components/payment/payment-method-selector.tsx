"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CreditCard, Loader2 } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MercadoPagoCardForm } from "./mercadopago-card-form";
import { MercadoPagoYape } from "./mercadopago-yape";
import { ThreeDSChallenge } from "./three-ds-challenge";
import { pollPaymentStatusAction } from "@/lib/actions/payment-actions";
import type { MercadoPago3DSInfo, ProcessPaymentResult } from "@/lib/services/mercadopago/types";
import { formatCurrency } from "@/lib/formatters";

const PAYMENT_TABS = [
  { id: "card", label: "Tarjeta" },
  { id: "yape", label: "Yape" },
];

interface PaymentMethodSelectorProps {
  publicKey: string;
  paymentId: string;
  amountCentimos: number;
  payerEmail?: string;
  onCompleted: () => void;
  onRetryPrepare: () => Promise<{ paymentId: string; existingStatus?: string } | null>;
}

export function PaymentMethodSelector({
  publicKey,
  paymentId: initialPaymentId,
  amountCentimos,
  payerEmail,
  onCompleted,
  onRetryPrepare,
}: PaymentMethodSelectorProps) {
  const [activeTab, setActiveTab] = useState("card");
  const [processing, setProcessing] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState(initialPaymentId);
  const [status, setStatus] = useState<
    "idle" | "requires_3ds" | "polling" | "completed" | "rejected"
  >("idle");
  const [threeDSInfo, setThreeDSInfo] = useState<NonNullable<MercadoPago3DSInfo> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleResultRef = useRef<(result: ProcessPaymentResult) => void>(() => {});

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startProcessingPoll = useCallback(() => {
    if (pollRef.current) return;
    setStatus("polling");

    pollRef.current = setInterval(async () => {
      try {
        const result = await pollPaymentStatusAction(currentPaymentId);
        if (result.data && result.data.status !== "processing") {
          stopPolling();
          handleResultRef.current(result.data);
        } else if (result.error) {
          stopPolling();
          handleResultRef.current({ status: "error", errorDetail: result.error });
        }
      } catch {
        /* keep polling */
      }
    }, 4_000);

    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setErrorMessage("El pago esta tardando demasiado. Revisa tu estado de pago o intenta de nuevo.");
      setStatus("rejected");
    }, 2 * 60 * 1000);
  }, [currentPaymentId, stopPolling]);

  const handleResult = useCallback((result: ProcessPaymentResult) => {
    switch (result.status) {
      case "completed":
        setStatus("completed");
        setErrorMessage(null);
        onCompleted();
        break;
      case "requires_action":
        if (result.threeDSInfo) {
          setThreeDSInfo(result.threeDSInfo);
          setStatus("requires_3ds");
        } else {
          setErrorMessage("Se requiere verificacion 3DS pero no se recibio informacion.");
          setStatus("rejected");
        }
        break;
      case "processing":
        startProcessingPoll();
        break;
      case "rejected":
        setErrorMessage(result.errorDetail ?? "El pago fue rechazado.");
        setStatus("rejected");
        break;
      case "error":
        setErrorMessage(result.errorDetail ?? "Error inesperado.");
        setStatus("rejected");
        break;
    }
  }, [onCompleted, startProcessingPoll]);

  useEffect(() => {
    handleResultRef.current = handleResult;
  }, [handleResult]);

  const [retrying, setRetrying] = useState(false);
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const fresh = await onRetryPrepare();
      if (fresh) {
        setCurrentPaymentId(fresh.paymentId);
        const s = fresh.existingStatus;
        if (s === "processing" || s === "requires_action") {
          setErrorMessage(null);
          startProcessingPoll();
        } else {
          setStatus("idle");
          setErrorMessage(null);
        }
      }
    } finally {
      setRetrying(false);
    }
  }, [onRetryPrepare, startProcessingPoll]);

  const amountSoles = amountCentimos / 100;

  // ── Completed state ──────────────────────────────────────────────────
  if (status === "completed") {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-6 text-center">
        <Check className="mx-auto mb-2 size-6 text-success" />
        <p className="text-sm font-medium text-success">Pago confirmado exitosamente.</p>
      </div>
    );
  }

  // ── 3DS challenge state ──────────────────────────────────────────────
  if (status === "requires_3ds" && threeDSInfo) {
    return (
      <ThreeDSChallenge
        paymentId={currentPaymentId}
        threeDSInfo={threeDSInfo}
        onResult={(result) => {
          setThreeDSInfo(null);
          handleResult(result);
        }}
      />
    );
  }

  // ── Polling state ─────────────────────────────────────────────────────
  if (status === "polling") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface/50 p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Procesando tu pago...</p>
        <p className="text-xs text-muted">Esto puede tomar unos segundos.</p>
      </div>
    );
  }

  // ── Payment method selection ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface/50 p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">Total a pagar</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-primary">
          {formatCurrency(amountCentimos / 100)}
        </p>
      </div>

      {errorMessage && status === "rejected" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Pago rechazado</p>
              <p className="text-xs">{errorMessage}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={retrying}
            onClick={handleRetry}
          >
            {retrying && <Loader2 className="mr-2 size-4 animate-spin" />}
            Intentar de nuevo
          </Button>
        </div>
      )}

      <Tabs
        tabs={PAYMENT_TABS}
        activeTab={activeTab}
        onTabChange={(id) => {
          if (!processing) {
            setActiveTab(id);
            setErrorMessage(null);
            setStatus("idle");
          }
        }}
      >
        {activeTab === "card" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <CreditCard className="size-3.5" />
              Tarjeta de crédito o débito
            </div>
            <MercadoPagoCardForm
              key={currentPaymentId}
              publicKey={publicKey}
              paymentId={currentPaymentId}
              amount={amountSoles}
              payerEmail={payerEmail}
              onResult={handleResult}
              onProcessing={setProcessing}
            />
          </div>
        )}
        {activeTab === "yape" && (
          <MercadoPagoYape
            key={currentPaymentId}
            publicKey={publicKey}
            paymentId={currentPaymentId}
            amount={amountSoles}
            payerEmail={payerEmail}
            onResult={handleResult}
            onProcessing={setProcessing}
          />
        )}
      </Tabs>
    </div>
  );
}
