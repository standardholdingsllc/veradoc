import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { dbStatusToDisplay, displayStatusToDb } from "@/lib/domain/status-mapping";
import { PACKET_STATUS_CONFIG } from "@/lib/domain/constants";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PacketFilters } from "@/components/agente/packet-filters";
import { formatRelative } from "@/lib/formatters";
import {
  ACTIONS,
  DASHBOARD,
  PAGE_TITLES,
  ROLES,
  UI,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  count: number;
  highlight?: boolean;
}

function SummaryCard({ label, count, highlight }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            highlight && count > 0 ? "text-error" : "text-primary",
          )}
        >
          {count}
        </p>
      </CardContent>
    </Card>
  );
}

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

type PacketRow = {
  id: string;
  packet_code: string | null;
  status: string;
  property_address: string | null;
  property_unit: string | null;
  district: string | null;
  province: string | null;
  certified_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  packet_signers: {
    signer_full_name: string;
    role_in_lease: string;
    status: string;
  }[];
  payments: {
    status: string;
  }[];
};

function getLandlordName(signers: PacketRow["packet_signers"]): string {
  return (
    signers.find((s) => s.role_in_lease === "landlord")?.signer_full_name ?? "—"
  );
}

function getRenterName(signers: PacketRow["packet_signers"]): string {
  return (
    signers.find((s) => s.role_in_lease === "renter")?.signer_full_name ?? "—"
  );
}

function getSignerProgress(signers: PacketRow["packet_signers"]): string {
  if (signers.length === 0) return "—";
  const signedCount = signers.filter((s) =>
    ["signed", "complete"].includes(s.status),
  ).length;
  return `${signedCount}/${signers.length}`;
}

function hasPendingPayment(packet: PacketRow): boolean {
  return (
    packet.status === "awaiting_payment" ||
    packet.payments.some((payment) => payment.status === "pending")
  );
}

function getPropertyLabel(packet: PacketRow): string {
  const addr = packet.property_address ?? "";
  const unit = packet.property_unit;
  const district = packet.district ?? "";
  return unit ? `${addr}, ${unit} — ${district}` : `${addr} — ${district}`;
}

export default async function AgenteDashboardPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const searchParams = await props.searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("lease_packets")
    .select("*, packet_signers(signer_full_name, role_in_lease, status), payments(status)")
    .eq("creation_state", "finalized")
    .order("updated_at", { ascending: false });

  if (searchParams.status) {
    const dbStatus = displayStatusToDb(searchParams.status);
    if (dbStatus) {
      query = query.eq("status", dbStatus);
    }
  }

  if (searchParams.q) {
    const q = `%${searchParams.q}%`;
    query = query.or(`property_address.ilike.${q},packet_code.ilike.${q}`);
  }

  if (searchParams.from) {
    query = query.gte("created_at", searchParams.from);
  }
  if (searchParams.to) {
    query = query.lte("created_at", searchParams.to);
  }

  const { data: packets } = await query;
  const rows: PacketRow[] = (packets ?? []) as PacketRow[];

  const TERMINAL = ["certified", "rejected"];
  const SIGNING = ["signing"];
  const READY_NOTARY = ["all_signed", "pending_notary"];

  const activeCount = rows.filter((p) => !TERMINAL.includes(p.status)).length;
  const waitingSignersCount = rows.filter((p) =>
    SIGNING.includes(p.status),
  ).length;
  const readyForNotaryCount = rows.filter((p) =>
    READY_NOTARY.includes(p.status),
  ).length;
  const pendingPaymentsCount = rows.filter(hasPendingPayment).length;
  const certifiedThisMonthCount = rows.filter(
    (p) => p.status === "certified" && isThisMonth(p.certified_at ?? p.updated_at),
  ).length;
  const needsCorrectionCount = rows.filter(
    (p) => p.status === "needs_correction",
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">
            {PAGE_TITLES.agenteDashboard}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {DASHBOARD.agenteInmobiliario} · {rows.length}{" "}
            {UI.paquetes.toLowerCase()}
          </p>
        </div>
        <Link href="/agente/nuevo-paquete">
          <Button>
            <Plus className="size-4" aria-hidden="true" />
            {ACTIONS.crearPaquete}
          </Button>
        </Link>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <SummaryCard label={DASHBOARD.paquetesActivos} count={activeCount} />
        <SummaryCard
          label={DASHBOARD.esperandoFirmantes}
          count={waitingSignersCount}
        />
        <SummaryCard
          label={DASHBOARD.pagosPendientes}
          count={pendingPaymentsCount}
          highlight
        />
        <SummaryCard
          label={DASHBOARD.listosParaNotario}
          count={readyForNotaryCount}
        />
        <SummaryCard
          label={DASHBOARD.certificadosEsteMes}
          count={certifiedThisMonthCount}
        />
        <SummaryCard
          label={DASHBOARD.requierenCorreccion}
          count={needsCorrectionCount}
          highlight
        />
      </div>

      <div className="mb-4">
        <Suspense>
          <PacketFilters />
        </Suspense>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{UI.paquetes}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">{UI.codigo}</th>
                <th className="px-3 py-3 font-medium">{UI.propiedad}</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">
                  {ROLES.landlord}
                </th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">
                  {ROLES.renter}
                </th>
                <th className="px-3 py-3 font-medium">{UI.firmantes}</th>
                <th className="px-3 py-3 font-medium">{UI.estado}</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">
                  {UI.proximaAccion}
                </th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">
                  {DASHBOARD.ultimaActividad}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((packet) => {
                const displayStatus = dbStatusToDisplay(packet.status);
                const statusConfig = PACKET_STATUS_CONFIG[displayStatus];
                return (
                  <tr
                    key={packet.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface/50"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/agente/paquetes/${packet.id}`}
                        className="font-mono text-sm font-medium text-secondary hover:underline"
                      >
                        {packet.packet_code ?? packet.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-foreground">
                      {getPropertyLabel(packet)}
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      {getLandlordName(packet.packet_signers)}
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      {getRenterName(packet.packet_signers)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">
                      {getSignerProgress(packet.packet_signers)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={displayStatus} />
                    </td>
                    <td className="hidden px-3 py-3 text-muted lg:table-cell">
                      {statusConfig?.nextAction ?? "—"}
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-muted xl:table-cell">
                      {packet.updated_at
                        ? formatRelative(packet.updated_at)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-sm text-muted"
                  >
                    {UI.sinResultados}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
