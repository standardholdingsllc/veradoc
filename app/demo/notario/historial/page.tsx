"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePackets } from "@/lib/services/hooks";
import { formatDateTime } from "@/lib/formatters";

export default function DemoNotaryHistoryPage() {
  const packets = usePackets().filter((packet) => ["certified", "certified_with_observations", "needs_correction", "rejected"].includes(packet.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 md:px-8">
    <div><h1 className="text-xl font-semibold text-primary">Historial notarial</h1><p className="mt-1 text-sm text-muted">Resultados y decisiones del espacio demo compartido.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Expedientes finalizados o devueltos</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="px-4 py-3">Paquete</th><th className="px-4 py-3">Propiedad</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Última actividad</th></tr></thead>
        <tbody>{packets.map((packet) => <tr key={packet.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><Link href={`/notario/paquetes/${packet.id}`} className="font-mono text-secondary hover:underline">{packet.packetCode}</Link></td><td className="px-4 py-3">{packet.property.address}</td><td className="px-4 py-3"><StatusBadge status={packet.status} /></td><td className="px-4 py-3 text-xs text-muted">{formatDateTime(packet.updatedAt)}</td></tr>)}
          {packets.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Sin decisiones registradas</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
