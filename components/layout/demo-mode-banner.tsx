"use client";

import { useState } from "react";
import { Copy, Info, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { NAV } from "@/lib/i18n/labels";
import { useDemoWorkspace } from "@/components/demo/demo-workspace-provider";

export function DemoModeBanner() {
  const { payload, reset } = useDemoWorkspace();
  const [resetting, setResetting] = useState(false);
  const isPresenter = payload?.accessRole === "presenter";

  async function copyNotaryLink() {
    if (!payload?.links.notary) return;
    await navigator.clipboard.writeText(payload.links.notary);
    toast.success("Enlace notarial demo copiado");
  }

  async function handleReset() {
    setResetting(true);
    try {
      await reset();
      toast.success("Espacio demo reiniciado");
    } catch {
      toast.error("No se pudo reiniciar el espacio demo");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-slate-300 bg-slate-100"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 text-sm text-slate-700">
        <span className="inline-flex items-center gap-2">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {NAV.modoDemo}
        </span>
        {isPresenter ? (
          <span className="inline-flex items-center gap-3">
            <button type="button" className="inline-flex items-center gap-1 font-medium hover:underline" onClick={copyNotaryLink}>
              <Copy className="size-3.5" aria-hidden />
              Copiar enlace notarial
            </button>
            <button type="button" className="inline-flex items-center gap-1 font-medium hover:underline" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}
              Reiniciar demo
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
