"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { processCardPaymentAction } from "@/lib/actions/payment-actions";
import type { ProcessPaymentResult } from "@/lib/services/mercadopago/types";

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

interface MercadoPagoInstance {
  cardForm: (config: CardFormConfig) => CardFormInstance;
  getDeviceSessionId: () => Promise<string>;
}

interface CardFormConfig {
  amount: string;
  iframe?: boolean;
  form: {
    id: string;
    [key: string]: string | { id: string; placeholder?: string };
  };
  callbacks: {
    onFormMounted?: (error?: unknown) => void;
    onSubmit?: (event: Event) => void;
    onFetching?: (resource: string) => () => void;
    onError?: (error: unknown) => void;
  };
}

interface CardFormInstance {
  getCardFormData: () => CardFormData;
  unmount: () => void;
}

interface CardFormData {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  amount: string;
  installments: string;
  cardholderEmail: string;
  identificationNumber: string;
  identificationType: string;
}

interface MercadoPagoCardFormProps {
  publicKey: string;
  paymentId: string;
  amount: number;
  payerEmail?: string;
  onResult: (result: ProcessPaymentResult) => void;
  onProcessing: (processing: boolean) => void;
}

export function MercadoPagoCardForm({
  publicKey,
  paymentId,
  amount,
  payerEmail,
  onResult,
  onProcessing,
}: MercadoPagoCardFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cardFormRef = useRef<CardFormInstance | null>(null);
  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const submittingRef = useRef(false);

  const handleSdkLoad = useCallback(() => {
    setSdkReady(true);
  }, []);

  const handleSubmit = useCallback(async (cardForm: CardFormInstance) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    onProcessing(true);

    try {
      const formData = cardForm.getCardFormData();
      let deviceSessionId: string | undefined;
      try {
        deviceSessionId = await mpRef.current?.getDeviceSessionId();
      } catch {
        /* non-critical */
      }

      const result = await processCardPaymentAction({
        paymentId,
        token: formData.token,
        paymentMethodId: formData.paymentMethodId,
        issuerId: formData.issuerId || undefined,
        installments: Number(formData.installments) || 1,
        payerEmail: formData.cardholderEmail || payerEmail || "",
        payerIdentificationType: formData.identificationType || "DNI",
        payerIdentificationNumber: formData.identificationNumber,
        deviceSessionId,
      });

      if (result.error) {
        onResult({ status: "error", errorDetail: result.error });
      } else if (result.data) {
        onResult(result.data);
      }
    } catch {
      onResult({ status: "error", errorDetail: "Error inesperado procesando el pago." });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      onProcessing(false);
    }
  }, [paymentId, payerEmail, onResult, onProcessing]);

  useEffect(() => {
    if (!sdkReady || formMounted) return;

    const mp = new window.MercadoPago(publicKey, { locale: "es-PE" });
    mpRef.current = mp;

    const cardForm = mp.cardForm({
      amount: String(amount),
      iframe: true,
      form: {
        id: "mp-card-form",
        cardNumber: { id: "mp-card-number", placeholder: "Numero de tarjeta" },
        expirationDate: { id: "mp-expiration-date", placeholder: "MM/AA" },
        securityCode: { id: "mp-security-code", placeholder: "CVV" },
        cardholderName: { id: "mp-cardholder-name", placeholder: "Nombre en la tarjeta" },
        issuer: { id: "mp-issuer", placeholder: "Banco emisor" },
        installments: { id: "mp-installments", placeholder: "Cuotas" },
        identificationType: { id: "mp-doc-type", placeholder: "Tipo de documento" },
        identificationNumber: { id: "mp-doc-number", placeholder: "Numero de documento" },
        cardholderEmail: { id: "mp-email", placeholder: "Correo electronico" },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            console.error("[CardForm] Mount error:", error);
            return;
          }
          setFormMounted(true);
        },
        onSubmit: (event) => {
          event.preventDefault();
          void handleSubmit(cardForm);
        },
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      try {
        cardForm.unmount();
      } catch {
        /* unmount may throw if already cleaned up */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  return (
    <>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        onReady={handleSdkLoad}
        strategy="lazyOnload"
      />

      {!sdkReady && (
        <div className="flex items-center justify-center py-8 text-sm text-muted">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Cargando formulario de pago...
        </div>
      )}

      <form
        id="mp-card-form"
        className={sdkReady ? "space-y-4" : "hidden"}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <Label htmlFor="mp-card-number">Número de tarjeta</Label>
          <div id="mp-card-number" className="h-10 rounded-md border border-border" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mp-expiration-date">Vencimiento</Label>
            <div id="mp-expiration-date" className="h-10 rounded-md border border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-security-code">CVV</Label>
            <div id="mp-security-code" className="h-10 rounded-md border border-border" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mp-cardholder-name">Nombre en la tarjeta</Label>
          <Input id="mp-cardholder-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mp-issuer">Banco emisor</Label>
          <select
            id="mp-issuer"
            className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mp-installments">Cuotas</Label>
          <select
            id="mp-installments"
            className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mp-doc-type">Tipo de documento</Label>
            <select
              id="mp-doc-type"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-doc-number">Número de documento</Label>
            <Input id="mp-doc-number" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mp-email">Correo electrónico</Label>
          <Input id="mp-email" type="email" defaultValue={payerEmail} />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!formMounted || submitting}
        >
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {submitting ? "Procesando pago..." : `Pagar S/ ${amount.toFixed(2)}`}
        </Button>
      </form>
    </>
  );
}
