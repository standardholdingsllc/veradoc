"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  FileText,
  Loader2,
  Scale,
  Send,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PacketStatusTimeline } from "@/components/packet/packet-status-timeline";
import { SignerProgressCard } from "@/components/packet/signer-progress-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  generateEvidenceReport,
  getPacketById,
  submitToNotary,
} from "@/lib/services/packet-service";
import { checkDuplicate } from "@/lib/services/registry-service";
import { advanceSignerToCompleteDemo } from "@/lib/services/signer-service";
import { formatCurrency, formatDateTime, truncateHash } from "@/lib/formatters";
import {
  ACTIONS,
  DOCUMENT,
  EVIDENCE,
  PAGE_TITLES,
  PAYMENT,
  RECORD,
  REGISTRY,
  TOAST,
  UI,
  WIZARD,
} from "@/lib/i18n/labels";
import { usePacketById } from "@/lib/services/hooks";

export default function PaqueteDetallePage() {
  const params = useParams<{ packetId: string }>();
  const packetId = params.packetId;
  const [processing, setProcessing] = useState(false);

  const packet = usePacketById(packetId);

  const registryMatches = useMemo(() => {
    if (!packet) {
      return [];
    }
    return checkDuplicate(packet.property.normalizedAddressKey);
  }, [packet]);

  const refreshKey = packet?.updatedAt;

  const handleGenerateReport = useCallback(() => {
    if (!packetId || processing) {
      return;
    }
    setProcessing(true);
    try {
      generateEvidenceReport(packetId);
      toast.success(TOAST.informeGenerado);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [packetId, processing]);

  const handleSubmitToNotary = useCallback(() => {
    if (!packetId || processing) {
      return;
    }
    setProcessing(true);
    try {
      submitToNotary(packetId);
      toast.success(TOAST.paqueteEnviadoNotario);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [packetId, processing]);

  const handleSendReminder = useCallback(() => {
    toast.success(TOAST.recordatorioEnviado);
  }, []);

  const handleAdvanceSigners = useCallback(async () => {
    if (!packet || processing) {
      return;
    }

    setProcessing(true);
    try {
      for (const signer of packet.signers) {
        if (signer.status === "complete") {
          continue;
        }

        advanceSignerToCompleteDemo(signer.id, packet.id);
      }

      toast.success("Firmantes avanzados (demo)");
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [packet, processing]);

  if (!packet) {
    const fallback = getPacketById(packetId);
    if (!fallback) {
      return (
        <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8">
          <p className="text-sm text-muted">Paquete no encontrado.</p>
          <Link
            href="/demo/agente"
            className="mt-4 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
          >
            <ArrowLeft className="size-4" />
            {ACTIONS.volverAlPanel}
          </Link>
        </div>
      );
    }
  }

  const currentPacket = packet ?? getPacketById(packetId);
  if (!currentPacket) {
    return null;
  }

  const showGenerateReport = currentPacket.status === "all_signers_complete";
  const showSubmitNotary =
    currentPacket.status === "evidence_report_generated";
  const showReminder = currentPacket.status === "sent_to_signers";

  return (
    <div
      key={refreshKey}
      className="mx-auto w-full max-w-[1000px] px-4 py-8 md:px-8"
    >
      <Link
        href="/demo/agente"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {ACTIONS.volverAlPanel}
      </Link>

      <header className="mb-8 rounded-md border border-border bg-surface/30 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted">
              {PAGE_TITLES.detallePaquete}
            </p>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-primary">
              {currentPacket.packetCode}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <Badge variant="muted">
                {UI.version} {currentPacket.version}
              </Badge>
              <span>
                {UI.fechaCreacion}:{" "}
                <time dateTime={currentPacket.createdAt}>
                  {formatDateTime(currentPacket.createdAt)}
                </time>
              </span>
              <span className="font-mono">
                ID: {currentPacket.id.slice(0, 12)}…
              </span>
            </div>
          </div>
          <StatusBadge status={currentPacket.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-muted" />
                {RECORD.lineaTiempo}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <PacketStatusTimeline events={currentPacket.auditEvents} />
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {UI.firmantes}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {currentPacket.signers.map((signer) => (
                <SignerProgressCard key={signer.id} signer={signer} />
              ))}
            </div>
          </section>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-muted" />
                {EVIDENCE.documentoArrendamiento}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">{DOCUMENT.nombreArchivo}</dt>
                  <dd className="font-mono">
                    {currentPacket.leaseDocument.fileName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{DOCUMENT.fechaCarga}</dt>
                  <dd>{formatDateTime(currentPacket.leaseDocument.uploadedAt)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted">{DOCUMENT.hashInicial}</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {truncateHash(currentPacket.leaseDocument.initialHash, 8)}
                  </dd>
                </div>
              </dl>

              {currentPacket.finalSignedDocument ? (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    {EVIDENCE.documentoFirmado}
                  </p>
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">
                        {DOCUMENT.nombreArchivo}
                      </dt>
                      <dd className="font-mono">
                        {currentPacket.finalSignedDocument.fileName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{DOCUMENT.hashActual}</dt>
                      <dd className="font-mono text-xs">
                        {truncateHash(currentPacket.finalSignedDocument.hash, 8)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">
                {WIZARD.verificacionRegistro}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {currentPacket.registryCheck.matchFound ||
              registryMatches.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-warning">
                      {WIZARD.coincidenciaEncontrada}
                    </p>
                    {currentPacket.registryCheck.matchDetails ? (
                      <p className="mt-1 text-xs text-muted">
                        {currentPacket.registryCheck.matchDetails}
                      </p>
                    ) : null}
                    {registryMatches.map((entry) => (
                      <p
                        key={entry.id}
                        className="mt-1 font-mono text-xs text-muted"
                      >
                        {entry.propertyAddress} · {entry.packetId}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <p className="text-success">{WIZARD.sinCoincidencias}</p>
                </div>
              )}
              <p className="text-xs text-muted">{REGISTRY.explicacion}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">{PAYMENT.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{PAYMENT.estado}</dt>
                  <dd>
                    <Badge
                      variant={
                        currentPacket.payment.status === "paid"
                          ? "success"
                          : "warning"
                      }
                    >
                      {currentPacket.payment.status === "paid"
                        ? PAYMENT.pagado
                        : PAYMENT.pendiente}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{PAYMENT.monto}</dt>
                  <dd className="font-mono">
                    {formatCurrency(currentPacket.payment.amount)}
                  </dd>
                </div>
                {currentPacket.payment.paidAt ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{RECORD.timestamp}</dt>
                    <dd className="font-mono text-xs">
                      {formatDateTime(currentPacket.payment.paidAt)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">{PAYMENT.metodo}</dt>
                  <dd className="text-xs">
                    {currentPacket.payment.paymentMethodPlaceholder}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">{UI.acciones}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {showGenerateReport ? (
                <Button
                  className="w-full justify-start"
                  onClick={handleGenerateReport}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  {ACTIONS.generarInforme}
                </Button>
              ) : null}

              {showSubmitNotary ? (
                <Button
                  className="w-full justify-start"
                  onClick={handleSubmitToNotary}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Scale className="size-4" />
                  )}
                  {ACTIONS.enviarANotario}
                </Button>
              ) : null}

              {showReminder ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSendReminder}
                  disabled={processing}
                >
                  <Bell className="size-4" />
                  {ACTIONS.enviarRecordatorio}
                </Button>
              ) : null}

              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={handleAdvanceSigners}
                disabled={
                  processing ||
                  currentPacket.signers.every((s) => s.status === "complete")
                }
              >
                {processing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}
                Demo: avanzar firmantes
              </Button>

              {currentPacket.status === "ready_to_send" ? (
                <Link href="/demo/agente/nuevo-paquete">
                  <Button variant="outline" className="mt-2 w-full justify-start">
                    <Send className="size-4" />
                    {ACTIONS.enviarEnlaces}
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{UI.propiedad}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{currentPacket.property.address}</p>
              {currentPacket.property.unit ? (
                <p className="text-muted">{currentPacket.property.unit}</p>
              ) : null}
              <p className="font-mono text-xs text-muted">
                {currentPacket.property.district},{" "}
                {currentPacket.property.province}
              </p>
              <p className="mt-2 font-mono text-xs text-muted">
                {formatCurrency(currentPacket.leaseTerms.monthlyRent)} / mes
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
