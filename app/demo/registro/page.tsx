"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { isBefore, parseISO, startOfDay } from "date-fns";
import { RegistryWarningBanner } from "@/components/registry/registry-warning-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegistryEntry } from "@/lib/domain/types";
import { formatDate } from "@/lib/formatters";
import {
  DASHBOARD,
  FORMS,
  REGISTRY,
  STATUS_LABELS,
  UI,
} from "@/lib/i18n/labels";
import {
  getRegistryEntries,
  isLeaseTermExpired,
} from "@/lib/services/registry-service";
import { getPacketById } from "@/lib/services/packet-service";
import { cn } from "@/lib/utils";

function isLeaseTermVigente(entry: RegistryEntry): boolean {
  if (isLeaseTermExpired(entry)) {
    return false;
  }
  const today = startOfDay(new Date());
  const start = startOfDay(parseISO(entry.leaseStartDate));
  return !isBefore(today, start);
}

function getDuplicateActivePropertyKeys(entries: RegistryEntry[]): Set<string> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.active) {
      continue;
    }
    counts.set(entry.propertyKey, (counts.get(entry.propertyKey) ?? 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
}

export default function RegistroPage() {
  const [search, setSearch] = useState("");
  const entries = getRegistryEntries();

  const duplicateKeys = useMemo(
    () => getDuplicateActivePropertyKeys(entries),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return entries;
    }
    return entries.filter((entry) =>
      entry.propertyAddress.toLowerCase().includes(query),
    );
  }, [entries, search]);

  const hasDuplicates = duplicateKeys.size > 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-primary">
          {REGISTRY.titulo}
        </h1>
        <p className="mt-2 text-sm text-muted">{REGISTRY.explicacion}</p>
      </header>

      {hasDuplicates ? (
        <RegistryWarningBanner className="mb-6" />
      ) : null}

      <div className="mb-6">
        <label htmlFor="registry-search" className="sr-only">
          {REGISTRY.buscarDireccion}
        </label>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="registry-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={REGISTRY.buscarDireccion}
            className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{REGISTRY.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {filteredEntries.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              {UI.sinResultados}
            </p>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">
                    {FORMS.direccion}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.arrendadores}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.arrendatarios}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.fechasContrato}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.vigenciaContrato}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.estadoRegistral}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {DASHBOARD.codigoPaquete}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {REGISTRY.estadoCertificacion}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const isConflict =
                    entry.active && duplicateKeys.has(entry.propertyKey);
                  const packet = getPacketById(entry.packetId);
                  const vigente = isLeaseTermVigente(entry);

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-surface/50",
                        isConflict && "border-l-4 border-l-warning",
                      )}
                    >
                      <td className="max-w-[220px] px-4 py-3 text-foreground">
                        {entry.propertyAddress}
                      </td>
                      <td className="px-4 py-3">
                        {entry.landlordNames.join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        {entry.renterNames.join(", ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {formatDate(entry.leaseStartDate)}
                        {" / "}
                        {formatDate(entry.leaseExpirationDate)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={vigente ? "success" : "warning"}>
                          {vigente ? REGISTRY.vigente : REGISTRY.vencido}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={entry.active ? "info" : "muted"}>
                          {entry.active ? REGISTRY.activo : REGISTRY.inactivo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {packet?.packetCode ?? entry.packetId}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">
                          {STATUS_LABELS[entry.certificationStatus]}
                        </Badge>
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
