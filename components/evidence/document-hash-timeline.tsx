"use client";

import { ArrowRight } from "lucide-react";
import type { DocumentHashEntry } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import { HASH_STAGES, RECORD, UI } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { HashDisplay } from "./hash-display";

interface DocumentHashTimelineProps {
  entries: DocumentHashEntry[];
  className?: string;
}

const STAGE_ORDER: DocumentHashEntry["stage"][] = [
  "initial_upload",
  "post_signatures",
  "final_certified",
];

export function DocumentHashTimeline({
  entries,
  className,
}: DocumentHashTimelineProps) {
  const sorted = STAGE_ORDER.map((stage) =>
    entries.find((entry) => entry.stage === stage),
  ).filter((entry): entry is DocumentHashEntry => entry !== undefined);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">{UI.sinResultados}</p>;
  }

  return (
    <div className={cn("space-y-0", className)}>
      {sorted.map((entry, index) => (
        <div key={`${entry.stage}-${entry.timestamp}`} className="relative flex gap-4">
          {index < sorted.length - 1 ? (
            <div
              className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-border"
              aria-hidden="true"
            />
          ) : null}

          <div className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary bg-background">
            <span className="size-2 rounded-full bg-secondary" />
          </div>

          <div
            className={cn(
              "mb-4 flex-1 border-t border-border pt-4",
              index === sorted.length - 1 && "mb-0",
            )}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-primary">
                {HASH_STAGES[entry.stage]}
              </span>
              <Badge variant="muted" className="font-mono text-[10px]">
                {entry.algorithm}
              </Badge>
            </div>
            <HashDisplay hash={entry.hash} className="mb-2" />
            <p className="font-mono text-xs text-muted">
              {formatDateTime(entry.timestamp)}
            </p>
            {entry.actorId ? (
              <p className="mt-1 text-xs text-muted">
                {RECORD.actor}:{" "}
                <span className="font-mono">{entry.actorId}</span>
              </p>
            ) : null}
          </div>

          {index < sorted.length - 1 ? (
            <ArrowRight
              className="absolute -right-1 top-5 hidden size-4 text-muted lg:block"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
