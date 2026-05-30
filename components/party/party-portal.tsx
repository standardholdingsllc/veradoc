"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Download,
  FileText,
  Fingerprint,
  Home,
  IdCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LeasePacket, Signer, UserRole } from "@/lib/domain/types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  isLeaseExpired,
  truncateHash,
} from "@/lib/formatters";
import {
  ACTIONS,
  DASHBOARD,
  DOCUMENT,
  EVIDENCE,
  FORMS,
  PAGE_TITLES,
  PARTY_ACCOUNT,
  RECORD,
  ROLES,
  TOAST,
  UI,
} from "@/lib/i18n/labels";
import { createRenewalPacket } from "@/lib/services/packet-service";
import { useCurrentUser, usePacketById, usePackets } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

type PartyRole = Extract<UserRole, "landlord" | "renter">;

interface PartyPacket {
  packet: LeasePacket;
  signer: Signer;
}

function rolePath(role: PartyRole): string {
  return role === "landlord" ? "/demo/arrendador" : "/demo/arrendatario";
}

function dashboardTitle(role: PartyRole): string {
  return role === "landlord"
    ? PAGE_TITLES.arrendadorDashboard
    : PAGE_TITLES.arrendatarioDashboard;
}

function portalDescription(role: PartyRole): string {
  return role === "landlord"
    ? PARTY_ACCOUNT.portalArrendador
    : PARTY_ACCOUNT.portalArrendatario;
}

function getPropertyLabel(packet: LeasePacket): string {
  const { address, district, unit } = packet.property;
  return unit ? `${address}, ${unit} - ${district}` : `${address} - ${district}`;
}

function isCertifiedPacket(packet: LeasePacket): boolean {
  return (
    packet.status === "certified" ||
    packet.status === "certified_with_observations"
  );
}

function isPendingSigner(signer: Signer): boolean {
  return signer.status !== "complete" && signer.status !== "signed";
}

function signerEvidenceCount(signer: Signer): number {
  return [
    signer.otpStatus === "verified",
    signer.accountCreated,
    signer.consentAccepted,
    signer.identityEvidence.reviewStatus === "passed_demo",
    signer.signatureEvidence?.signatureStatus === "valid",
  ].filter(Boolean).length;
}

function usePartyPackets(role: PartyRole): PartyPacket[] {
  const packets = usePackets();
  const currentUser = useCurrentUser();

  return useMemo(() => {
    const matchingUserDni =
      currentUser?.role === role ? currentUser.dni : undefined;

    return packets
      .flatMap((packet) =>
        packet.signers
          .filter(
            (signer) =>
              signer.roleInLease === role &&
              (!matchingUserDni || signer.dni === matchingUserDni),
          )
          .map((signer) => ({ packet, signer })),
      )
      .sort(
        (a, b) =>
          new Date(b.packet.updatedAt).getTime() -
          new Date(a.packet.updatedAt).getTime(),
      );
  }, [currentUser?.dni, currentUser?.role, packets, role]);
}

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

function ContractRow({
  item,
  role,
}: {
  item: PartyPacket;
  role: PartyRole;
}) {
  const { packet, signer } = item;
  const certified = isCertifiedPacket(packet);
  const pending = isPendingSigner(signer);
  const renewal =
    role === "landlord" && certified && isLeaseExpired(packet.leaseTerms.expirationDate);

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface/50">
      <td className="px-3 py-3">
        <Link
          href={`${rolePath(role)}/contratos/${packet.id}`}
          className="font-mono text-sm font-semibold text-secondary hover:underline"
        >
          {packet.packetCode}
        </Link>
      </td>
      <td className="max-w-[200px] truncate px-3 py-3">
        {getPropertyLabel(packet)}
      </td>
      <td className="hidden px-3 py-3 sm:table-cell">{signer.fullName}</td>
      <td className="px-3 py-3">
        <StatusBadge status={packet.status} />
      </td>
      <td className="hidden px-3 py-3 font-mono text-xs text-muted lg:table-cell">
        {formatDate(packet.leaseTerms.expirationDate)}
      </td>
      <td className="px-3 py-3">
        {pending ? (
          <Link
            href={`/demo/firma/${signer.secureLinkToken}`}
            className="text-sm font-medium text-secondary hover:underline"
          >
            {PARTY_ACCOUNT.verFlujoFirma}
          </Link>
        ) : certified ? (
          <Link
            href={`${rolePath(role)}/contratos/${packet.id}`}
            className="inline-flex items-center gap-1 text-sm text-success hover:underline"
          >
            <BadgeCheck className="size-4" aria-hidden="true" />
            {PARTY_ACCOUNT.descargaDisponible}
          </Link>
        ) : renewal ? (
          <span className="inline-flex items-center gap-1 text-sm text-warning">
            <RefreshCw className="size-4" aria-hidden="true" />
            {DASHBOARD.renovacionDisponible}
          </span>
        ) : (
          <span className="text-sm text-muted">
            {PARTY_ACCOUNT.sinAccionesPendientes}
          </span>
        )}
      </td>
    </tr>
  );
}

export function PartyDashboard({ role }: { role: PartyRole }) {
  const currentUser = useCurrentUser();
  const partyPackets = usePartyPackets(role);
  const pendingCount = partyPackets.filter((item) =>
    isPendingSigner(item.signer),
  ).length;
  const certifiedCount = partyPackets.filter((item) =>
    isCertifiedPacket(item.packet),
  ).length;
  const renewalCount =
    role === "landlord"
      ? partyPackets.filter(
          (item) =>
            isCertifiedPacket(item.packet) &&
            isLeaseExpired(item.packet.leaseTerms.expirationDate),
        ).length
      : 0;

  const recentPackets = partyPackets.slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">
            {dashboardTitle(role)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {currentUser?.role === role ? currentUser.fullName : ROLES[role]} ·{" "}
            {portalDescription(role)}
          </p>
        </div>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={DASHBOARD.misContratos}
          value={partyPackets.length}
          icon={Home}
        />
        <SummaryCard
          label={DASHBOARD.accionesPendientes}
          value={pendingCount}
          icon={CalendarClock}
          tone={pendingCount > 0 ? "warning" : undefined}
        />
        <SummaryCard
          label={PARTY_ACCOUNT.contratosCertificados}
          value={certifiedCount}
          icon={BadgeCheck}
          tone="success"
        />
        <SummaryCard
          label={DASHBOARD.renovacionDisponible}
          value={renewalCount}
          icon={RefreshCw}
          tone={renewalCount > 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">{DASHBOARD.misContratos}</CardTitle>
            <CardDescription>{PARTY_ACCOUNT.historialContratos}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">{UI.codigo}</th>
                  <th className="px-3 py-3 font-medium">{UI.propiedad}</th>
                  <th className="hidden px-3 py-3 font-medium sm:table-cell">{ROLES[role]}</th>
                  <th className="px-3 py-3 font-medium">{UI.estado}</th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">
                    {FORMS.fechaVencimiento}
                  </th>
                  <th className="px-3 py-3 font-medium">{UI.acciones}</th>
                </tr>
              </thead>
              <tbody>
                {recentPackets.map((item) => (
                  <ContractRow
                    key={`${item.packet.id}-${item.signer.id}`}
                    item={item}
                    role={role}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className="size-4 text-secondary" aria-hidden="true" />
                {PARTY_ACCOUNT.informacionCuenta}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium text-primary">
                {currentUser?.role === role ? currentUser.fullName : ROLES[role]}
              </p>
              <p className="text-muted">
                {PARTY_ACCOUNT.cuentaCreadaDuranteFirma}
              </p>
              <Badge variant="success">{PARTY_ACCOUNT.evidenciaRegistrada}</Badge>
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
                href={`${rolePath(role)}/contratos`}
                className="inline-flex text-sm font-medium text-secondary hover:underline"
              >
                {PARTY_ACCOUNT.verContrato}
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function PartyContracts({ role }: { role: PartyRole }) {
  const partyPackets = usePartyPackets(role);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-primary">
          {PARTY_ACCOUNT.historialContratos}
        </h1>
        <p className="mt-1 text-sm text-muted">{ROLES[role]}</p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">{UI.codigo}</th>
                <th className="px-3 py-3 font-medium">{UI.propiedad}</th>
                <th className="hidden px-3 py-3 font-medium sm:table-cell">{ROLES[role]}</th>
                <th className="px-3 py-3 font-medium">{UI.estado}</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">
                  {FORMS.fechaVencimiento}
                </th>
                <th className="px-3 py-3 font-medium">{UI.acciones}</th>
              </tr>
            </thead>
            <tbody>
              {partyPackets.map((item) => (
                <ContractRow
                  key={`${item.packet.id}-${item.signer.id}`}
                  item={item}
                  role={role}
                />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface/30 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm text-foreground", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

export function PartyContractDetail({
  role,
  packetId,
}: {
  role: PartyRole;
  packetId: string;
}) {
  const router = useRouter();
  const packet = usePacketById(packetId);
  const [renewing, setRenewing] = useState(false);

  const signer = packet?.signers.find((entry) => entry.roleInLease === role);
  const certified = packet ? isCertifiedPacket(packet) : false;
  const renewalAvailable =
    role === "landlord" &&
    packet !== undefined &&
    certified &&
    isLeaseExpired(packet.leaseTerms.expirationDate);

  function handleRenewal() {
    if (!packet || renewing) {
      return;
    }

    setRenewing(true);
    try {
      const renewal = createRenewalPacket(packet.id);
      toast.success(PARTY_ACCOUNT.renovacionCreada);
      router.push(`/demo/arrendador/contratos/${renewal.id}`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setRenewing(false);
    }
  }

  if (!packet || !signer) {
    return (
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
        <p className="text-sm text-muted">{UI.sinResultados}</p>
        <Link
          href={rolePath(role)}
          className="mt-4 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {ACTIONS.volverAlPanel}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1050px] px-4 py-8 md:px-8">
      <Link
        href={`${rolePath(role)}/contratos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {ACTIONS.volverAlPanel}
      </Link>

      <header className="mb-8 rounded-md border border-border bg-surface/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {PARTY_ACCOUNT.detalleContrato}
            </p>
            <h1 className="mt-2 font-mono text-2xl font-semibold text-primary">
              {packet.packetCode}
            </h1>
            <p className="mt-2 text-sm text-muted">{getPropertyLabel(packet)}</p>
          </div>
          <StatusBadge status={packet.status} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-secondary" aria-hidden="true" />
                {DOCUMENT.contratoArrendamiento}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailItem label={DOCUMENT.nombreArchivo} value={packet.leaseDocument.fileName} />
                <DetailItem
                  label={DOCUMENT.fechaCarga}
                  value={formatDateTime(packet.leaseDocument.uploadedAt)}
                  mono
                />
                <DetailItem
                  label={DOCUMENT.hashInicial}
                  value={truncateHash(packet.leaseDocument.initialHash, 10)}
                  mono
                />
                <DetailItem
                  label={FORMS.rentaMensual}
                  value={formatCurrency(packet.leaseTerms.monthlyRent)}
                  mono
                />
                <DetailItem
                  label={FORMS.fechaInicio}
                  value={formatDate(packet.leaseTerms.startDate)}
                  mono
                />
                <DetailItem
                  label={FORMS.fechaVencimiento}
                  value={formatDate(packet.leaseTerms.expirationDate)}
                  mono
                />
              </dl>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const fileName = certified && packet.certifiedDocument
                    ? packet.certifiedDocument.fileName
                    : packet.finalSignedDocument
                      ? packet.finalSignedDocument.fileName
                      : packet.leaseDocument.fileName;
                  toast.success(`Descarga simulada: ${fileName}`);
                }}
              >
                <Download className="size-4" aria-hidden="true" />
                {certified ? "Descargar contrato certificado" : "Descargar contrato"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Fingerprint
                  className="size-4 text-secondary"
                  aria-hidden="true"
                />
                {PARTY_ACCOUNT.evidenciaIdentidad}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailItem label={FORMS.nombreCompleto} value={signer.fullName} />
                <DetailItem label={FORMS.dni} value={signer.dni} mono />
                <DetailItem label={FORMS.whatsapp} value={signer.whatsapp} mono />
                <DetailItem
                  label={PARTY_ACCOUNT.evidenciaRegistrada}
                  value={`${signerEvidenceCount(signer)} / 5`}
                  mono
                />
                <DetailItem
                  label={RECORD.timestamp}
                  value={
                    signer.consentTimestamp
                      ? formatDateTime(signer.consentTimestamp)
                      : UI.sinResultados
                  }
                  mono
                />
                <DetailItem
                  label={EVIDENCE.validacionFirma}
                  value={
                    signer.signatureEvidence?.signatureStatus === "valid"
                      ? "IOFE valid"
                      : PARTY_ACCOUNT.firmaPendiente
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {role === "landlord" ? (
            <Card>
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Home className="size-4 text-secondary" aria-hidden="true" />
                  {PARTY_ACCOUNT.autoridadPropiedad}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="text-foreground">
                  {packet.property.propertyAuthorityEvidence ??
                    packet.property.sunarpRecordPlaceholder ??
                    UI.sinResultados}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{UI.acciones}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isPendingSigner(signer) ? (
                <Link href={`/demo/firma/${signer.secureLinkToken}`}>
                  <Button className="w-full justify-start">
                    <Fingerprint className="size-4" aria-hidden="true" />
                    {PARTY_ACCOUNT.iniciarNuevaFirma}
                  </Button>
                </Link>
              ) : null}

              {certified ? (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => {
                    toast.success("Descarga simulada: " + (packet.certifiedDocument?.fileName ?? packet.leaseDocument.fileName));
                  }}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {ACTIONS.descargarContrato}
                </Button>
              ) : null}

              {renewalAvailable ? (
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={handleRenewal}
                  disabled={renewing}
                >
                  {renewing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  {ACTIONS.iniciarRenovacion}
                </Button>
              ) : null}

              {!isPendingSigner(signer) && !certified && !renewalAvailable ? (
                <p className="text-sm text-muted">
                  {PARTY_ACCOUNT.sinAccionesPendientes}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {renewalAvailable ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {DASHBOARD.renovacionDisponible}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted">
                <p>{PARTY_ACCOUNT.renovacionLista}</p>
                <Badge variant="warning">
                  {formatDate(packet.leaseTerms.expirationDate)}
                </Badge>
              </CardContent>
            </Card>
          ) : null}

          {packet.certifiedDocument ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {DOCUMENT.contratoCertificado}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-mono text-xs text-muted">
                  {packet.certifiedDocument.fileName}
                </p>
                <p className="font-mono text-xs text-muted">
                  {truncateHash(packet.certifiedDocument.hash, 8)}
                </p>
                <Badge variant="success">
                  {PARTY_ACCOUNT.documentoCertificadoDisponible}
                </Badge>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
