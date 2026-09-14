"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveNotaryMonthlyPayout,
  confirmNotaryMonthlyPayout,
  markNotaryPayoutPaid,
  setNotaryContractedRate,
} from "@/lib/admin/actions";

interface NotaryOption {
  id: string;
  full_name: string;
  email: string;
}

interface RateRow {
  id: string;
  notary_id: string;
  participation_bps: number;
  formula_version: string;
  protect_standard_price_for_promos: boolean;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  contract_reference: string | null;
  created_at: string;
}

interface PayoutRow {
  id: string;
  notary_id: string;
  period_month: string;
  certification_count: number;
  gross_amount: number;
  currency: string;
  status: string;
  prepared_at: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notary_comprobante_reference: string | null;
  contractual_amount_centimos: number;
  promo_top_up_centimos: number;
  notary_igv_centimos: number;
  notes: string | null;
}

function previousMonth(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function NotaryPayouts({
  notaries,
  rates,
  payouts,
}: {
  notaries: NotaryOption[];
  rates: RateRow[];
  payouts: PayoutRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedNotary, setSelectedNotary] = useState(notaries[0]?.id ?? "");
  const [rate, setRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [contractReference, setContractReference] = useState("");
  const [periodMonth, setPeriodMonth] = useState(previousMonth);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [comprobanteReferences, setComprobanteReferences] = useState<Record<string, string>>({});
  const [notaryIgvAmounts, setNotaryIgvAmounts] = useState<Record<string, string>>({});

  const notaryNames = useMemo(
    () => new Map(notaries.map((notary) => [notary.id, notary.full_name || notary.email])),
    [notaries],
  );

  const runAction = (
    action: () => Promise<{ error?: string }>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participación contractual</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <NotarySelect value={selectedNotary} onChange={setSelectedNotary} notaries={notaries} />
            <Field label="Porcentaje de MND" type="number" value={rate} onChange={setRate} min="0.01" step="0.01" />
            <Field label="Vigente desde" type="date" value={effectiveFrom} onChange={setEffectiveFrom} />
            <Field label="Referencia contractual" value={contractReference} onChange={setContractReference} placeholder="Contrato / adenda" />
            <Button
              className="sm:col-span-2"
              disabled={isPending || !selectedNotary || Number(rate) <= 0}
              onClick={() => runAction(
                () => setNotaryContractedRate(
                  selectedNotary,
                  Number(rate),
                  effectiveFrom,
                  contractReference,
                ),
                "Participación contractual guardada",
              )}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Guardar nueva vigencia
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preparar cierre mensual</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <NotarySelect value={selectedNotary} onChange={setSelectedNotary} notaries={notaries} />
            <Field label="Mes" type="month" value={periodMonth} onChange={setPeriodMonth} />
            <label className="space-y-1 text-xs font-medium text-muted sm:col-span-2">
              Notas del cierre
              <textarea
                value={payoutNotes}
                onChange={(event) => setPayoutNotes(event.target.value)}
                rows={2}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
              />
            </label>
            <Button
              variant="secondary"
              className="sm:col-span-2"
              disabled={isPending || !selectedNotary || !periodMonth}
              onClick={() => runAction(
                () => confirmNotaryMonthlyPayout(selectedNotary, periodMonth, payoutNotes),
                "Cierre mensual preparado",
              )}
            >
              {isPending
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : <CheckCircle2 className="mr-2 size-4" />}
              Preparar monto del mes
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historial de participación</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-xs uppercase text-muted">
              <th className="px-5 py-3">Notario</th><th className="px-5 py-3">Participación</th>
              <th className="px-5 py-3">Vigencia</th><th className="px-5 py-3">Contrato</th>
            </tr></thead>
            <tbody>
              {rates.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">{notaryNames.get(row.notary_id) ?? row.notary_id.slice(0, 8)}</td>
                  <td className="px-5 py-3 font-mono">
                    {(row.participation_bps / 100).toFixed(2)}% MND
                    {row.protect_standard_price_for_promos && <span className="block text-xs text-muted">promo protegido por VeraDoc</span>}
                  </td>
                  <td className="px-5 py-3">{row.effective_from} → {row.effective_to ?? "vigente"}</td>
                  <td className="px-5 py-3 text-muted">{row.contract_reference ?? "—"}</td>
                </tr>
              ))}
              {rates.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-muted">No hay participaciones configuradas.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4" /> Pagos mensuales</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-xs uppercase text-muted">
              <th className="px-5 py-3">Mes</th><th className="px-5 py-3">Notario</th>
              <th className="px-5 py-3 text-right">Certificaciones</th><th className="px-5 py-3 text-right">Monto</th>
              <th className="px-5 py-3">Estado / desembolso</th>
            </tr></thead>
            <tbody>
              {payouts.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-5 py-3 font-mono">{row.period_month.slice(0, 7)}</td>
                  <td className="px-5 py-3">{notaryNames.get(row.notary_id) ?? row.notary_id.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-right">{row.certification_count}</td>
                  <td className="px-5 py-3 text-right font-mono">
                    S/ {(Number(row.gross_amount) + row.notary_igv_centimos / 100).toFixed(2)}
                    <span className="block text-xs text-muted">
                      contrato S/ {(row.contractual_amount_centimos / 100).toFixed(2)}
                      {row.promo_top_up_centimos > 0 && ` + VeraDoc S/ ${(row.promo_top_up_centimos / 100).toFixed(2)}`}
                      {row.notary_igv_centimos > 0 && ` + IGV S/ ${(row.notary_igv_centimos / 100).toFixed(2)}`}
                    </span>
                  </td>
                  <td className="min-w-64 px-5 py-3">
                    <Badge variant={row.status === "paid" ? "success" : row.status === "void" ? "error" : "info"}>
                      {row.status === "paid" ? "Pagado" : row.status === "void" ? "Anulado" : row.status === "prepared" ? "Preparado" : "Aprobado"}
                    </Badge>
                    {row.status === "prepared" && (
                      <div className="mt-2 grid gap-2">
                        <input
                          value={comprobanteReferences[row.id] ?? ""}
                          onChange={(event) => setComprobanteReferences((current) => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="Comprobante del notario"
                          className="rounded border border-border px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={notaryIgvAmounts[row.id] ?? "0"}
                          onChange={(event) => setNotaryIgvAmounts((current) => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="IGV del notario (S/)"
                          className="rounded border border-border px-2 py-1 text-xs"
                        />
                        <Button
                          size="sm"
                          disabled={isPending || !(comprobanteReferences[row.id] ?? "").trim()}
                          onClick={() => runAction(
                            () => approveNotaryMonthlyPayout(
                              row.id,
                              comprobanteReferences[row.id] ?? "",
                              Number(notaryIgvAmounts[row.id] ?? "0"),
                            ),
                            "Desembolso aprobado",
                          )}
                        >Aprobar</Button>
                      </div>
                    )}
                    {row.status === "confirmed" ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={paymentReferences[row.id] ?? ""}
                          onChange={(event) => setPaymentReferences((current) => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="Operación bancaria"
                          className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-xs"
                        />
                        <Button
                          size="sm"
                          disabled={isPending || !(paymentReferences[row.id] ?? "").trim()}
                          onClick={() => runAction(
                            () => markNotaryPayoutPaid(row.id, paymentReferences[row.id] ?? ""),
                            "Desembolso registrado",
                          )}
                        >Marcar pagado</Button>
                      </div>
                    ) : (
                      row.status !== "prepared" && <p className="mt-1 font-mono text-xs text-muted">{row.payment_reference ?? row.notary_comprobante_reference ?? "—"}</p>
                    )}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">No hay cierres mensuales confirmados.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function NotarySelect({
  value,
  onChange,
  notaries,
}: {
  value: string;
  onChange: (value: string) => void;
  notaries: NotaryOption[];
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted sm:col-span-2">
      Notario
      <select value={value} onChange={(event) => onChange(event.target.value)} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary">
        {notaries.map((notary) => <option key={notary.id} value={notary.id}>{notary.full_name || notary.email}</option>)}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
        {...inputProps}
      />
    </label>
  );
}
