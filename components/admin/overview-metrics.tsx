import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PacketStatus } from "@/lib/domain/types";

const formatPEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

interface OverviewMetricsProps {
  metrics: {
    activeRealtors: number;
    activeNotaries: number;
    activeSigners: number;
    packetsByStatus: Record<string, number>;
    totalPackets: number;
    recentCertifications: number;
    paymentTotals: Record<string, number>;
  };
}

export function OverviewMetrics({ metrics }: OverviewMetricsProps) {
  const statusEntries = Object.entries(metrics.packetsByStatus).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Agentes activos" value={metrics.activeRealtors} />
        <MetricCard label="Notarios activos" value={metrics.activeNotaries} />
        <MetricCard label="Firmantes activos" value={metrics.activeSigners} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paquetes por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-2xl font-bold">{metrics.totalPackets}</p>
            {statusEntries.length === 0 ? (
              <p className="text-sm text-muted">Sin paquetes.</p>
            ) : (
              <ul className="space-y-1.5">
                {statusEntries.map(([status, count]) => (
                  <li
                    key={status}
                    className="flex items-center justify-between text-sm"
                  >
                    <StatusBadge status={status as PacketStatus} />
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificaciones recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {metrics.recentCertifications}
            </p>
            <p className="text-sm text-muted">Últimos 30 días</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pagos pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPEN.format(metrics.paymentTotals.pending ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pagos completados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPEN.format(metrics.paymentTotals.completed ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pagos reembolsados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPEN.format(metrics.paymentTotals.refunded ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
