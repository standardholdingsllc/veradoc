"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PACKET_STATUS_CONFIG } from "@/lib/domain/constants";
import type { PacketStatus } from "@/lib/domain/types";
import { UI } from "@/lib/i18n/labels";

const DISPLAY_STATUSES: { value: PacketStatus; label: string }[] = (
  Object.entries(PACKET_STATUS_CONFIG) as [PacketStatus, { label: string }][]
).map(([value, { label }]) => ({ value, label }));

export function PacketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      }
      router.push(`/agente?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleSearch = () => {
    updateParams({ q: query.trim() || null });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted">{UI.estado}</span>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={searchParams.get("status") ?? ""}
          onChange={(e) =>
            updateParams({ status: e.target.value || null })
          }
        >
          <option value="">{UI.todos}</option>
          {DISPLAY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium text-muted">Desde</span>
        <input
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => updateParams({ from: e.target.value || null })}
        />
      </label>

      <label className="space-y-1">
        <span className="text-xs font-medium text-muted">Hasta</span>
        <input
          type="date"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => updateParams({ to: e.target.value || null })}
        />
      </label>

      <div className="flex items-end gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted">Buscar</span>
          <input
            type="text"
            placeholder="Dirección o código..."
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
        </label>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <Search className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
