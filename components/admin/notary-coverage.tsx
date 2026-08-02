"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addNotaryCoverage,
  toggleCoverageStatus,
  updateNotaryCoverage,
} from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { normalizeCoverageText } from "@/lib/coverage/normalize";

type CoverageRow = {
  id: string;
  province: string;
  department: string | null;
  active: boolean;
  created_at: string | null;
  notary_id: string;
  profiles: { full_name: string; email: string } | null;
};

type Notary = {
  id: string;
  full_name: string;
  email: string;
};

interface NotaryCoverageProps {
  coverage: CoverageRow[];
  notaries: Notary[];
}

export function NotaryCoverage({ coverage, notaries }: NotaryCoverageProps) {
  const router = useRouter();
  const [notaryId, setNotaryId] = useState("");
  const [province, setProvince] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CoverageRow | null>(null);
  const [editNotaryId, setEditNotaryId] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!notaryId || !province.trim()) return;
    setSubmitting(true);
    const result = await addNotaryCoverage(
      notaryId,
      normalizeCoverageText(province),
      department ? normalizeCoverageText(department) : undefined,
    );
    setSubmitting(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Cobertura agregada.");
      setNotaryId("");
      setProvince("");
      setDepartment("");
      router.refresh();
    }
  }

  function openEdit(row: CoverageRow) {
    setEditTarget(row);
    setEditNotaryId(row.notary_id);
    setEditProvince(row.province);
    setEditDepartment(row.department ?? "");
  }

  async function handleEdit() {
    if (!editTarget || !editNotaryId || !editProvince.trim()) return;
    setEditSubmitting(true);
    const result = await updateNotaryCoverage(
      editTarget.id,
      editNotaryId,
      normalizeCoverageText(editProvince),
      editDepartment ? normalizeCoverageText(editDepartment) : undefined,
    );
    setEditSubmitting(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Cobertura editada.");
      setEditTarget(null);
      router.refresh();
    }
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    const result = await toggleCoverageStatus(id, active);
    setTogglingId(null);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(active ? "Cobertura activada." : "Cobertura desactivada.");
      router.refresh();
    }
  }

  const columns: Column<CoverageRow>[] = [
    {
      key: "notary",
      header: "Notario",
      render: (r) => r.profiles?.full_name ?? "—",
    },
    {
      key: "notary_email",
      header: "Email",
      render: (r) => r.profiles?.email ?? "—",
    },
    { key: "province", header: "Provincia" },
    {
      key: "department",
      header: "Departamento",
      render: (r) => r.department ?? "—",
    },
    {
      key: "active",
      header: "Estado",
      render: (r) =>
        r.active ? (
          <Badge variant="success">Activa</Badge>
        ) : (
          <Badge variant="muted">Inactiva</Badge>
        ),
    },
    {
      key: "created_at",
      header: "Fecha",
      render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString("es-PE") : "—",
    },
    {
      key: "actions",
      header: "Acciones",
      render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            Editar
          </Button>
          <Button
            size="sm"
            variant={r.active ? "outline" : "default"}
            onClick={() => handleToggle(r.id, !r.active)}
            disabled={togglingId === r.id}
          >
            {r.active ? "Desactivar" : "Activar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Agregar cobertura</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-4"
            onSubmit={handleAdd}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cov-notary">Notario *</Label>
              <Select
                id="cov-notary"
                value={notaryId}
                onChange={(e) => setNotaryId(e.target.value)}
                required
              >
                <option value="">Seleccionar notario</option>
                {notaries.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.full_name} ({n.email})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cov-province">Provincia *</Label>
              <Input
                id="cov-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cov-department">Departamento</Label>
              <Input
                id="cov-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={coverage}
        rowKey={(r) => r.id}
        emptyMessage="No hay cobertura registrada."
      />

      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Editar cobertura"
        message="Actualiza la zona cubierta o reasigna la cobertura a otro notario."
        confirmLabel="Guardar"
        onConfirm={handleEdit}
        loading={editSubmitting}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="edit-cov-notary">Notario *</Label>
            <Select
              id="edit-cov-notary"
              value={editNotaryId}
              onChange={(e) => setEditNotaryId(e.target.value)}
              required
            >
              <option value="">Seleccionar notario</option>
              {notaries.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.full_name} ({n.email})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-cov-province">Provincia *</Label>
            <Input
              id="edit-cov-province"
              value={editProvince}
              onChange={(e) => setEditProvince(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-cov-department">Departamento</Label>
            <Input
              id="edit-cov-department"
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
