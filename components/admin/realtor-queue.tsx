"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveRealtor, rejectRealtor } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/ui/data-table";
import { normalizeCoverageText } from "@/lib/coverage/normalize";

type Realtor = {
  id: string;
  full_name: string;
  email: string;
  dni: string | null;
  province: string | null;
  department: string | null;
  company_name: string | null;
  ruc: string | null;
  license_number: string | null;
  phone: string | null;
  created_at: string | null;
};

interface RealtorQueueProps {
  pendingRealtors: Realtor[];
}

export function RealtorQueue({ pendingRealtors }: RealtorQueueProps) {
  const router = useRouter();
  const [approveTarget, setApproveTarget] = useState<Realtor | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Realtor | null>(null);
  const [approveProvince, setApproveProvince] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    if (!approveTarget || !approveProvince.trim()) return;
    setLoading(true);
    const result = await approveRealtor(
      approveTarget.id,
      normalizeCoverageText(approveProvince),
    );
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${approveTarget.full_name} aprobado.`);
      setApproveTarget(null);
      router.refresh();
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setLoading(true);
    const result = await rejectRealtor(
      rejectTarget.id,
      normalizeCoverageText(rejectReason),
    );
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${rejectTarget.full_name} rechazado.`);
      setRejectTarget(null);
      setRejectReason("");
      router.refresh();
    }
  }

  const columns: Column<Realtor>[] = [
    { key: "full_name", header: "Nombre" },
    { key: "email", header: "Email" },
    { key: "dni", header: "DNI", render: (r) => r.dni ?? "—" },
    { key: "province", header: "Provincia", render: (r) => r.province ?? "—" },
    {
      key: "department",
      header: "Departamento",
      render: (r) => r.department ?? "—",
    },
    {
      key: "company_name",
      header: "Empresa",
      render: (r) => r.company_name ?? "—",
    },
    { key: "ruc", header: "RUC", render: (r) => r.ruc ?? "—" },
    {
      key: "license_number",
      header: "Licencia",
      render: (r) => r.license_number ?? "—",
    },
    { key: "phone", header: "Teléfono", render: (r) => r.phone ?? "—" },
    {
      key: "created_at",
      header: "Registro",
      render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString("es-PE") : "—",
    },
    {
      key: "actions",
      header: "Acciones",
      render: (r) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => {
              setApproveProvince(r.province ?? "");
              setApproveTarget(r);
            }}
          >
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setRejectReason("");
              setRejectTarget(r);
            }}
          >
            Rechazar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={pendingRealtors}
        rowKey={(r) => r.id}
        emptyMessage="No hay agentes pendientes de aprobación."
      />

      <Dialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Aprobar agente"
        message={`¿Aprobar a ${approveTarget?.full_name}?`}
        confirmLabel="Aprobar"
        onConfirm={handleApprove}
        loading={loading}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="approve-province">Provincia</Label>
          <Input
            id="approve-province"
            value={approveProvince}
            onChange={(e) => setApproveProvince(e.target.value)}
            placeholder="Provincia del agente"
          />
        </div>
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title="Rechazar agente"
        message={`¿Está seguro que desea rechazar a ${rejectTarget?.full_name}?`}
        confirmLabel="Rechazar"
        confirmVariant="destructive"
        onConfirm={handleReject}
        loading={loading}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reject-reason">Motivo opcional</Label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30"
            placeholder="Ej. licencia vencida, datos incompletos..."
          />
          <p className="text-xs text-muted">
            Se guarda en los metadatos de autenticación hasta que exista un campo dedicado en perfiles.
          </p>
        </div>
      </Dialog>
    </>
  );
}
