"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Stamp,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACTIONS, CONFIRM, CORRECTION_SCOPE, TOAST } from "@/lib/i18n/labels";
import type { CorrectionScope } from "@/lib/domain/types";
import { ATTESTATION_TEXT_ES } from "@/lib/domain/notary-seal-types";
import { deriveSealWorkflowSteps } from "@/lib/domain/notary-seal-types";
import type { SealWorkflowState } from "@/lib/domain/notary-seal-types";
import {
  retrieveSignedPdfForPrintingAction,
  uploadNotarialScanAction,
  submitNotaryAttestationAction,
  prepareNotarizedCertificationAction,
  finalizeNotarizedCertificationAction,
  returnForCorrectionFromSealAction,
  rejectFromSealAction,
} from "@/lib/actions/notary-seal";

interface SealWorkflowPanelProps {
  packetId: string;
  workflowState: SealWorkflowState;
}

type StepId = "download" | "upload" | "attest" | "prepare" | "publish";

export function SealWorkflowPanel({ packetId, workflowState }: SealWorkflowPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [declaredAddedPages, setDeclaredAddedPages] = useState(0);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionScope, setCorrectionScope] =
    useState<CorrectionScope>("notary_observation");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [showRejection, setShowRejection] = useState(false);

  const [attestChecks, setAttestChecks] = useState({
    page_count_matches: false,
    all_pages_legible: false,
    sello_applied: false,
    physical_signature_applied: false,
    no_content_altered: false,
  });

  const derivedSteps = deriveSealWorkflowSteps(workflowState);
  const currentStep = derivedSteps.find((s) => s.active)?.id ?? "publish";

  const steps: { id: StepId; label: string; icon: React.ReactNode }[] = [
    { id: "download", label: "Descargar", icon: <Download className="size-4" /> },
    { id: "upload", label: "Subir escaneo", icon: <Upload className="size-4" /> },
    { id: "attest", label: "Atestación", icon: <Stamp className="size-4" /> },
    { id: "prepare", label: "Reporte", icon: <FileUp className="size-4" /> },
    { id: "publish", label: "Publicar", icon: <Send className="size-4" /> },
  ];

  const stepIndex = steps.findIndex((s) => s.id === currentStep);

  // --- Step 1: Download ---
  const handleDownload = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await retrieveSignedPdfForPrintingAction(packetId);
        window.open(result.url, "_blank");
        router.refresh();
        toast.success("URL de descarga generada — imprima el documento, aplique el sello y firma, y escanee el resultado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al generar URL");
      }
    });
  }, [packetId, router]);

  // --- Step 2: Upload ---
  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);

      startTransition(async () => {
        try {
          const result = await uploadNotarialScanAction(
            packetId,
            formData,
            declaredAddedPages,
          );
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          if (result.data) {
            router.refresh();
            toast.success(TOAST.escaneoSubido);
            if (result.data.warnings.length > 0) {
              for (const w of result.data.warnings) {
                toast.warning(w);
              }
            }
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al subir");
        }
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [packetId, declaredAddedPages, router],
  );

  const handleReplace = useCallback(() => {
    setAttestChecks({
      page_count_matches: false,
      all_pages_legible: false,
      sello_applied: false,
      physical_signature_applied: false,
      no_content_altered: false,
    });
    toast.info(TOAST.escaneoReemplazado);
  }, []);

  // --- Step 3: Attestation ---
  const allAttestChecked = Object.values(attestChecks).every(Boolean);

  const handleAttest = useCallback(() => {
    if (!workflowState.acceptedScan) return;
    startTransition(async () => {
      try {
        await submitNotaryAttestationAction(packetId, workflowState.acceptedScan!.id, {
          ...attestChecks,
          additional_certification_pages: declaredAddedPages,
        });
        router.refresh();
        toast.success(TOAST.atestacionConfirmada);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar atestación");
      }
    });
  }, [packetId, workflowState.acceptedScan, attestChecks, declaredAddedPages, router]);

  // --- Step 4: Prepare ---
  const handlePrepare = useCallback(() => {
    if (!workflowState.acceptedScan) return;
    startTransition(async () => {
      try {
        await prepareNotarizedCertificationAction(
          packetId,
          workflowState.acceptedScan!.id,
        );
        router.refresh();
        toast.success("Preparación encolada. El reporte se generará en segundo plano.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al preparar reporte");
      }
    });
  }, [packetId, workflowState.acceptedScan, router]);

  // --- Step 5: Publish ---
  const handlePublish = useCallback(() => {
    if (!workflowState.preparedCertification) return;
    startTransition(async () => {
      try {
        await finalizeNotarizedCertificationAction(
          packetId,
          workflowState.preparedCertification!.id,
        );
        toast.success("Publicación encolada. Puede consultar el avance en la cola.");
        router.push("/");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al publicar");
      }
    });
  }, [packetId, workflowState.preparedCertification, router]);

  // --- Correction / Rejection ---
  const handleCorrection = useCallback(() => {
    if (!correctionReason.trim()) return;
    startTransition(async () => {
      try {
        await returnForCorrectionFromSealAction(
          packetId,
          correctionReason.trim(),
          correctionScope,
        );
        toast.success(TOAST.devueltoCorreccion);
        router.push("/");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }, [packetId, correctionReason, correctionScope, router]);

  const handleRejection = useCallback(() => {
    if (!rejectionReason.trim()) return;
    startTransition(async () => {
      try {
        await rejectFromSealAction(packetId, rejectionReason.trim());
        toast.success(TOAST.paqueteRechazado);
        router.push("/");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }, [packetId, rejectionReason, router]);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step.id} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={cn(
                    "h-px w-6 shrink-0",
                    done ? "bg-green-500" : "bg-border",
                  )}
                />
              )}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                  done && "bg-green-50 text-green-700",
                  active && "bg-primary/10 text-primary ring-1 ring-primary/30",
                  !done && !active && "bg-surface text-muted",
                )}
              >
                {done ? (
                  <CheckCircle2 className="size-3.5 text-green-600" />
                ) : (
                  step.icon
                )}
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {currentStep === "download" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descargar PDF firmado para imprimir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Descargue el documento firmado por las partes. Imprima todas las páginas,
              aplique el sello notarial y su firma física, y escanee el documento completo.
            </p>
            <Button onClick={handleDownload} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {ACTIONS.descargarParaImprimir}
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subir escaneo con certificación notarial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Suba el PDF escaneado del documento con el sello notarial y firma física aplicados.
            </p>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Páginas de certificación adicionales
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={declaredAddedPages}
                  onChange={(e) => setDeclaredAddedPages(Number(e.target.value))}
                  className="mt-1 block w-24 rounded-md border border-border px-3 py-1.5 text-sm"
                />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
                variant="secondary"
              >
                {isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                Seleccionar archivo PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "attest" && workflowState.acceptedScan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirmar atestación notarial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border bg-surface/30 p-3 text-xs space-y-1">
              <p><strong>Archivo:</strong> {workflowState.acceptedScan.hash.slice(0, 16)}…</p>
              <p><strong>Páginas:</strong> {workflowState.acceptedScan.pageCount ?? "—"}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReplace}
              disabled={isPending}
            >
              <RefreshCw className="mr-1 size-3" />
              {ACTIONS.reemplazarEscaneo}
            </Button>

            <div className="rounded-md border border-border bg-surface/20 p-4 text-xs whitespace-pre-line leading-relaxed">
              {ATTESTATION_TEXT_ES}
            </div>

            <div className="space-y-2">
              {(
                [
                  ["page_count_matches", "Todas las páginas están presentes"],
                  ["all_pages_legible", "Todas las páginas son legibles"],
                  ["sello_applied", "El sello notarial ha sido aplicado"],
                  ["physical_signature_applied", "La firma física ha sido aplicada"],
                  ["no_content_altered", "No se modificó el contenido contractual"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attestChecks[key]}
                    onChange={(e) =>
                      setAttestChecks((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="size-4 rounded border-border"
                  />
                  {label}
                </label>
              ))}
            </div>

            <Button
              onClick={handleAttest}
              disabled={isPending || !allAttestChecked}
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 size-4" />
              )}
              {ACTIONS.confirmarAtestacion}
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "prepare" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preparar reporte de verificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              VeraDoc generará un reporte de verificación que documenta la cadena de evidencia,
              los hashes de documentos, y la atestación notarial.
            </p>
            <Button onClick={handlePrepare} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 size-4" />
              )}
              {ACTIONS.prepararReporte}
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "publish" && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-base text-green-800">
              Publicar documento con certificación notarial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700">
              Todos los pasos están completos. Al publicar, el documento con certificación
              notarial de firmas será distribuido a todas las partes del contrato.
            </p>
            <Button onClick={handlePublish} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              {ACTIONS.publicarDocumentoNotarizado}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Escape hatches */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCorrection(!showCorrection)}
          disabled={isPending}
        >
          {ACTIONS.devolverParaCorreccion}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowRejection(!showRejection)}
          disabled={isPending}
        >
          <XCircle className="mr-1 size-3" />
          {ACTIONS.rechazar}
        </Button>
      </div>

      {showCorrection && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm font-medium">{CONFIRM.devolverTitulo}</p>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              rows={3}
              placeholder="Motivo de corrección..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <label className="block space-y-1 text-xs font-medium text-muted">
              Alcance de corrección
              <select
                value={correctionScope}
                onChange={(event) => setCorrectionScope(event.target.value as CorrectionScope)}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-primary"
              >
                {Object.entries(CORRECTION_SCOPE).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              onClick={handleCorrection}
              disabled={isPending || !correctionReason.trim()}
            >
              Confirmar devolución
            </Button>
          </CardContent>
        </Card>
      )}

      {showRejection && (
        <Card className="border-red-200">
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm font-medium text-red-800">
              {CONFIRM.rechazarDesdeSelloTitulo}
            </p>
            <p className="text-xs text-red-600">
              {CONFIRM.rechazarDesdeSelloMensaje}
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Motivo detallado de rechazo..."
              className="w-full rounded-md border border-red-200 bg-background px-3 py-2 text-sm"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejection}
              disabled={isPending || !rejectionReason.trim()}
            >
              Confirmar rechazo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
