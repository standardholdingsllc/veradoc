import Link from "next/link";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RejectedPage() {
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
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <XCircle className="size-5" />
              </div>
              <CardTitle className="text-xl">Solicitud no aprobada</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              Lamentamos informarle que su solicitud de registro no ha sido aprobada.
              Esto puede deberse a que actualmente no contamos con cobertura notarial
              en su provincia.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              Si cree que esto es un error o desea más información, por favor contacte
              a nuestro equipo de soporte.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Volver al inicio
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
