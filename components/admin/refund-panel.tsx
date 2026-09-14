"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { refundPaymentAction } from "@/lib/actions/admin-payment-actions";

const REASON_CODES = [
  { value: "01", label: "01 — Anulación de operación" },
  { value: "02", label: "02 — Error en monto" },
  { value: "06", label: "06 — Devolución parcial" },
  { value: "07", label: "07 — Devolución total" },
] as const;

const POLICY_REASONS = [
  { value: "duplicate_charge", label: "Cobro duplicado" },
  { value: "incorrect_amount", label: "Monto cobrado incorrecto" },
  { value: "unauthorized_payment", label: "Pago no autorizado" },
  { value: "veradoc_failure", label: "Falla atribuible a VeraDoc" },
  { value: "mandatory_remedy", label: "Remedio exigido legalmente" },
] as const;

type RefundResult =
  | { type: "success"; refundId: string; refundedAmount: number }
  | { type: "error"; message: string };

export function RefundPanel() {
  const [isPending, startTransition] = useTransition();
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState<string>("01");
  const [reasonDescription, setReasonDescription] = useState("");
  const [policyReason, setPolicyReason] = useState<(typeof POLICY_REASONS)[number]["value"]>("duplicate_charge");
  const [approvalEvidence, setApprovalEvidence] = useState("");
  const [result, setResult] = useState<RefundResult | null>(null);

  const handleSubmit = () => {
    setResult(null);
    const parsedAmount = Number(amount);
    if (!paymentId.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setResult({ type: "error", message: "Complete el ID de pago y un monto válido." });
      return;
    }
    if (!reasonDescription.trim() || approvalEvidence.trim().length < 10) {
      setResult({ type: "error", message: "Ingrese el motivo y la evidencia de aprobación." });
      return;
    }

    startTransition(async () => {
      const response = await refundPaymentAction({
        paymentId: paymentId.trim(),
        requestId: crypto.randomUUID(),
        amountCentimos: Math.round(parsedAmount * 100),
        reasonCode: reasonCode as "01" | "02" | "06" | "07" | "09",
        reasonDescription: reasonDescription.trim(),
        policyReason,
        approvalEvidence: approvalEvidence.trim(),
      });

      if (response.error) {
        setResult({ type: "error", message: response.error });
        return;
      }

      setResult({
        type: "success",
        refundId: response.data!.refundId,
        refundedAmount: response.data!.refundedAmount,
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Procesar reembolso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          VeraDoc no ofrece reembolsos rutinarios. Esta operación requiere una excepción elegible,
          autoridad financiera y evidencia verificable.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Payment ID</span>
          <input
            type="text"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Monto (S/)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="150.00"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Código de motivo</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {REASON_CODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Excepción de política</span>
          <select
            value={policyReason}
            onChange={(e) => setPolicyReason(e.target.value as typeof policyReason)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {POLICY_REASONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Descripción del motivo</span>
          <textarea
            value={reasonDescription}
            onChange={(e) => setReasonDescription(e.target.value)}
            rows={3}
            maxLength={250}
            placeholder="Detalle del reembolso..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Evidencia de aprobación</span>
          <textarea
            value={approvalEvidence}
            onChange={(e) => setApprovalEvidence(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Referencia del caso, correo o decisión que autoriza la excepción..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <Button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Procesar reembolso
        </Button>

        {result?.type === "success" && (
          <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success">
            <p className="font-medium">Reembolso procesado</p>
            <p className="mt-1 font-mono text-xs">
              ID: {result.refundId} · S/ {result.refundedAmount.toFixed(2)}
            </p>
          </div>
        )}

        {result?.type === "error" && (
          <div className="rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
