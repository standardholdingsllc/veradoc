"use client";

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

  const sortedPackets = [...packets].sort(
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
        <Link href="/demo/agente/nuevo-paquete">
          <Button>
            <Plus className="size-4" aria-hidden="true" />
            {ACTIONS.crearPaquete}
          </Button>
        </Link>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label={DASHBOARD.paquetesActivos} count={activeCount} />
        <SummaryCard
          label={DASHBOARD.esperandoFirmantes}
          count={waitingSignersCount}
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

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{UI.paquetes}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">{UI.codigo}</th>
                <th className="px-4 py-3 font-medium">{UI.propiedad}</th>
                <th className="px-4 py-3 font-medium">{ROLES.landlord}</th>
                <th className="px-4 py-3 font-medium">{ROLES.renter}</th>
                <th className="px-4 py-3 font-medium">{UI.estado}</th>
                <th className="px-4 py-3 font-medium">{UI.proximaAccion}</th>
                <th className="px-4 py-3 font-medium">{DASHBOARD.ultimaActividad}</th>
              </tr>
            </thead>
            <tbody>
              {sortedPackets.map((packet) => (
                <tr
                  key={packet.id}
                  className="border-b border-border last:border-b-0 hover:bg-surface/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/demo/agente/paquetes/${packet.id}`}
                      className="font-mono text-sm font-medium text-secondary hover:underline"
                    >
                      {packet.packetCode}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-foreground">
                    {getPropertyLabel(packet)}
                  </td>
                  <td className="px-4 py-3">{getLandlordName(packet)}</td>
                  <td className="px-4 py-3">{getRenterName(packet)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={packet.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {PACKET_STATUS_CONFIG[packet.status].nextAction}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {getLastActivity(packet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
