"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PACKET_STATUS_CONFIG } from "@/lib/domain/constants";
import type { LeasePacket, PacketStatus } from "@/lib/domain/types";
import { formatRelative } from "@/lib/formatters";
import {
  ACTIONS,
  DASHBOARD,
  PAGE_TITLES,
  ROLES,
  UI,
} from "@/lib/i18n/labels";
import { usePackets } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

const TERMINAL_STATUSES: PacketStatus[] = [
  "certified",
  "certified_with_observations",
  "rejected",
  "archived",
];

const WAITING_SIGNER_STATUSES: PacketStatus[] = [
  "sent_to_signers",
  "partially_signed",
];

const READY_FOR_NOTARY_STATUSES: PacketStatus[] = [
  "all_signers_complete",
  "evidence_report_generated",
  "ready_for_notary",
];

function isThisMonth(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function getLandlordName(packet: LeasePacket): string {
  return (
    packet.signers.find((signer) => signer.roleInLease === "landlord")
      ?.fullName ?? "—"
  );
}

function getRenterName(packet: LeasePacket): string {
  return (
    packet.signers.find((signer) => signer.roleInLease === "renter")
      ?.fullName ?? "—"
  );
}

function getPropertyLabel(packet: LeasePacket): string {
  const { address, district, unit } = packet.property;
  return unit ? `${address}, ${unit} — ${district}` : `${address} — ${district}`;
}

function getLastActivity(packet: LeasePacket): string {
  const lastEvent = packet.auditEvents.at(-1);
  return lastEvent
    ? formatRelative(lastEvent.timestamp)
    : formatRelative(packet.updatedAt);
}

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

export default function AgenteDashboardPage() {
  const packets = usePackets();
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");

  const activeCount = packets.filter(
    (packet) => !TERMINAL_STATUSES.includes(packet.status),
  ).length;

  const waitingSignersCount = packets.filter((packet) =>
    WAITING_SIGNER_STATUSES.includes(packet.status),
  ).length;

  const readyForNotaryCount = packets.filter((packet) =>
    READY_FOR_NOTARY_STATUSES.includes(packet.status),
  ).length;

  const certifiedThisMonthCount = packets.filter((packet) => {
    if (
      packet.status !== "certified" &&
      packet.status !== "certified_with_observations"
    ) {
      return false;
    }
    const certifiedAt =
      packet.notaryReview?.certifiedAt ?? packet.updatedAt;
    return isThisMonth(certifiedAt);
  }).length;

  const needsCorrectionCount = packets.filter(
    (packet) => packet.status === "needs_correction",
  ).length;

  const pendingPaymentsCount = packets.filter((packet) =>
    packet.status === "awaiting_payment" || packet.payment.status === "pending",
  ).length;

  const sortedPackets = packets.filter((packet) => {
    const searchText = `${packet.packetCode} ${packet.property.address}`.toLocaleLowerCase("es-PE");
    const createdDay = packet.createdAt.slice(0, 10);
    return (!statusFilter || packet.status === statusFilter)
      && (!fromDate || createdDay >= fromDate)
      && (!toDate || createdDay <= toDate)
      && (!query.trim() || searchText.includes(query.trim().toLocaleLowerCase("es-PE")));
  }).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">
            {PAGE_TITLES.agenteDashboard}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {DASHBOARD.agenteInmobiliario} · {packets.length} {UI.paquetes.toLowerCase()}
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
        <SummaryCard label={DASHBOARD.pagosPendientes} count={pendingPaymentsCount} highlight />
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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted">{UI.estado}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="block rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="">{UI.todos}</option>
            {(Object.entries(PACKET_STATUS_CONFIG) as [PacketStatus, { label: string }][]).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">Desde
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="block rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="space-y-1 text-xs text-muted">Hasta
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="block rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="space-y-1 text-xs text-muted">Buscar
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dirección o código..." className="block rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{UI.paquetes}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">{UI.codigo}</th>
                <th className="px-3 py-3 font-medium">{UI.propiedad}</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">{ROLES.landlord}</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">{ROLES.renter}</th>
                <th className="px-3 py-3 font-medium">{UI.firmantes}</th>
                <th className="px-3 py-3 font-medium">{UI.estado}</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">{UI.proximaAccion}</th>
                <th className="hidden px-3 py-3 font-medium xl:table-cell">{DASHBOARD.ultimaActividad}</th>
              </tr>
            </thead>
            <tbody>
              {sortedPackets.map((packet) => (
                <tr
                  key={packet.id}
                  className="border-b border-border last:border-b-0 hover:bg-surface/50"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/agente/paquetes/${packet.id}`}
                      className="font-mono text-sm font-medium text-secondary hover:underline"
                    >
                      {packet.packetCode}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-foreground">
                    {getPropertyLabel(packet)}
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">{getLandlordName(packet)}</td>
                  <td className="hidden px-3 py-3 md:table-cell">{getRenterName(packet)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{packet.signers.filter((signer) => ["signed", "complete"].includes(signer.status)).length}/{packet.signers.length}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={packet.status} />
                  </td>
                  <td className="hidden px-3 py-3 text-muted lg:table-cell">
                    {PACKET_STATUS_CONFIG[packet.status].nextAction}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-xs text-muted xl:table-cell">
                    {getLastActivity(packet)}
                  </td>
                </tr>
              ))}
              {sortedPackets.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">{UI.sinResultados}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
