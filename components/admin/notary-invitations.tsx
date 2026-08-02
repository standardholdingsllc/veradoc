"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createNotaryInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { normalizeCoverageText } from "@/lib/coverage/normalize";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  invited_by: string;
};

interface NotaryInvitationsProps {
  invitations: Invitation[];
}

const STATUS_BADGE_MAP: Record<string, { label: string; variant: "success" | "warning" | "error" | "muted" }> = {
  pending: { label: "Pendiente", variant: "warning" },
  accepted: { label: "Aceptada", variant: "success" },
  expired: { label: "Expirada", variant: "muted" },
  revoked: { label: "Revocada", variant: "error" },
};

function getDisplayStatus(invitation: Invitation): string {
  if (
    invitation.status === "pending" &&
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    return "expired";
  }
  return invitation.status;
}

export function NotaryInvitations({ invitations }: NotaryInvitationsProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !province.trim()) return;
    setSubmitting(true);
    const result = await createNotaryInvitation(
      email.trim(),
      normalizeCoverageText(province),
      department ? normalizeCoverageText(department) : undefined,
    );
    setSubmitting(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Invitación enviada.");
      setEmail("");
      setProvince("");
      setDepartment("");
      router.refresh();
    }
  }

  async function handleResend(id: string) {
    setActionLoading(true);
    const result = await resendInvitation(id);
    setActionLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Invitación reenviada.");
      router.refresh();
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setActionLoading(true);
    const result = await revokeInvitation(revokeTarget.id);
    setActionLoading(false);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Invitación revocada.");
      setRevokeTarget(null);
      router.refresh();
    }
  }

  const pending = invitations.filter((inv) => getDisplayStatus(inv) === "pending");
  const accepted = invitations.filter((inv) => getDisplayStatus(inv) === "accepted");
  const other = invitations.filter(
    (inv) =>
      getDisplayStatus(inv) === "expired" ||
      getDisplayStatus(inv) === "revoked",
  );

  const pendingColumns: Column<Invitation>[] = [
    { key: "email", header: "Email" },
    {
      key: "province",
      header: "Provincia",
      render: (r) =>
        (r.metadata as Record<string, string> | null)?.province ?? "—",
    },
    {
      key: "created_at",
      header: "Creada",
      render: (r) => new Date(r.created_at).toLocaleDateString("es-PE"),
    },
    {
      key: "expires_at",
      header: "Expira",
      render: (r) => new Date(r.expires_at).toLocaleDateString("es-PE"),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (r) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResend(r.id)}
            disabled={actionLoading}
          >
            Reenviar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRevokeTarget(r)}
          >
            Revocar
          </Button>
        </div>
      ),
    },
  ];

  const acceptedColumns: Column<Invitation>[] = [
    { key: "email", header: "Email" },
    {
      key: "accepted_at",
      header: "Aceptada",
      render: (r) =>
        r.accepted_at
          ? new Date(r.accepted_at).toLocaleDateString("es-PE")
          : "—",
    },
  ];

  const otherColumns: Column<Invitation>[] = [
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Estado",
      render: (r) => {
        const cfg = STATUS_BADGE_MAP[getDisplayStatus(r)];
        return cfg ? (
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        ) : (
          getDisplayStatus(r)
        );
      },
    },
    {
      key: "created_at",
      header: "Creada",
      render: (r) => new Date(r.created_at).toLocaleDateString("es-PE"),
    },
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Nueva invitación de notario</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-4"
            onSubmit={handleCreate}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-email">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-province">Provincia *</Label>
              <Input
                id="inv-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-department">Departamento</Label>
              <Input
                id="inv-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Pendientes ({pending.length})
          </h3>
          <DataTable
            columns={pendingColumns}
            rows={pending}
            rowKey={(r) => r.id}
            emptyMessage="No hay invitaciones pendientes."
          />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Aceptadas ({accepted.length})
          </h3>
          <DataTable
            columns={acceptedColumns}
            rows={accepted}
            rowKey={(r) => r.id}
            emptyMessage="No hay invitaciones aceptadas."
          />
        </div>

        {other.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              Expiradas / Revocadas ({other.length})
            </h3>
            <DataTable
              columns={otherColumns}
              rows={other}
              rowKey={(r) => r.id}
            />
          </div>
        )}
      </div>

      <Dialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revocar invitación"
        message={`¿Está seguro que desea revocar la invitación a ${revokeTarget?.email}?`}
        confirmLabel="Revocar"
        confirmVariant="destructive"
        onConfirm={handleRevoke}
        loading={actionLoading}
      />
    </div>
  );
}
