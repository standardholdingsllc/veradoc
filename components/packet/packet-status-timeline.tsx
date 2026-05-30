"use client";

import type { AuditEvent } from "@/lib/domain/types";
import { ROLE_CONFIG } from "@/lib/domain/constants";
import { formatDateTime } from "@/lib/formatters";
import { EMPTY, RECORD } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export interface PacketStatusTimelineProps {
  events: AuditEvent[];
  className?: string;
}

function resolveRoleLabel(role: string): string {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
  return config?.label ?? role;
}

export function PacketStatusTimeline({
  events,
  className,
}: PacketStatusTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted">{EMPTY.sinEventos}</p>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {sorted.map((event, index) => {
        const isLast = index === sorted.length - 1;

        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className="absolute left-[7px] top-4 h-full w-px bg-border"
                aria-hidden="true"
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2",
                isLast
                  ? "border-secondary bg-secondary"
                  : "border-border bg-background",
              )}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">
                  {event.eventLabel}
                </p>
                <time
                  className="font-mono text-xs text-muted"
                  dateTime={event.timestamp}
                >
                  {formatDateTime(event.timestamp)}
                </time>
              </div>

              <dl className="grid gap-1 text-xs text-muted">
                <div className="flex flex-wrap gap-x-4">
                  <dt className="sr-only">{RECORD.actor}</dt>
                  <dd>
                    <span className="font-medium text-foreground/70">
                      {RECORD.actor}:
                    </span>{" "}
                    {resolveRoleLabel(event.actorRole)}
                    {event.metadata?.actorName
                      ? ` · ${event.metadata.actorName}`
                      : null}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-4 font-mono">
                  <span>{event.ipAddressPlaceholder}</span>
                  <span className="truncate">{event.devicePlaceholder}</span>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
