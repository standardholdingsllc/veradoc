"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { SigningContextError } from "@/lib/signing/resolve-context";

const ERROR_TITLES: Record<SigningContextError["code"], string> = {
  invalid_token: "Enlace inválido",
  expired_token: "Enlace expirado",
  revoked_token: "Enlace revocado",
  server_error: "Error del servidor",
};

export function SigningTokenError({ error }: { error: SigningContextError }) {
  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          <CardTitle>{ERROR_TITLES[error.code]}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Si cree que esto es un error, comuníquese con el agente inmobiliario
          que le envió este enlace.
        </p>
      </CardContent>
    </Card>
  );
}
