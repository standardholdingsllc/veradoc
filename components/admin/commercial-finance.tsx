"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createPrivatePromoCodeAction,
  recordPacketDirectCostAction,
  setPacketArchivalHoldAction,
} from "@/lib/admin/actions";
import type { PacketFinancialSummaryRow } from "@/lib/admin/queries";

const COST_CATEGORIES = [
  ["payment_processing", "Comisión de pago"],
  ["signing", "Firma"],
  ["messaging_email", "Correo"],
  ["messaging_whatsapp", "WhatsApp"],
  ["cpe", "CPE"],
  ["storage", "Almacenamiento"],
  ["refund_fee", "Comisión de reembolso"],
  ["chargeback_fee", "Comisión de contracargo"],
  ["other_approved_direct_cost", "Otro costo directo aprobado"],
] as const;

function futureDate(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function pen(centimos: number): string {
  return `S/ ${(centimos / 100).toFixed(2)}`;
}

export function CommercialFinance({ rows }: { rows: PacketFinancialSummaryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [promo, setPromo] = useState({
    code: "", description: "", discountPen: "", validUntil: futureDate(30),
    boundRealtorId: "", maxRedemptions: "1",
  });
  const [cost, setCost] = useState({
    packetId: "", paymentId: "", category: "signing", provider: "",
    amountPen: "", costStatus: "actual" as "estimated" | "actual" | "reversal",
    evidenceReference: "", allocationMethod: "direct_transaction", sourceId: "",
  });
  const [hold, setHold] = useState({ packetId: "", holdUntil: futureDate(14), reason: "" });

  const run = (action: () => Promise<{ error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-border bg-surface/50 p-4 text-sm text-muted">
        No existen créditos ni saldos de cliente. Una promoción reduce una transacción concreta;
        la participación notarial protegida se cubre con un costo separado de VeraDoc.
      </p>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Crear código privado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input label="Código (solo se muestra ahora)" value={promo.code} onChange={(code) => setPromo({ ...promo, code })} />
            <Input label="Motivo" value={promo.description} onChange={(description) => setPromo({ ...promo, description })} />
            <Input label="Descuento (S/)" type="number" value={promo.discountPen} onChange={(discountPen) => setPromo({ ...promo, discountPen })} />
            <Input label="Válido hasta" type="date" value={promo.validUntil} onChange={(validUntil) => setPromo({ ...promo, validUntil })} />
            <Input label="Agente vinculado (UUID, opcional)" value={promo.boundRealtorId} onChange={(boundRealtorId) => setPromo({ ...promo, boundRealtorId })} />
            <Input label="Usos máximos" type="number" value={promo.maxRedemptions} onChange={(maxRedemptions) => setPromo({ ...promo, maxRedemptions })} />
            <Button disabled={isPending} onClick={() => run(
              () => createPrivatePromoCodeAction({
                code: promo.code,
                description: promo.description,
                discountPen: Number(promo.discountPen),
                validUntil: promo.validUntil,
                boundRealtorId: promo.boundRealtorId || undefined,
                maxRedemptions: Number(promo.maxRedemptions),
              }),
              "Código privado creado",
            )}>{isPending && <Loader2 className="size-4 animate-spin" />} Crear código</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Registrar costo directo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input label="Packet ID" value={cost.packetId} onChange={(packetId) => setCost({ ...cost, packetId })} />
            <Input label="Payment ID (opcional)" value={cost.paymentId} onChange={(paymentId) => setCost({ ...cost, paymentId })} />
            <label className="block space-y-1 text-xs font-medium text-muted">Categoría
              <select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value })} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary">
                {COST_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <Input label="Proveedor" value={cost.provider} onChange={(provider) => setCost({ ...cost, provider })} />
            <Input label="Monto (S/)" type="number" value={cost.amountPen} onChange={(amountPen) => setCost({ ...cost, amountPen })} />
            <Input label="Referencia de evidencia" value={cost.evidenceReference} onChange={(evidenceReference) => setCost({ ...cost, evidenceReference })} />
            <Input label="ID único de origen" value={cost.sourceId} onChange={(sourceId) => setCost({ ...cost, sourceId })} />
            <Button disabled={isPending} onClick={() => run(
              () => recordPacketDirectCostAction({
                ...cost,
                paymentId: cost.paymentId || undefined,
                amountPen: Number(cost.amountPen),
              }),
              "Costo registrado",
            )}>{isPending && <Loader2 className="size-4 animate-spin" />} Registrar costo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Retener archivo automático</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input label="Packet ID" value={hold.packetId} onChange={(packetId) => setHold({ ...hold, packetId })} />
            <Input label="Retener hasta" type="date" value={hold.holdUntil} onChange={(holdUntil) => setHold({ ...hold, holdUntil })} />
            <Input label="Motivo aprobado" value={hold.reason} onChange={(reason) => setHold({ ...hold, reason })} />
            <Button disabled={isPending} onClick={() => run(
              () => setPacketArchivalHoldAction(hold),
              "Retención de archivo registrada",
            )}>{isPending && <Loader2 className="size-4 animate-spin" />} Guardar retención</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Margen por paquete</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border text-xs uppercase text-muted">
              <th className="px-4 py-3">Paquete / pago</th><th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">IGV</th><th className="px-4 py-3 text-right">Ingreso neto ajustado</th>
              <th className="px-4 py-3 text-right">Costos</th><th className="px-4 py-3 text-right">Margen contribución</th>
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.payment_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.packet_id.slice(0, 8)} / {row.payment_id.slice(0, 8)}
                    {row.processing_fee_missing && <span className="block text-warning">comisión de pago pendiente</span>}
                    {row.missing_cost_categories.length > 0 && (
                      <span className="block text-warning">
                        costos pendientes: {row.missing_cost_categories.join(", ")}
                      </span>
                    )}
                    {row.promo_discount_centimos > 0 && <span className="block text-muted">promo −{pen(row.promo_discount_centimos)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{pen(row.gross_collected_centimos)}</td>
                  <td className="px-4 py-3 text-right font-mono">{pen(row.included_igv_centimos)}</td>
                  <td className="px-4 py-3 text-right font-mono">{pen(row.adjusted_net_revenue_centimos)}</td>
                  <td className="px-4 py-3 text-right font-mono">{pen(row.direct_cost_centimos)}</td>
                  <td className="px-4 py-3 text-right font-mono">{pen(row.platform_contribution_margin_centimos)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Sin transacciones comerciales.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return <label className="block space-y-1 text-xs font-medium text-muted">{label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary" />
  </label>;
}
