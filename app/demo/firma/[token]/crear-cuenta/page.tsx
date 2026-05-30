"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignerStepProgress } from "@/components/signing/signer-step-progress";
import { SIGNER_STEP_LABELS } from "@/components/signing/signer-step-labels";
import { useSignerContext } from "@/components/signing/use-signer-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ERRORS,
  FORMS,
  PAGE_TITLES,
  SIGNER,
  TOAST,
} from "@/lib/i18n/labels";
import { createAccount } from "@/lib/services/signer-service";
import { cn } from "@/lib/utils";

export default function SignerCrearCuentaPage() {
  const router = useRouter();
  const context = useSignerContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!context) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted">{ERRORS.enlaceInvalido}</p>
        </CardContent>
      </Card>
    );
  }

  const { basePath, packet, signer } = context;

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    confirmPassword.trim().length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) {
      return;
    }

    setLoading(true);
    try {
      createAccount(signer.id, packet.id);
      toast.success(SIGNER.cuentaCreada);
      router.push(`${basePath}/consentimiento`);
    } catch {
      toast.error(TOAST.errorGenerico);
      setLoading(false);
    }
  }

  const inputClassName = cn(
    "h-12 w-full rounded-md border border-border bg-background px-4 text-base",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30",
  );

  return (
    <div className="flex flex-col gap-6">
      <SignerStepProgress currentStep={2} steps={[...SIGNER_STEP_LABELS]} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{PAGE_TITLES.crearCuenta}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                {FORMS.correoElectronico}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                {FORMS.contrasena}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                {FORMS.confirmarContrasena}
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClassName}
              />
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
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
