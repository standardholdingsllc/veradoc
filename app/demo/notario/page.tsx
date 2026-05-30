"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, ClipboardCheck, Scale } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeasePacket, PacketStatus, User } from "@/lib/domain/types";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import {
  DASHBOARD,
  EMPTY,
  NOTARY_ACCOUNT,
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

function isCertified(packet: LeasePacket): boolean {
  return (
    packet.status === "certified" ||
    packet.status === "certified_with_observations"
  );
}

function isSameMonth(iso: string, reference = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear()
  );
}

function NotaryMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Scale;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
          {label}
          <Icon className="size-4 text-secondary" aria-hidden="true" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <p className="font-mono text-2xl font-semibold tabular-nums text-primary">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function NotarioDashboardPage() {
  const packets = usePackets();
  const users = useUsers();
  const [activeTab, setActiveTab] = useState<QueueTab>("pendientes");

  const currentConfig = TAB_CONFIG.find((tab) => tab.id === activeTab)!;
  const certifiedPackets = packets.filter(isCertified);
  const certifiedThisMonth = certifiedPackets.filter((packet) =>
    isSameMonth(packet.notaryReview?.certifiedAt ?? packet.updatedAt),
  );
  const partnerRate = 80;
  const pendingReviewCount = packets.filter(
    (packet) =>
      packet.status === "ready_for_notary" ||
      packet.status === "under_notary_review",
  ).length;

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
          <h1 className="text-xl font-semibold text-primary">
            {PAGE_TITLES.notarioDashboard}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sistema de revisión notarial · Cola de expedientes de evidencia
          </p>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NotaryMetricCard
          label={NOTARY_ACCOUNT.revisionesPendientes}
          value={pendingReviewCount}
          detail={NOTARY_QUEUE.pendientes}
          icon={ClipboardCheck}
        />
        <NotaryMetricCard
          label={NOTARY_ACCOUNT.conteoMensual}
          value={certifiedThisMonth.length}
          detail={NOTARY_ACCOUNT.documentosCompletados}
          icon={Scale}
        />
        <NotaryMetricCard
          label={NOTARY_ACCOUNT.pagoPartner}
          value={formatCurrency(certifiedThisMonth.length * partnerRate)}
          detail={NOTARY_ACCOUNT.estimadoPago}
          icon={Banknote}
        />
        <NotaryMetricCard
          label={NOTARY_ACCOUNT.documentosCompletados}
          value={certifiedPackets.length}
          detail={NOTARY_ACCOUNT.tasaDemoPorDocumento}
          icon={ClipboardCheck}
        />
      </div>

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
