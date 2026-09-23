"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePacketById } from "@/lib/services/hooks";
import { advanceDemoSeal } from "@/lib/services/notary-service";
import { formatDateTime } from "@/lib/formatters";

export default function DemoCertificationPage() {
  const { packetId } = useParams<{ packetId: string }>();
  const [attestationChecks, setAttestationChecks] = useState<Record<string, boolean>>({});
  const packet = usePacketById(packetId);
  if (!packet) return <p className="p-8 text-sm text-muted">Paquete no encontrado.</p>;
  const workflow = packet.demoSealWorkflow ?? {};
  const active = packet.status === "awaiting_notary_seal";
  const attestations = [
    "Todas las páginas están presentes",
    "Todas las páginas son legibles",
    "El sello notarial se aplicó en esta simulación",
    "La firma física se aplicó en esta simulación",
    "El contenido contractual no se modificó",
  ];
  const steps = [
    { key: "prepare_document" as const, title: "1. Preparar documento firmado", detail: "Registre la preparación del PDF firmado para la etapa notarial.", done: workflow.signedDocumentPreparedAt, enabled: true },
    { key: "attest" as const, title: "2. Registrar atestación", detail: "Confirme que el sello y la firma física se aplicaron en esta simulación.", done: workflow.attestedAt, enabled: !!workflow.signedDocumentPreparedAt },
    { key: "prepare_report" as const, title: "3. Preparar reporte de verificación", detail: "Registre el reporte de evidencia y la atestación simulada.", done: workflow.reportPreparedAt, enabled: !!workflow.attestedAt },
    { key: "publish" as const, title: "4. Publicar a las partes", detail: "El contrato certificado aparecerá en las vistas de arrendador y arrendatario.", done: workflow.publishedAt, enabled: !!workflow.reportPreparedAt },
  ];

  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
    <div>
      <Link href={`/notario/paquetes/${packet.id}`} className="text-sm text-secondary hover:underline">← Volver al expediente</Link>
      <h1 className="mt-3 text-xl font-semibold text-primary">Certificación notarial · simulación</h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted"><span className="font-mono">{packet.packetCode}</span><StatusBadge status={packet.status} /></div>
      <p className="mt-2 text-sm text-muted">Estos pasos registran datos sintéticos. No se carga un escaneo ni se emite un sello real.</p>
    </div>
    {steps.map((step) => <Card key={step.key}>
      <CardHeader><CardTitle className="text-base">{step.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">{step.detail}</p>
        {step.key === "prepare_document" && <p className="rounded-md border border-border bg-surface p-3 text-xs text-muted">PDF firmado: {packet.finalSignedDocument?.fileName ?? packet.leaseDocument.fileName}</p>}
        {step.key === "attest" && !step.done && <div className="space-y-2 rounded-md border border-border p-3">
          {attestations.map((label) => <label key={label} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!attestationChecks[label]} onChange={(event) => setAttestationChecks((current) => ({ ...current, [label]: event.target.checked }))} />{label}</label>)}
        </div>}
        {step.done ? <p className="text-sm text-secondary">Registrado: {formatDateTime(step.done)}</p> : <Button
          type="button" disabled={!active || !step.enabled || (step.key === "attest" && !attestations.every((label) => attestationChecks[label]))}
          onClick={() => {
            try { advanceDemoSeal(packet.id, step.key); toast.success(step.key === "publish" ? "Documento simulado publicado a las partes" : "Paso simulado registrado"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo completar el paso"); }
          }}
        >{step.key === "publish" ? "Publicar documento simulado" : "Registrar paso simulado"}</Button>}
      </CardContent>
    </Card>)}
    {workflow.publishedAt && <div className="rounded-md border border-secondary/30 bg-secondary/5 p-4 text-sm">
      El documento certificado simulado ya está disponible para ambas partes. <Link href={`/arrendador/contratos/${packet.id}`} className="text-secondary underline">Ver arrendador</Link> · <Link href={`/arrendatario/contratos/${packet.id}`} className="text-secondary underline">Ver arrendatario</Link>
    </div>}
  </div>;
}
