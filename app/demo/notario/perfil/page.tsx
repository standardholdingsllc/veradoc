"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUsers } from "@/lib/services/hooks";

export default function DemoNotaryProfilePage() {
  const notary = useUsers().find((user) => user.role === "notary");
  return <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-8">
    <div><h1 className="text-xl font-semibold text-primary">Perfil notarial</h1><p className="mt-1 text-sm text-muted">Persona y credenciales sintéticas del espacio demo.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Datos del notario</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-2">
      <p><span className="block text-xs text-muted">Nombre</span>{notary?.fullName ?? "—"}</p>
      <p><span className="block text-xs text-muted">Correo de ejemplo</span>{notary?.email ?? "—"}</p>
      <p><span className="block text-xs text-muted">Acreditación</span>{notary?.accreditationNumber ?? "—"}</p>
      <p><span className="block text-xs text-muted">Estado</span>{notary?.profileStatus ?? "—"}</p>
    </CardContent></Card>
  </div>;
}
