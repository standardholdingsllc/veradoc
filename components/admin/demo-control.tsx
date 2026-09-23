"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { setDemoAvailability } from "@/lib/admin/demo-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DemoControl({
  initialEnabled,
  available,
  updatedAt,
}: {
  initialEnabled: boolean;
  available: boolean;
  updatedAt?: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function update(nextEnabled: boolean) {
    startTransition(async () => {
      const result = await setDemoAvailability(nextEnabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEnabled(Boolean(result.enabled));
      toast.success(nextEnabled ? "Demo habilitada" : "Demo desconectada");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interruptor de emergencia de la demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!available ? (
          <div className="flex items-start gap-3 border border-warning/40 bg-warning/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            El canal de control de la demo no está configurado o no responde. Por seguridad, la demo también falla cerrada cuando su backend no está disponible.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={`inline-flex size-3 rounded-full ${enabled ? "bg-success" : "bg-accent"}`} />
              <div>
                <p className="font-medium">{enabled ? "Demo en línea" : "Demo fuera de línea"}</p>
                <p className="text-sm text-muted">
                  {enabled
                    ? "Los espacios demo y sus APIs están disponibles."
                    : "Las páginas y APIs demo responden como no disponibles."}
                </p>
              </div>
            </div>
            {updatedAt ? <p className="text-xs text-muted">Último cambio: {new Date(updatedAt).toLocaleString("es-PE")}</p> : null}
            <Button
              variant={enabled ? "destructive" : "secondary"}
              disabled={pending}
              onClick={() => update(!enabled)}
            >
              {enabled ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
              {pending ? "Actualizando…" : enabled ? "Desconectar demo" : "Habilitar demo"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
