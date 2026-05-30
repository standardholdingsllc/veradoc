"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Scale } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeasePacket, PacketStatus, User } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import {
  DASHBOARD,
  EMPTY,
  NOTARY_QUEUE,
  PAGE_TITLES,
  REGISTRY,
  UI,
} from "@/lib/i18n/labels";
import { checkDuplicate } from "@/lib/services/registry-service";
import { usePackets, useUsers } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

type QueueTab =
  | "pendientes"
  | "en_revision"
  | "certificados"
  | "requieren_correccion"
  | "rechazados";

const TAB_CONFIG: {
  id: QueueTab;
  label: string;
  statuses: PacketStatus[];
}[] = [
  {
    id: "pendientes",
    label: NOTARY_QUEUE.pendientes,
    statuses: ["ready_for_notary"],
  },
  {
    id: "en_revision",
    label: NOTARY_QUEUE.enRevision,
    statuses: ["under_notary_review"],
  },
  {
    id: "certificados",
    label: NOTARY_QUEUE.certificados,
    statuses: ["certified", "certified_with_observations"],
  },
  {
    id: "requieren_correccion",
    label: NOTARY_QUEUE.requierenCorreccion,
    statuses: ["needs_correction"],
  },
  {
    id: "rechazados",
    label: NOTARY_QUEUE.rechazados,
    statuses: ["rejected"],
  },
];

function getPropertyLabel(packet: LeasePacket): string {
  const { address, district, unit } = packet.property;
  return unit ? `${address}, ${unit} — ${district}` : `${address} — ${district}`;
}

function getRealtorName(
  packet: LeasePacket,
  users: User[],
): string {
  return (
    users.find((user) => user.id === packet.createdByRealtorId)?.fullName ?? "—"
  );
}

function getSubmitDate(packet: LeasePacket): string | undefined {
  const submitEvent = packet.auditEvents.find(
    (event) => event.eventType === "submit_to_notary",
  );
  return submitEvent?.timestamp ?? packet.updatedAt;
}

function getEvidenceReportStatus(packet: LeasePacket): string {
  const status = packet.evidenceReport?.status;
  if (!status) {
    return "—";
  }
  switch (status) {
    case "generated":
      return "Generado";
    case "submitted":
      return "Enviado";
    case "under_review":
      return "En revisión";
    default:
      return status;
  }
}

function hasRegistryAlert(packet: LeasePacket): boolean {
  if (packet.registryCheck.matchFound) {
    return true;
  }
  return checkDuplicate(packet.property.normalizedAddressKey).length > 0;
}

export default function NotarioDashboardPage() {
  const packets = usePackets();
  const users = useUsers();
  const [activeTab, setActiveTab] = useState<QueueTab>("pendientes");

  const currentConfig = TAB_CONFIG.find((tab) => tab.id === activeTab)!;

  const filteredPackets = useMemo(() => {
    return packets
      .filter((packet) => currentConfig.statuses.includes(packet.status))
      .sort(
        (a, b) =>
          new Date(getSubmitDate(b) ?? b.updatedAt).getTime() -
          new Date(getSubmitDate(a) ?? a.updatedAt).getTime(),
      );
  }, [currentConfig.statuses, packets]);

  const tabCounts = useMemo(() => {
    return TAB_CONFIG.reduce(
      (acc, tab) => {
        acc[tab.id] = packets.filter((packet) =>
          tab.statuses.includes(packet.status),
        ).length;
        return acc;
      },
      {} as Record<QueueTab, number>,
    );
  }, [packets]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8">
      <header className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
          <Scale className="size-5 text-secondary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {PAGE_TITLES.notarioDashboard}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sistema de revisión notarial · Cola de expedientes de evidencia
          </p>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-1">
        {TAB_CONFIG.map((tab) => {
          const active = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-secondary text-primary"
                  : "border-transparent text-muted hover:border-border hover:text-primary",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-xs",
                  active ? "bg-secondary/10 text-secondary" : "bg-surface text-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{currentConfig.label}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {filteredPackets.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted">
              {EMPTY.colaVacia}
            </p>
          ) : (
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-[10px] uppercase tracking-widest text-muted">
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.codigoPaquete}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {REGISTRY.direccionPropiedad}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.agenteInmobiliario}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.cantidadFirmantes}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.estadoInforme}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.indicadorRegistro}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {DASHBOARD.fechaEnvio}
                  </th>
                  <th className="px-4 py-3 font-semibold">{UI.estado}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackets.map((packet) => {
                  const submitDate = getSubmitDate(packet);
                  const registryAlert = hasRegistryAlert(packet);
                  return (
                    <tr
                      key={packet.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/demo/notario/paquetes/${packet.id}`}
                          className="font-mono text-sm font-semibold text-secondary hover:underline"
                        >
                          {packet.packetCode}
                        </Link>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3">
                        {getPropertyLabel(packet)}
                      </td>
                      <td className="px-4 py-3">
                        {getRealtorName(packet, users)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {packet.signers.length}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {getEvidenceReportStatus(packet)}
                      </td>
                      <td className="px-4 py-3">
                        {registryAlert ? (
                          <span
                            className="inline-flex items-center gap-1 text-warning"
                            title={packet.registryCheck.matchDetails}
                          >
                            <AlertTriangle className="size-4" aria-hidden="true" />
                            <span className="sr-only">Alerta de registro</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                        {submitDate ? formatDateTime(submitDate) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={packet.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
