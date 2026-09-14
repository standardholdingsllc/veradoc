"use client";

import { useTransition, useOptimistic } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import type { NotaryReview } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/formatters";
import { CHECKLIST } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "@/lib/services/notary-service";
import { toggleChecklistItemAction } from "@/lib/actions/notary";

const DEFAULT_CHECKLIST = Object.entries(CHECKLIST).map(([itemKey, label]) => ({
  itemKey,
  label,
  checked: false,
  checkedAt: undefined as string | undefined,
}));

const TOTAL_ITEMS = DEFAULT_CHECKLIST.length;

// ---------------------------------------------------------------------------
// Demo ChecklistPanel (Zustand-backed, used by /demo/notario)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Production ChecklistPanel (server-action-backed, used by /notario)
// ---------------------------------------------------------------------------

interface ProductionChecklistPanelProps {
  packetId: string;
  checklistData: Record<string, { checked: boolean; checkedAt?: string }>;
  interactive: boolean;
  className?: string;
}

export function ProductionChecklistPanel({
  packetId,
  checklistData,
  interactive,
  className,
}: ProductionChecklistPanelProps) {
  const [isPending, startTransition] = useTransition();

  const items = Object.entries(CHECKLIST).map(([itemKey, label]) => ({
    itemKey,
    label,
    checked: checklistData[itemKey]?.checked ?? false,
    checkedAt: checklistData[itemKey]?.checkedAt,
  }));

  const [optimisticItems, setOptimisticItem] = useOptimistic(
    items,
    (state, update: { key: string; checked: boolean }) =>
      state.map((item) =>
        item.itemKey === update.key
          ? {
              ...item,
              checked: update.checked,
              checkedAt: update.checked
                ? new Date().toISOString()
                : undefined,
            }
          : item,
      ),
  );

  const checkedCount = optimisticItems.filter((item) => item.checked).length;
  const progressPercent = Math.round((checkedCount / TOTAL_ITEMS) * 100);

  function handleToggle(itemKey: string, currentChecked: boolean) {
    if (!interactive) return;
    const newChecked = !currentChecked;
    startTransition(async () => {
      setOptimisticItem({ key: itemKey, checked: newChecked });
      try {
        await toggleChecklistItemAction(packetId, itemKey, newChecked);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la lista de verificación",
        );
      }
    });
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">
            {checkedCount} de {TOTAL_ITEMS} completados
          </p>
          <span className="font-mono text-xs text-muted">
            {progressPercent}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        {optimisticItems.map((item) => (
          <li key={item.itemKey}>
            <button
              type="button"
              disabled={!interactive || isPending}
              onClick={() => handleToggle(item.itemKey, item.checked)}
              className={cn(
                "flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                item.checked ? "border-success" : "border-transparent",
                interactive && !isPending
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
