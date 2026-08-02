"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { suspendUser, reactivateUser } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  province: string | null;
  phone: string | null;
  dni: string | null;
  created_at: string | null;
};

interface UserManagementProps {
  users: User[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  notary: "Notario",
  realtor: "Agente",
  landlord: "Arrendador",
  renter: "Arrendatario",
};

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  admin: "info",
  notary: "info",
  realtor: "default",
  landlord: "muted",
  renter: "muted",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  pending_approval: "Pendiente",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "success",
  pending_approval: "warning",
  rejected: "error",
  suspended: "error",
};

export function UserManagement({ users, pageInfo }: UserManagementProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) => {
        const matchesSearch =
          !q.trim() ||
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.dni && u.dni.toLowerCase().includes(q));
        const matchesRole = roleFilter === "all" || u.role === roleFilter;
        const matchesStatus =
          statusFilter === "all" || u.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
      },
    );
  }, [users, search, roleFilter, statusFilter]);

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("adminTab", "users");
    params.set("usersPage", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleSuspend() {
    if (!suspendTarget) return;
    setLoading(true);
    const result = await suspendUser(suspendTarget.id);
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${suspendTarget.full_name} suspendido.`);
      setSuspendTarget(null);
      router.refresh();
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget) return;
    setLoading(true);
    const result = await reactivateUser(reactivateTarget.id);
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`${reactivateTarget.full_name} reactivado.`);
      setReactivateTarget(null);
      router.refresh();
    }
  }

  const columns: Column<User>[] = [
    { key: "full_name", header: "Nombre" },
    { key: "email", header: "Email" },
    {
      key: "role",
      header: "Rol",
      render: (r) => (
        <Badge variant={ROLE_VARIANT[r.role] ?? "muted"}>
          {ROLE_LABELS[r.role] ?? r.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (r) => (
        <Badge variant={STATUS_VARIANT[r.status] ?? "muted"}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "province",
      header: "Provincia",
      render: (r) => r.province ?? "—",
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
      render: (r) => {
        if (r.role === "admin") return null;
        if (r.status === "active") {
          return (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setSuspendTarget(r)}
            >
              Suspender
            </Button>
          );
        }
        if (r.status === "suspended") {
          return (
            <Button
              size="sm"
              onClick={() => setReactivateTarget(r)}
            >
              Reactivar
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <Input
          placeholder="Buscar por nombre, email o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filtrar por rol"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="notary">Notario</option>
          <option value="realtor">Agente</option>
          <option value="landlord">Arrendador</option>
          <option value="renter">Arrendatario</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="pending_approval">Pendiente</option>
          <option value="rejected">Rechazado</option>
          <option value="suspended">Suspendido</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        emptyMessage="No se encontraron usuarios."
      />

      <div className="flex flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Mostrando {users.length === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1}
          {"-"}
          {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.total)} de{" "}
          {pageInfo.total} usuarios. Los filtros se aplican a esta página.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(pageInfo.page - 1)}
            disabled={pageInfo.page <= 1}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(pageInfo.page + 1)}
            disabled={pageInfo.page >= pageInfo.pageCount}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <Dialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        title="Suspender usuario"
        message={`¿Está seguro que desea suspender a ${suspendTarget?.full_name}? El usuario no podrá acceder a la plataforma.`}
        confirmLabel="Suspender"
        confirmVariant="destructive"
        onConfirm={handleSuspend}
        loading={loading}
      />

      <Dialog
        open={!!reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        title="Reactivar usuario"
        message={`¿Reactivar la cuenta de ${reactivateTarget?.full_name}?`}
        confirmLabel="Reactivar"
        onConfirm={handleReactivate}
        loading={loading}
      />
    </div>
  );
}
