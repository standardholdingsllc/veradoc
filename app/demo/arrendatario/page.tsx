"use client";

import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
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
import type { LeasePacket, Signer } from "@/lib/domain/types";
import { formatDate, isLeaseExpired } from "@/lib/formatters";
import {
  ACTIONS,
  DASHBOARD,
  FORMS,
  PAGE_TITLES,
  UI,
} from "@/lib/i18n/labels";
import { getPackets } from "@/lib/services/packet-service";
import { useCurrentUser } from "@/lib/services/hooks";
import { cn } from "@/lib/utils";

function getPropertyLabel(packet: LeasePacket): string {
  const { address, district, unit } = packet.property;
  return unit ? `${address}, ${unit} — ${district}` : `${address} — ${district}`;
}

function getRenterSigner(
  packet: LeasePacket,
  userDni: string,
): Signer | undefined {
  return packet.signers.find(
    (signer) => signer.roleInLease === "renter" && signer.dni === userDni,
  );
}

function hasPendingSigningAction(signer: Signer): boolean {
  return signer.status !== "complete" && signer.status !== "signed";
}

function isCertifiedPacket(packet: LeasePacket): boolean {
  return (
    packet.status === "certified" ||
    packet.status === "certified_with_observations"
  );
}

function showRenewalIndicator(packet: LeasePacket): boolean {
  return (
    isCertifiedPacket(packet) &&
    isLeaseExpired(packet.leaseTerms.expirationDate)
  );
}

export default function ArrendatarioDashboardPage() {
  const currentUser = useCurrentUser();
  const userDni = currentUser?.dni ?? "";

  const myPackets = getPackets()
    .filter((packet) => getRenterSigner(packet, userDni))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          {PAGE_TITLES.arrendatarioDashboard}
        </h1>
        {currentUser ? (
          <p className="mt-1 text-sm text-muted">{currentUser.fullName}</p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-4 text-base font-semibold text-primary">
          {DASHBOARD.misContratos}
        </h2>

        {myPackets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted">
              {UI.sinResultados}
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {myPackets.map((packet) => {
              const signer = getRenterSigner(packet, userDni)!;
              const pending = hasPendingSigningAction(signer);
              const certified = isCertifiedPacket(packet);
              const renewal = showRenewalIndicator(packet);

              return (
                <li key={packet.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">
                            {getPropertyLabel(packet)}
                          </CardTitle>
                          <CardDescription className="mt-1 font-mono text-xs">
                            {packet.packetCode}
                          </CardDescription>
                        </div>
                        <StatusBadge status={packet.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">
                            {FORMS.fechaInicio}
                          </dt>
                          <dd>{formatDate(packet.leaseTerms.startDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-muted">
                            {FORMS.fechaVencimiento}
                          </dt>
                          <dd>{formatDate(packet.leaseTerms.expirationDate)}</dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap items-center gap-3">
                        {certified ? (
                          <Button variant="outline" size="sm" disabled>
                            <Download className="size-4" aria-hidden="true" />
                            {ACTIONS.descargarContrato}
                          </Button>
                        ) : null}

                        {renewal ? (
                          <Badge
                            variant="warning"
                            className={cn("gap-1.5 px-2.5 py-1")}
                          >
                            <RefreshCw className="size-3" aria-hidden="true" />
                            {DASHBOARD.renovacionDisponible}
                          </Badge>
                        ) : null}

                        {pending ? (
                          <Link
                            href={`/demo/firma/${signer.secureLinkToken}`}
                            className="text-sm font-medium text-secondary hover:underline"
                          >
                            {ACTIONS.comenzarVerificacion}
                          </Link>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
