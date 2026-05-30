"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { CorrectionScope } from "@/lib/domain/types";
import {
  certify,
  certifyWithObservations,
  reject,
  returnForCorrection,
} from "@/lib/services/notary-service";
import {
  ACTIONS,
  CONFIRM,
  CORRECTION_SCOPE,
  ERRORS,
  FORMS,
  TOAST,
  UI,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DialogType =
  | "certify"
  | "certify_observations"
  | "return"
  | "reject"
  | null;

interface DecisionPanelProps {
  packetId: string;
  className?: string;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
  onCancel,
  children,
  disabled,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "default" | "secondary" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-dialog-title"
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2
              id="decision-dialog-title"
              className="text-base font-semibold text-primary"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {UI.cancelar}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={disabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DecisionPanel({ packetId, className }: DecisionPanelProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogType>(null);
  const [observations, setObservations] = useState("");
  const [reason, setReason] = useState("");
  const [correctionScope, setCorrectionScope] =
    useState<CorrectionScope>("notary_observation");
  const [processing, setProcessing] = useState(false);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setObservations("");
    setReason("");
    setCorrectionScope("notary_observation");
  }, []);

  const handleSuccess = useCallback(
    (message: string) => {
      toast.success(message);
      closeDialog();
      router.push("/demo/notario");
    },
    [closeDialog, router],
  );

  const handleCertify = useCallback(async () => {
    setProcessing(true);
    try {
      certify(packetId);
      handleSuccess(TOAST.paqueteCertificado);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [handleSuccess, packetId]);

  const handleCertifyWithObservations = useCallback(async () => {
    if (!observations.trim()) {
      toast.error(ERRORS.observacionesRequeridas);
      return;
    }
    setProcessing(true);
    try {
      certifyWithObservations(packetId, observations.trim());
      handleSuccess(TOAST.paqueteCertificadoConObservaciones);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [handleSuccess, observations, packetId]);

  const handleReturn = useCallback(async () => {
    if (!reason.trim()) {
      toast.error(ERRORS.motivoRequerido);
      return;
    }
    setProcessing(true);
    try {
      returnForCorrection(packetId, reason.trim(), correctionScope);
      handleSuccess(TOAST.devueltoCorreccion);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [correctionScope, handleSuccess, packetId, reason]);

  const handleReject = useCallback(async () => {
    if (!reason.trim()) {
      toast.error(ERRORS.motivoRequerido);
      return;
    }
    setProcessing(true);
    try {
      reject(packetId, reason.trim());
      handleSuccess(TOAST.paqueteRechazado);
    } catch {
      toast.error(TOAST.errorGenerico);
    } finally {
      setProcessing(false);
    }
  }, [handleSuccess, packetId, reason]);

  return (
    <>
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
          className,
        )}
      >
        <Button
          type="button"
          variant="secondary"
          className="h-auto flex-col gap-2 py-4"
          onClick={() => setDialog("certify")}
        >
          <ShieldCheck className="size-5" aria-hidden="true" />
          {ACTIONS.certificar}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col gap-2 py-4"
          onClick={() => setDialog("certify_observations")}
        >
          <AlertTriangle className="size-5" aria-hidden="true" />
          {ACTIONS.certificarConObservaciones}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto flex-col gap-2 py-4"
          onClick={() => setDialog("return")}
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          {ACTIONS.devolverParaCorreccion}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-auto flex-col gap-2 py-4"
          onClick={() => setDialog("reject")}
        >
          <XCircle className="size-5" aria-hidden="true" />
          {ACTIONS.rechazar}
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === "certify"}
        title={CONFIRM.certificarTitulo}
        message={CONFIRM.certificarMensaje}
        confirmLabel={ACTIONS.certificar}
        confirmVariant="secondary"
        onConfirm={handleCertify}
        onCancel={closeDialog}
        disabled={processing}
      />

      <ConfirmDialog
        open={dialog === "certify_observations"}
        title={CONFIRM.certificarConObservacionesTitulo}
        message={CONFIRM.certificarConObservacionesMensaje}
        confirmLabel={ACTIONS.certificarConObservaciones}
        confirmVariant="secondary"
        onConfirm={handleCertifyWithObservations}
        onCancel={closeDialog}
        disabled={processing || !observations.trim()}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {FORMS.observacionesNotariales}
          </span>
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={FORMS.observacionesNotariales}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "return"}
        title={CONFIRM.devolverTitulo}
        message={CONFIRM.devolverMensaje}
        confirmLabel={ACTIONS.devolverParaCorreccion}
        onConfirm={handleReturn}
        onCancel={closeDialog}
        disabled={processing || !reason.trim()}
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {FORMS.motivoCorreccion}
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Alcance de corrección
            </span>
            <select
              value={correctionScope}
              onChange={(event) =>
                setCorrectionScope(event.target.value as CorrectionScope)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {Object.entries(CORRECTION_SCOPE).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "reject"}
        title={CONFIRM.rechazarTitulo}
        message={CONFIRM.rechazarMensaje}
        confirmLabel={ACTIONS.rechazar}
        confirmVariant="destructive"
        onConfirm={handleReject}
        onCancel={closeDialog}
        disabled={processing || !reason.trim()}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {FORMS.motivoRechazo}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </ConfirmDialog>
    </>
  );
}

export function DecisionResultSummary({
  decision,
  observations,
  rejectionReason,
  correctionReason,
  certifiedAt,
  className,
}: {
  decision?: string;
  observations?: string;
  rejectionReason?: string;
  correctionReason?: string;
  certifiedAt?: string;
  className?: string;
}) {
  if (!decision) {
    return null;
  }

  return (
    <Card className={cn("border-secondary/30 bg-secondary/5", className)}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-secondary" aria-hidden="true" />
          <p className="text-sm font-semibold text-primary">
            Decisión registrada: {decision}
          </p>
        </div>
        {observations ? (
          <p className="text-sm text-muted">
            {FORMS.observacionesNotariales}: {observations}
          </p>
        ) : null}
        {rejectionReason ? (
          <p className="text-sm text-muted">
            {FORMS.motivoRechazo}: {rejectionReason}
          </p>
        ) : null}
        {correctionReason ? (
          <p className="text-sm text-muted">
            {FORMS.motivoCorreccion}: {correctionReason}
          </p>
        ) : null}
        {certifiedAt ? (
          <p className="font-mono text-xs text-muted">{certifiedAt}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
