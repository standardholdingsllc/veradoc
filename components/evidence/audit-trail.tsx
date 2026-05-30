"use client";

import type { AuditEvent, User } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import { EMPTY, EVIDENCE_DETAILS, RECORD, ROLES } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AuditTrailProps {
  events: AuditEvent[];
  users?: User[];
  className?: string;
}

function resolveRoleLabel(role: string): string {
  return ROLES[role as keyof typeof ROLES] ?? role;
}

function resolveActorName(actorId: string, users?: User[]): string {
  const user = users?.find((entry) => entry.id === actorId);
  if (user) {
    return user.fullName;
  }
  if (actorId === "system") {
    return "Sistema";
  }
  return actorId;
}

function roleBadgeVariant(role: string): "info" | "muted" | "success" | "warning" {
  switch (role) {
    case "notary":
      return "info";
    case "realtor":
      return "success";
    case "landlord":
    case "renter":
      return "warning";
    default:
      return "muted";
  }
}

export function AuditTrail({ events, users, className }: AuditTrailProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">{EMPTY.sinEventos}</p>;
  }

  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-[10px] uppercase tracking-widest text-muted">
            <th className="px-3 py-2.5 font-semibold">{RECORD.timestamp}</th>
            <th className="px-3 py-2.5 font-semibold">{RECORD.actor}</th>
            <th className="px-3 py-2.5 font-semibold">Rol</th>
            <th className="px-3 py-2.5 font-semibold">Evento</th>
            <th className="px-3 py-2.5 font-semibold">IP</th>
            <th className="px-3 py-2.5 font-semibold">
              {EVIDENCE_DETAILS.dispositivo}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((event) => (
            <tr
              key={event.id}
              className="border-b border-border/70 last:border-b-0 hover:bg-surface/40"
            >
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted">
                {formatDateTime(event.timestamp)}
              </td>
              <td className="px-3 py-2.5 text-foreground">
                {resolveActorName(event.actorId, users)}
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={roleBadgeVariant(event.actorRole)} className="text-[10px]">
                  {resolveRoleLabel(event.actorRole)}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium text-primary">{event.eventLabel}</span>
                <span className="ml-2 font-mono text-[10px] text-muted">
                  {event.eventType}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted">
                {event.ipAddressPlaceholder}
              </td>
              <td className="max-w-[180px] truncate px-3 py-2.5 text-xs text-muted">
                {event.devicePlaceholder}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
