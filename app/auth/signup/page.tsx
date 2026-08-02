"use client";

import { type FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  completeGoogleSignup,
  loginWithGoogle,
  signupRealtor,
} from "@/lib/auth/actions";

const inputClassName = cn(
  "h-12 w-full rounded-md border border-border bg-background px-4 text-base",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30",
);

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGoogleFlow = searchParams.get("provider") === "google";
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  useEffect(() => {
    if (!isGoogleFlow) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setGoogleEmail(user.email);
    });
  }, [isGoogleFlow]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    dni: "",
    licenseNumber: "",
    province: "",
    department: "",
    companyName: "",
    ruc: "",
    phone: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const passwordsMatch = form.password === form.confirmPassword;
  const canSubmitEmail =
    form.fullName.trim() &&
    form.email.trim() &&
    form.password.trim().length >= 8 &&
    passwordsMatch &&
    form.dni.trim() &&
    form.province.trim();

  const canSubmitGoogle =
    form.fullName.trim() && form.dni.trim() && form.province.trim();

  const canSubmit = isGoogleFlow ? canSubmitGoogle : canSubmitEmail;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || !canSubmit) return;

    setLoading(true);

    if (isGoogleFlow) {
      const result = await completeGoogleSignup({
        fullName: form.fullName,
        dni: form.dni,
        licenseNumber: form.licenseNumber,
        province: form.province,
        department: form.department,
        companyName: form.companyName,
        ruc: form.ruc,
        phone: form.phone,
      });

      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success("Perfil completado. Su cuenta está pendiente de aprobación.");
        router.push("/auth/pending-approval");
      }
    } else {
      const result = await signupRealtor({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        dni: form.dni,
        licenseNumber: form.licenseNumber,
        province: form.province,
        department: form.department,
        companyName: form.companyName,
        ruc: form.ruc,
        phone: form.phone,
      });

      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success("Cuenta creada. Revise su correo para confirmar.");
        router.push("/auth/pending-approval");
      }
    }
  }

  async function handleGoogleSignup() {
    if (googleLoading) return;
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    if (result?.error) {
      toast.error(result.error);
      setGoogleLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {isGoogleFlow ? "Completar registro" : "Crear cuenta"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isGoogleFlow && (
          <div className="mb-5 rounded-md bg-secondary/10 p-3 text-sm text-secondary">
            Autenticado con Google. Complete su perfil de agente para continuar.
          </div>
        )}

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

            {isGoogleFlow && googleEmail && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="googleEmail" className="text-sm font-medium">
                  Correo electrónico
                </label>
                <input
                  id="googleEmail"
                  type="email"
                  value={googleEmail}
                  disabled
                  className={cn(inputClassName, "cursor-not-allowed opacity-60")}
                />
              </div>
            )}

            {!isGoogleFlow && (
              <>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico *
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
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
              </>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="dni" className="text-sm font-medium">
                DNI *
              </label>
              <input
                id="dni"
                type="text"
                value={form.dni}
                onChange={(e) => updateField("dni", e.target.value)}
                className={inputClassName}
                required
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

            <div className="flex flex-col gap-2">
              <label htmlFor="licenseNumber" className="text-sm font-medium">
                Número de licencia
              </label>
              <input
                id="licenseNumber"
                type="text"
                value={form.licenseNumber}
                onChange={(e) => updateField("licenseNumber", e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="companyName" className="text-sm font-medium">
                Empresa
              </label>
              <input
                id="companyName"
                type="text"
                value={form.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="ruc" className="text-sm font-medium">
                RUC
              </label>
              <input
                id="ruc"
                type="text"
                value={form.ruc}
                onChange={(e) => updateField("ruc", e.target.value)}
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

            <div className="flex flex-col gap-2 sm:col-span-2">
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
            {isGoogleFlow ? "Completar registro" : "Registrarse"}
          </Button>
        </form>

        {!isGoogleFlow && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted">o</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-12 min-h-12 w-full text-base"
              size="lg"
              disabled={googleLoading}
              onClick={handleGoogleSignup}
            >
              {googleLoading ? (
                <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
              ) : (
                <svg className="mr-2 size-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Registrarse con Google
            </Button>
          </>
        )}

        <div className="mt-6 text-center text-sm text-muted">
          <span>¿Ya tiene cuenta? </span>
          <Link
            href="/auth/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block text-2xl font-bold text-primary">
            VeraDoc<span className="text-accent">.pe</span>
          </Link>
          <p className="mt-2 text-sm text-muted">
            Registro para agentes inmobiliarios
          </p>
        </div>

        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
