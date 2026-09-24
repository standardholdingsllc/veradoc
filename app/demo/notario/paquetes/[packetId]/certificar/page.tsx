"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Loader2,
  Send,
  Stamp,
  Upload,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDemoWorkspace } from "@/components/demo/demo-workspace-provider";
import { usePacketById } from "@/lib/services/hooks";
import { advanceDemoSeal } from "@/lib/services/notary-service";
import { createDemoPrintDocument } from "@/lib/demo/print-document";
import { formatDateTime } from "@/lib/formatters";

const MAX_SCAN_BYTES = 15 * 1024 * 1024;

const ATTESTATIONS = [
  "Todas las páginas están presentes",
  "Todas las páginas son legibles",
  "El sello notarial se aplicó en esta simulación",
  "La firma física se aplicó en esta simulación",
  "El contenido contractual no se modificó",
] as const;

async function inspectDemoScan(file: File, addedPages: number) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_SCAN_BYTES) {
    throw new Error("Seleccione un archivo PDF de hasta 15 MB");
  }

  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("El archivo seleccionado no parece ser un PDF válido");
  }

  const pdf = await PDFDocument.load(bytes);
  const pageCount = pdf.getPageCount();
  if (pageCount < 1 || pageCount > 500) {
    throw new Error("El PDF debe contener entre 1 y 500 páginas");
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return {
    fileName: file.name.slice(0, 160),
    fileSizeBytes: file.size,
    pageCount,
    sha256,
    additionalCertificationPages: addedPages,
  };
}

export default function DemoCertificationPage() {
  const { packetId } = useParams<{ packetId: string }>();
  const [processing, setProcessing] = useState(false);
  const [attestationChecks, setAttestationChecks] = useState<Record<string, boolean>>({});
  const [addedPages, setAddedPages] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { saveNow } = useDemoWorkspace();
  const packet = usePacketById(packetId);

  if (!packet) return <p className="p-8 text-sm text-muted">Paquete no encontrado.</p>;
  const currentPacket = packet;

  const workflow = currentPacket.demoSealWorkflow ?? {};
  const active = currentPacket.status === "awaiting_notary_seal";
  const steps = [
    { id: "download", label: "Descargar para imprimir", icon: <Download className="size-4" />, done: !!workflow.signedDocumentPreparedAt },
    { id: "upload", label: "Subir escaneo con sello", icon: <Upload className="size-4" />, done: !!workflow.scanUploadedAt },
    { id: "attest", label: "Atestación", icon: <Stamp className="size-4" />, done: !!workflow.attestedAt },
    { id: "prepare", label: "Reporte", icon: <FileUp className="size-4" />, done: !!workflow.reportPreparedAt },
    { id: "publish", label: "Publicar", icon: <Send className="size-4" />, done: !!workflow.publishedAt },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);
  const currentStep = steps[activeIndex]?.id;
  const uploadedScan = workflow.notarialScan;

  async function recordStep(step: "prepare_document" | "attest" | "prepare_report" | "publish") {
    if (processing) return;
    setProcessing(true);
    try {
      advanceDemoSeal(currentPacket.id, step);
      await saveNow();
      toast.success(step === "publish" ? "Documento simulado publicado a las partes" : "Paso simulado registrado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar el paso");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDownload() {
    if (processing || !active) return;
    setProcessing(true);
    try {
      const bytes = await createDemoPrintDocument(currentPacket);
      const buffer = bytes.slice().buffer as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${currentPacket.packetCode.toLowerCase()}-muestra-demo-para-imprimir.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      advanceDemoSeal(currentPacket.id, "prepare_document");
      await saveNow();
      toast.success("PDF de muestra descargado. Es un documento simulado, sin validez legal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo preparar el PDF");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || processing || !active) return;

    setProcessing(true);
    try {
      const scan = await inspectDemoScan(file, addedPages);
      advanceDemoSeal(currentPacket.id, "upload_scan", scan);
      await saveNow();
      toast.success("Escaneo registrado en el espacio demo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el escaneo");
    } finally {
      setProcessing(false);
    }
  }

  const allAttestationsChecked = ATTESTATIONS.every((label) => attestationChecks[label]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <div>
          <Link href={`/notario/paquetes/${currentPacket.id}`} className="text-sm text-secondary hover:underline">
          ← Volver al expediente
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-primary">Certificación notarial · simulación</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted">
          <span className="font-mono">{currentPacket.packetCode}</span>
          <StatusBadge status={currentPacket.status} />
        </div>
        <p className="mt-3 rounded-md border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-muted">
          Flujo de demostración: el PDF de impresión es una muestra y el escaneo solo se valida en este navegador.
          Se guardan el nombre, páginas y hash del archivo; su contenido no se carga ni se conserva.
        </p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const done = step.done;
          const isCurrent = index === activeIndex;
          return (
            <div key={step.id} className="flex items-center gap-1">
              {index > 0 && <div className={cnStepConnector(index <= activeIndex)} />}
              <div className={[
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                done ? "bg-green-50 text-green-700" : isCurrent ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-surface text-muted",
              ].join(" ")}>
                {done ? <CheckCircle2 className="size-3.5 text-green-600" aria-hidden="true" /> : step.icon}
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {currentStep === "download" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Descargar PDF firmado para imprimir</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Descargue una muestra con los datos del expediente. El archivo queda marcado como DEMO y no sustituye el contrato firmado real.
            </p>
            <Button onClick={handleDownload} disabled={processing || !active}>
              {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              Descargar PDF firmado para imprimir
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "upload" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Subir escaneo con certificación notarial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Seleccione el PDF escaneado para simular la carga del documento con sello y firma física.
            </p>
            <label className="block text-sm font-medium">
              Páginas de certificación adicionales
              <input
                type="number"
                min={0}
                max={20}
                value={addedPages}
                onChange={(event) => setAddedPages(Math.min(20, Math.max(0, Number(event.target.value) || 0)))}
                className="mt-1 block w-24 rounded-md border border-border px-3 py-1.5 text-sm"
              />
            </label>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handleUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={processing || !active} variant="secondary">
              {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
              Seleccionar archivo PDF
            </Button>
            {uploadedScan && (
              <div className="rounded-md border border-border bg-surface/50 p-3 text-sm">
                <p className="font-medium">{uploadedScan.fileName}</p>
                <p className="mt-1 text-muted">{uploadedScan.pageCount} páginas · {(uploadedScan.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</p>
                <p className="mt-1 break-all font-mono text-xs text-muted">SHA-256: {uploadedScan.sha256}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === "attest" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Atestación del escaneo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {uploadedScan && <p className="text-sm text-muted">PDF: {uploadedScan.fileName} · {uploadedScan.pageCount} páginas · {uploadedScan.additionalCertificationPages} páginas adicionales</p>}
            <div className="space-y-2 rounded-md border border-border p-3">
              {ATTESTATIONS.map((label) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!attestationChecks[label]}
                    onChange={(event) => setAttestationChecks((current) => ({ ...current, [label]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <Button onClick={() => void recordStep("attest")} disabled={processing || !active || !allAttestationsChecked}>
              {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Stamp className="mr-2 size-4" />}
              Confirmar atestación
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "prepare" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Preparar reporte de certificación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">Registre el reporte simulado con los datos del escaneo y la atestación.</p>
            <Button onClick={() => void recordStep("prepare_report")} disabled={processing || !active}>
              {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}
              Preparar reporte
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === "publish" && !workflow.publishedAt && (
        <Card>
          <CardHeader><CardTitle className="text-base">Publicar documento certificado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">Publique el resultado simulado para que aparezca en las vistas de las partes.</p>
            <Button onClick={() => void recordStep("publish")} disabled={processing || !active}>
              {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Publicar documento simulado
            </Button>
          </CardContent>
        </Card>
      )}

      {workflow.publishedAt && (
        <div className="space-y-3 rounded-md border border-secondary/30 bg-secondary/5 p-4 text-sm">
          <p className="font-medium text-primary">Certificación simulada publicada</p>
          <p className="text-muted">Registrada: {formatDateTime(workflow.publishedAt)}</p>
          <p>El documento certificado simulado ya está disponible para ambas partes.</p>
          <div className="flex flex-wrap gap-4">
            <Link href={`/arrendador/contratos/${currentPacket.id}`} className="text-secondary underline">Ver arrendador</Link>
            <Link href={`/arrendatario/contratos/${currentPacket.id}`} className="text-secondary underline">Ver arrendatario</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function cnStepConnector(done: boolean) {
  return `h-px w-6 shrink-0 ${done ? "bg-green-500" : "bg-border"}`;
}
