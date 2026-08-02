import Link from "next/link";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block text-2xl font-bold text-primary">
            VeraDoc<span className="text-accent">.pe</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="size-5" />
              </div>
              <CardTitle className="text-xl">Cuenta pendiente de aprobación</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Su solicitud de registro ha sido recibida. Nuestro equipo revisará su
              información y le notificará por correo electrónico cuando su cuenta sea
              aprobada.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              Este proceso asegura que VeraDoc opere únicamente en provincias donde
              contamos con notarios asociados.
            </p>
            <div className="pt-2">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
