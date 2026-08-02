"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { EarningsMonth } from "@/lib/actions/notary";

// Per-packet payout rate — Section 27.4 TBD
const PAYOUT_RATE_PEN = 15;

function formatMonth(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface EarningsClientProps {
  months: EarningsMonth[];
}

export function EarningsClient({ months }: EarningsClientProps) {
  const thisMonth = currentMonthKey();

  const currentMonthData = months.find((m) => m.month === thisMonth);
  const currentCount = currentMonthData?.certifiedCount ?? 0;
  const currentPayout = currentCount * PAYOUT_RATE_PEN;

  const cumulative = useMemo(
    () => months.reduce((sum, m) => sum + m.certifiedCount, 0),
    [months],
  );
  const cumulativePayout = cumulative * PAYOUT_RATE_PEN;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Certificaciones este mes"
          value={String(currentCount)}
        />
        <SummaryCard
          label="Estimado este mes"
          value={`S/ ${currentPayout.toFixed(2)}`}
        />
        <SummaryCard
          label="Acumulado total"
          value={`S/ ${cumulativePayout.toFixed(2)}`}
          sublabel={`${cumulative} certificaciones`}
        />
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {months.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted">
              No hay certificaciones registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase text-muted">
                    <th className="px-6 py-3">Mes</th>
                    <th className="px-6 py-3 text-right">Certificados</th>
                    <th className="px-6 py-3 text-right">Con observaciones</th>
                    <th className="px-6 py-3 text-right">Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr
                      key={m.month}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-6 py-3 capitalize">
                        {formatMonth(m.month)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        {m.certifiedCount}
                      </td>
                      <td className="px-6 py-3 text-right text-muted">
                        {m.withObservationsCount}
                      </td>
                      <td className="px-6 py-3 text-right font-mono">
                        S/ {(m.certifiedCount * PAYOUT_RATE_PEN).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted">
        El estimado se basa en una tarifa de S/ {PAYOUT_RATE_PEN.toFixed(2)} por
        certificación. La tarifa definitiva está sujeta al acuerdo contractual.
        Las certificaciones con observaciones cuentan para el pago.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
        {sublabel && (
          <p className="mt-0.5 text-xs text-muted">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
