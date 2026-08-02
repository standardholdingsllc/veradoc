"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPlus, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductionStepProgress } from "@/components/signing/production-step-progress";
import { useProductionSignerContext } from "@/components/signing/production-context";
import { hasPassedStep } from "@/lib/domain/production-signer-machine";
import { createSignerAccount } from "@/lib/auth/actions";

export default function CreateAccountPage() {
  const ctx = useProductionSignerContext();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasPassedStep(ctx.signerStatus, 2)) {
      router.replace(`/firma/${ctx.token}/consentimiento`);
    }
  }, [ctx.signerStatus, ctx.token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSignerAccount(
        ctx.token,
        ctx.signerEmail,
        password,
      );
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success("Cuenta creada exitosamente");
        router.push(`/firma/${ctx.token}/consentimiento`);
      }
    } catch {
      setError("Error inesperado. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProductionStepProgress currentStep={2} />

      <Card className="mt-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-secondary" />
            <CardTitle>Crear cuenta</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Cree una cuenta para acceder a sus documentos firmados en el futuro.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={ctx.signerEmail}
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita su contraseña"
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 size-4" />
              )}
              Crear cuenta y continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
