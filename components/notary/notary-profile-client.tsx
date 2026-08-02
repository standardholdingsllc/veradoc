"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateProfileAction,
  changePasswordAction,
} from "@/lib/actions/profile";
import { FORMS, UI } from "@/lib/i18n/labels";

interface ProfileData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  province: string | null;
  department: string | null;
  accreditation_number: string | null;
}

interface NotaryProfileClientProps {
  profile: ProfileData;
}

export function NotaryProfileClient({ profile }: NotaryProfileClientProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);

    const result = await updateProfileAction(
      { full_name: fullName, phone: phone || undefined },
      ["/notario/perfil", "/notario"],
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Perfil actualizado");
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (savingPassword) return;

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSavingPassword(true);
    const result = await changePasswordAction(currentPassword, newPassword);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Contraseña actualizada");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Datos del notario</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.nombreCompleto}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.correoElectronico}
              </span>
              <input
                type="email"
                value={profile.email ?? ""}
                readOnly
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.whatsapp}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.dni}
              </span>
              <input
                type="text"
                value={profile.dni ?? ""}
                readOnly
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-muted"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                Número de acreditación
              </span>
              <input
                type="text"
                value={profile.accreditation_number ?? ""}
                readOnly
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-muted"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.provincia}
              </span>
              <input
                type="text"
                value={profile.province ?? ""}
                readOnly
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.departamento}
              </span>
              <input
                type="text"
                value={profile.department ?? ""}
                readOnly
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="size-4 animate-spin" />}
              {UI.guardar}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-1 sm:max-w-sm">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                Contraseña actual
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                Nueva contraseña
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-muted">
                {FORMS.confirmarContrasena}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={
                savingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {savingPassword && <Loader2 className="size-4 animate-spin" />}
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
