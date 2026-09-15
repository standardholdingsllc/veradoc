"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { NotaryQueueItem } from "@/lib/actions/notary";
import {
  setNotaryPriorityAction,
  type NotaryPriority,
} from "@/lib/actions/notary";
import {
  NOTARY_QUEUE,
  NOTARY_ACCOUNT,
  STATUS_LABELS,
  DASHBOARD,
  EMPTY,
} from "@/lib/i18n/labels";

const TABS = [
  { id: "pendientes", label: NOTARY_QUEUE.pendientes },
  { id: "en_revision", label: NOTARY_QUEUE.enRevision },
  { id: "pendiente_sello", label: NOTARY_QUEUE.pendienteSello },
  { id: "certificados", label: NOTARY_QUEUE.certificados },
  { id: "requieren_correccion", label: NOTARY_QUEUE.requierenCorreccion },
  { id: "rechazados", label: NOTARY_QUEUE.rechazados },
] as const;

function matchesTab(
  item: NotaryQueueItem,
  tab: string,
): boolean {
  switch (tab) {
    case "pendientes":
      return (
        item.status === "pending_notary" && !item.reviewStartedAt
      );
    case "en_revision":
      return item.status === "under_review";
    case "pendiente_sello":
      return item.status === "awaiting_notary_seal";
    case "certificados":
      return item.status === "certified";
    case "requieren_correccion":
      return item.status === "needs_correction";
    case "rechazados":
      return item.decision === "rejected";
    default:
      return false;
  }
}

function statusBadge(item: NotaryQueueItem) {
  const label =
    (STATUS_LABELS as Record<string, string>)[item.status] ?? item.status;

  const color =
    item.status === "certified"
      ? "bg-green-50 text-green-700"
      : item.status === "under_review"
        ? "bg-blue-50 text-blue-700"
        : item.status === "awaiting_notary_seal"
          ? "bg-purple-50 text-purple-700"
          : item.status === "needs_correction"
            ? "bg-amber-50 text-amber-700"
            : item.status === "rejected"
              ? "bg-red-50 text-red-700"
              : "bg-gray-50 text-gray-700";

  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        color,
      )}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isSameMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

interface NotaryQueueClientProps {
  items: NotaryQueueItem[];
  initialTab?: string;
  historyMode?: boolean;
}

export function NotaryQueueClient({
  items,
  initialTab = "pendientes",
  historyMode = false,
}: NotaryQueueClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = historyMode
    ? TABS.filter((t) =>
        ["certificados", "requieren_correccion", "rechazados"].includes(t.id),
      )
    : [...TABS];

  const filtered = useMemo(
    () => items.filter((item) => matchesTab(item, activeTab)),
    [items, activeTab],
  );

  const pendingCount = items.filter((i) => matchesTab(i, "pendientes")).length;
  const certifiedThisMonth = items.filter(
    (i) =>
      (i.decision === "certified" ||
        i.decision === "certified_with_observations") &&
      i.status === "certified" &&
      isSameMonth(i.decidedAt),
  ).length;
  const totalCertified = items.filter(
    (i) =>
      i.status === "certified",
  ).length;
  const participationPercent = items.find((item) => item.payoutParticipationPercent != null)?.payoutParticipationPercent ?? null;

  const changePriority = (item: NotaryQueueItem, priority: NotaryPriority) => {
    startTransition(async () => {
      try {
        await setNotaryPriorityAction(item.packetId, priority, item.priorityReason ?? undefined);
        toast.success("Prioridad actualizada");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la prioridad");
      }
    });
  };

  return (
    <div className="space-y-6">
      {!historyMode && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={NOTARY_ACCOUNT.revisionesPendientes}
            value={pendingCount}
          />
          <MetricCard
            label={DASHBOARD.certificadosEsteMes}
            value={certifiedThisMonth}
          />
          <MetricCard
            label={NOTARY_ACCOUNT.estimadoPago}
            value={participationPercent == null
              ? "Sin términos"
              : `${participationPercent.toFixed(2)}% MND`}
          />
          <MetricCard
            label={NOTARY_ACCOUNT.documentosCompletados}
            value={totalCertified}
          />
        </div>
      )}

      <Tabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">
            {EMPTY.colaVacia}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase text-muted">
                  <th className="px-3 py-3">{DASHBOARD.codigoPaquete}</th>
                  <th className="px-3 py-3">Propiedad</th>
                  <th className="px-3 py-3">
                    {DASHBOARD.agenteInmobiliario}
                  </th>
                  <th className="px-3 py-3 text-center">
                    {DASHBOARD.cantidadFirmantes}
                  </th>
                  <th className="px-3 py-3">{DASHBOARD.fechaEnvio}</th>
                  <th className="px-3 py-3">Prioridad</th>
                  <th className="px-3 py-3 text-center">
                    {DASHBOARD.indicadorRegistro}
                  </th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.assignmentId}
                    className="border-b border-border last:border-0 hover:bg-surface/50"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/paquetes/${item.packetId}`}
                        className="font-mono text-xs font-medium text-secondary underline-offset-2 hover:underline"
                      >
                        {item.packetCode}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {item.propertyAddress}
                      {item.propertyUnit ? ` - ${item.propertyUnit}` : ""}
                    </td>
                    <td className="px-3 py-3 text-sm">{item.realtorName}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      {item.signerCount}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {formatDate(item.submittedAt ?? item.assignedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`priority-${item.assignmentId}`}>
                        Prioridad de {item.packetCode}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {isPending
                          ? <Loader2 className="size-3 animate-spin text-muted" />
                          : <Flag className={cn(
                              "size-3",
                              item.priority === "urgent" || item.priority === "high"
                                ? "text-red-500"
                                : "text-muted",
                            )} />}
                        <select
                          id={`priority-${item.assignmentId}`}
                          value={item.priority}
                          disabled={isPending || historyMode}
                          title={item.priorityReason ?? undefined}
                          onChange={(event) =>
                            changePriority(item, event.target.value as NotaryPriority)
                          }
                          className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                        >
                          <option value="urgent">Urgente</option>
                          <option value="high">Alta</option>
                          <option value="normal">Normal</option>
                          <option value="low">Baja</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.registryAlert && (
                        <AlertTriangle
                          className="mx-auto size-4 text-amber-500"
                          aria-label="Alerta de registro duplicado"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">{statusBadge(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}
