"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PACKET_STATUS_CONFIG } from "@/lib/domain/constants";
import type { LeasePacket } from "@/lib/domain/types";
import { formatRelative } from "@/lib/formatters";
import { DASHBOARD, ROLES, UI } from "@/lib/i18n/labels";
import { usePackets } from "@/lib/services/hooks";

function getPropertyLabel(packet: LeasePacket): string {
  const { address, district, unit } = packet.property;
  return unit ? `${address}, ${unit} — ${district}` : `${address} — ${district}`;
}

function getLandlordName(packet: LeasePacket): string {
  return (
    packet.signers.find((s) => s.roleInLease === "landlord")?.fullName ?? "—"
  );
}

function getRenterName(packet: LeasePacket): string {
  return (
    packet.signers.find((s) => s.roleInLease === "renter")?.fullName ?? "—"
  );
}

function getLastActivity(packet: LeasePacket): string {
  const lastEvent = packet.auditEvents.at(-1);
  return lastEvent
    ? formatRelative(lastEvent.timestamp)
    : formatRelative(packet.updatedAt);
}

export default function AgentePaquetesPage() {
  const packets = usePackets();

  const sortedPackets = [...packets].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-primary">
          {UI.paquetes}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {packets.length} {UI.paquetes.toLowerCase()}
        </p>
      </header>

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
                      href={`/demo/agente/paquetes/${packet.id}`}
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
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
