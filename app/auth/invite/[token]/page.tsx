"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { acceptNotaryInvite } from "@/lib/auth/actions";

const inputClassName = cn(
  "h-12 w-full rounded-md border border-border bg-background px-4 text-base",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30",
);

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
    fullName: "",
    dni: "",
    accreditationNumber: "",
    province: "",
    department: "",
    phone: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const passwordsMatch = form.password === form.confirmPassword;
  const canSubmit =
    form.fullName.trim() &&
    form.password.trim().length >= 8 &&
    passwordsMatch &&
    form.province.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || !canSubmit) return;

    setLoading(true);
    const result = await acceptNotaryInvite({
      token: params.token,
      password: form.password,
      fullName: form.fullName,
      dni: form.dni,
      accreditationNumber: form.accreditationNumber,
      province: form.province,
      department: form.department,
      phone: form.phone,
    });

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success("Cuenta de notario configurada correctamente.");
      window.location.href = result.redirect ?? "/";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block text-2xl font-bold text-primary">
            VeraDoc<span className="text-accent">.pe</span>
          </Link>
          <p className="mt-2 text-sm text-muted">
            Configuración de cuenta notarial
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Complete su perfil de notario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-sm text-muted">
              Ha sido invitado a la plataforma VeraDoc como notario asociado.
              Complete los siguientes datos para activar su cuenta.
            </p>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="fullName" className="text-sm font-medium">
                    Nombre completo *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className={inputClassName}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Contraseña *
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className={inputClassName}
                    required
                  />
                  {form.password && form.password.length < 8 && (
                    <p className="text-xs text-destructive">Mínimo 8 caracteres</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmar contraseña *
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    className={inputClassName}
                    required
                  />
                  {form.confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="dni" className="text-sm font-medium">
                    DNI
                  </label>
                  <input
                    id="dni"
                    type="text"
                    value={form.dni}
                    onChange={(e) => updateField("dni", e.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="phone" className="text-sm font-medium">
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="accreditationNumber" className="text-sm font-medium">
                    Número de acreditación notarial
                  </label>
                  <input
                    id="accreditationNumber"
                    type="text"
                    value={form.accreditationNumber}
                    onChange={(e) => updateField("accreditationNumber", e.target.value)}
                    className={inputClassName}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="province" className="text-sm font-medium">
                    Provincia *
                  </label>
                  <input
                    id="province"
                    type="text"
                    value={form.province}
                    onChange={(e) => updateField("province", e.target.value)}
                    className={inputClassName}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="department" className="text-sm font-medium">
                    Departamento
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={form.department}
                    onChange={(e) => updateField("department", e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-12 min-h-12 w-full text-base"
                size="lg"
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                Activar cuenta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
