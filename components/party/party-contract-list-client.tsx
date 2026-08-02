"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  Home,
  IdCard,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PacketStatus, SignerStatus } from "@/lib/domain/types";
import { formatDate } from "@/lib/formatters";
import {
  DASHBOARD,
  FORMS,
  PARTY_ACCOUNT,
  ROLES,
  UI,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartyContract {
  signerId: string;
  signerName: string;
  signerStatus: string;
  signerDisplayStatus: SignerStatus;
  packetId: string;
  packetCode: string | null;
  packetStatus: string;
  displayStatus: PacketStatus;
  propertyAddress: string | null;
  propertyUnit: string | null;
  district: string | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  certifiedAt: string | null;
  updatedAt: string | null;
}

interface PartyContractListProps {
  role: "landlord" | "renter";
  contracts: PartyContract[];
  metrics: {
    total: number;
    pending: number;
    certified: number;
    renewalEligible: number;
  };
  showFullList?: boolean;
  userName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rolePath(role: "landlord" | "renter"): string {
  return role === "landlord" ? "/arrendador" : "/arrendatario";
}

function getPropertyLabel(c: PartyContract): string {
  const parts = [c.propertyAddress];
  if (c.propertyUnit) parts.push(c.propertyUnit);
  if (c.district) parts.push(c.district);
  return parts.filter(Boolean).join(", ");
}

function isCertified(c: PartyContract): boolean {
  return (
    c.displayStatus === "certified" ||
    c.displayStatus === "certified_with_observations" ||
    c.displayStatus === "expired"
  );
}

function isPending(c: PartyContract): boolean {
  return (
    c.signerDisplayStatus !== "complete" &&
    c.signerDisplayStatus !== "signed"
  );
}

function isRenewalEligible(
  c: PartyContract,
  role: "landlord" | "renter",
): boolean {
  return (
    role === "landlord" &&
    isCertified(c) &&
    c.displayStatus === "expired"
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Home;
  tone?: "warning" | "success";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
          {label}
          <Icon
            className={cn(
              "size-4",
              tone === "warning" && "text-warning",
              tone === "success" && "text-success",
            )}
            aria-hidden="true"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <p className="font-mono text-2xl font-semibold tabular-nums text-primary">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Contract Row
// ---------------------------------------------------------------------------

function ContractRow({
  item,
  role,
}: {
  item: PartyContract;
  role: "landlord" | "renter";
}) {
  const certified = isCertified(item);
  const pending = isPending(item);
  const renewal = isRenewalEligible(item, role);
  const base = rolePath(role);

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface/50">
      <td className="px-3 py-3">
        <Link
          href={`${base}/contratos/${item.packetId}`}
          className="font-mono text-sm font-semibold text-secondary hover:underline"
        >
          {item.packetCode ?? item.packetId.slice(0, 8)}
        </Link>
      </td>
      <td className="max-w-[200px] truncate px-3 py-3">
        {getPropertyLabel(item)}
      </td>
      <td className="hidden px-3 py-3 sm:table-cell">{item.signerName}</td>
      <td className="px-3 py-3">
        <StatusBadge status={item.displayStatus} />
      </td>
      <td className="hidden px-3 py-3 font-mono text-xs text-muted lg:table-cell">
        {item.leaseEndDate ? formatDate(item.leaseEndDate) : "—"}
      </td>
      <td className="px-3 py-3">
        {renewal ? (
          <span className="inline-flex items-center gap-1 text-sm text-warning">
            <RefreshCw className="size-4" aria-hidden="true" />
            {DASHBOARD.renovacionDisponible}
          </span>
        ) : pending ? (
          <span className="text-sm text-warning">
            {PARTY_ACCOUNT.firmaPendiente}
          </span>
        ) : certified ? (
          <Link
            href={`${base}/contratos/${item.packetId}`}
            className="inline-flex items-center gap-1 text-sm text-success hover:underline"
          >
            <BadgeCheck className="size-4" aria-hidden="true" />
            {PARTY_ACCOUNT.descargaDisponible}
          </Link>
        ) : (
          <span className="text-sm text-muted">
            {PARTY_ACCOUNT.sinAccionesPendientes}
          </span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PartyContractListClient({
  role,
  contracts,
  metrics,
  showFullList = false,
  userName,
}: PartyContractListProps) {
  const displayContracts = showFullList ? contracts : contracts.slice(0, 5);
  const base = rolePath(role);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      {!showFullList && (
        <>
          <header className="mb-8 flex flex-col gap-3">
            <div>
              <h1 className="text-xl font-semibold text-primary">
                {role === "landlord"
                  ? "Panel del arrendador"
                  : "Panel del arrendatario"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {userName ?? ROLES[role]} &middot;{" "}
                {role === "landlord"
                  ? PARTY_ACCOUNT.portalArrendador
                  : PARTY_ACCOUNT.portalArrendatario}
              </p>
            </div>
          </header>

          <div
            className={cn(
              "mb-8 grid gap-3 sm:grid-cols-2",
              role === "landlord" ? "lg:grid-cols-4" : "lg:grid-cols-3",
            )}
          >
            <SummaryCard
              label={DASHBOARD.misContratos}
              value={metrics.total}
              icon={Home}
            />
            <SummaryCard
              label={DASHBOARD.accionesPendientes}
              value={metrics.pending}
              icon={CalendarClock}
              tone={metrics.pending > 0 ? "warning" : undefined}
            />
            <SummaryCard
              label={PARTY_ACCOUNT.contratosCertificados}
              value={metrics.certified}
              icon={BadgeCheck}
              tone="success"
            />
            {role === "landlord" && (
              <SummaryCard
                label={DASHBOARD.renovacionDisponible}
                value={metrics.renewalEligible}
                icon={RefreshCw}
                tone={metrics.renewalEligible > 0 ? "warning" : undefined}
              />
            )}
          </div>
        </>
      )}

      {showFullList && (
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-primary">
            {PARTY_ACCOUNT.historialContratos}
          </h1>
          <p className="mt-1 text-sm text-muted">{ROLES[role]}</p>
        </header>
      )}

      <div
        className={cn(
          "grid gap-6",
          !showFullList && "xl:grid-cols-[1fr_280px]",
        )}
      >
        <Card>
          {!showFullList && (
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">
                {DASHBOARD.misContratos}
              </CardTitle>
              <CardDescription>
                {PARTY_ACCOUNT.historialContratos}
              </CardDescription>
            </CardHeader>
          )}
          <CardContent className="overflow-x-auto p-0">
            {displayContracts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {UI.sinResultados}
              </p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-3 font-medium">{UI.codigo}</th>
                    <th className="px-3 py-3 font-medium">{UI.propiedad}</th>
                    <th className="hidden px-3 py-3 font-medium sm:table-cell">
                      {ROLES[role]}
                    </th>
                    <th className="px-3 py-3 font-medium">{UI.estado}</th>
                    <th className="hidden px-3 py-3 font-medium lg:table-cell">
                      {FORMS.fechaVencimiento}
                    </th>
                    <th className="px-3 py-3 font-medium">{UI.acciones}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayContracts.map((item) => (
                    <ContractRow
                      key={`${item.packetId}-${item.signerId}`}
                      item={item}
                      role={role}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
          {!showFullList && contracts.length > 5 && (
            <div className="border-t border-border px-4 py-3 text-center">
              <Link
                href={`${base}/contratos`}
                className="text-sm font-medium text-secondary hover:underline"
              >
                Ver todos los contratos ({contracts.length})
              </Link>
            </div>
          )}
        </Card>

        {!showFullList && (
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IdCard
                    className="size-4 text-secondary"
                    aria-hidden="true"
                  />
                  {PARTY_ACCOUNT.informacionCuenta}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium text-primary">
                  {userName ?? ROLES[role]}
                </p>
                <p className="text-muted">
                  {PARTY_ACCOUNT.cuentaCreadaDuranteFirma}
                </p>
                <Badge variant="success">
                  {PARTY_ACCOUNT.evidenciaRegistrada}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck
                    className="size-4 text-secondary"
                    aria-hidden="true"
                  />
                  {PARTY_ACCOUNT.accesoPostCertificacion}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted">
                <p>{PARTY_ACCOUNT.documentoCertificadoDisponible}</p>
                <Link
                  href={`${base}/contratos`}
                  className="inline-flex text-sm font-medium text-secondary hover:underline"
                >
                  {PARTY_ACCOUNT.verContrato}
                </Link>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
