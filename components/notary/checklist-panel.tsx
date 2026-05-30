"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { NotaryReview } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import { CHECKLIST } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "@/lib/services/notary-service";

const DEFAULT_CHECKLIST = Object.entries(CHECKLIST).map(([itemKey, label]) => ({
  itemKey,
  label,
  checked: false,
  checkedAt: undefined as string | undefined,
}));

const TOTAL_ITEMS = DEFAULT_CHECKLIST.length;

interface ChecklistPanelProps {
  packetId: string;
  notaryReview?: NotaryReview;
  interactive: boolean;
  onToggle?: () => void;
  className?: string;
}

export function ChecklistPanel({
  packetId,
  notaryReview,
  interactive,
  onToggle,
  className,
}: ChecklistPanelProps) {
  const items = notaryReview?.reviewChecklist?.length
    ? notaryReview.reviewChecklist
    : DEFAULT_CHECKLIST;

  const checkedCount = items.filter((item) => item.checked).length;
  const progressPercent = Math.round((checkedCount / TOTAL_ITEMS) * 100);

  function handleToggle(itemKey: string) {
    if (!interactive) {
      return;
    }
    toggleChecklistItem(packetId, itemKey);
    onToggle?.();
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">
            {checkedCount} de {TOTAL_ITEMS} completados
          </p>
          <span className="font-mono text-xs text-muted">{progressPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.itemKey}>
            <button
              type="button"
              disabled={!interactive}
              onClick={() => handleToggle(item.itemKey)}
              className={cn(
                "flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                item.checked
                  ? "border-success"
                  : "border-transparent",
                interactive
                  ? "cursor-pointer hover:border-secondary"
                  : "cursor-default opacity-80",
              )}
            >
              {item.checked ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    item.checked ? "text-primary" : "text-foreground",
                  )}
                >
                  {item.label}
                </p>
                {item.checked && item.checkedAt ? (
                  <p className="mt-0.5 font-mono text-[10px] text-muted">
                    {formatDateTime(item.checkedAt)}
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
