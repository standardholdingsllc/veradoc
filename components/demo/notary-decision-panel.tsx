"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CorrectionScope } from "@/lib/domain/types";
import { approveDemoEvidenceForSeal, reject, returnForCorrection } from "@/lib/services/notary-service";

type Choice = "approve" | "return" | "reject" | null;

export function DemoNotaryDecisionPanel({ packetId }: { packetId: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(null);
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<CorrectionScope>("notary_observation");
  const [processing, setProcessing] = useState(false);

  const submit = () => {
    if (!choice || processing) return;
    setProcessing(true);
    try {
      if (choice === "approve") approveDemoEvidenceForSeal(packetId);
      else if (choice === "return") returnForCorrection(packetId, reason.trim(), scope);
      else reject(packetId, reason.trim());
      toast.success(choice === "approve" ? "Evidencia aprobada; certificación simulada pendiente" : "Decisión simulada registrada");
      router.push("/notario");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la decisión");
    } finally {
      setProcessing(false);
    }
  };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Button type="button" variant="secondary" className="h-auto py-4" onClick={() => setChoice("approve")}>Aprobar evidencia para sello</Button>
      <Button type="button" variant="outline" className="h-auto py-4" onClick={() => setChoice("return")}>Devolver para corrección</Button>
      <Button type="button" variant="destructive" className="h-auto py-4" onClick={() => setChoice("reject")}>Rechazar</Button>
    </div>
    {choice && <Card><CardContent className="space-y-4 pt-4">
      <h3 className="text-sm font-semibold text-primary">{choice === "approve" ? "Aprobar evidencia para sello" : choice === "return" ? "Devolver para corrección" : "Rechazar expediente"}</h3>
      {choice === "approve" ? <p className="text-sm text-muted">El expediente pasará a la etapa de certificación simulada. Registre antes la consulta de autoridad de propiedad.</p> : <>
        <label className="block text-xs text-muted">Motivo
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        {choice === "return" && <label className="block text-xs text-muted">Alcance de corrección
          <select value={scope} onChange={(event) => setScope(event.target.value as CorrectionScope)} className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="notary_observation">Observación notarial</option><option value="document_metadata">Datos del documento</option><option value="identity_recheck">Identidad</option><option value="contract_revision">Contrato</option>
          </select>
        </label>}
      </>}
      <div className="flex gap-2"><Button type="button" onClick={submit} disabled={processing || (choice !== "approve" && !reason.trim())}>Confirmar decisión</Button><Button type="button" variant="outline" onClick={() => setChoice(null)}>Cancelar</Button></div>
    </CardContent></Card>}
  </div>;
}
