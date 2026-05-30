import type { Metadata } from "next";
import {
  Clock,
  FileStack,
  Fingerprint,
  Hash,
  Monitor,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { META, PAGE_TITLES, SEGURIDAD } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `${PAGE_TITLES.seguridad} — ${META.siteName}`,
  description: SEGURIDAD.subtitulo,
};

const SECURITY_CONCEPTS = [
  {
    icon: FileStack,
    title: SEGURIDAD.versionesDocumento,
    description:
      "El expediente conserva las versiones relevantes del contrato para que la revisión notarial parta de una secuencia clara.",
  },
  {
    icon: Hash,
    title: SEGURIDAD.cadenaHashes,
    description:
      "Los hashes ayudan a confirmar que el documento revisado corresponde a la versión presentada en el flujo.",
  },
  {
    icon: ShieldCheck,
    title: SEGURIDAD.validacionCertificados,
    description:
      "La firma digital conforme a IOFE y su validación se organizan dentro del expediente para que el notario participante pueda evaluarlas junto con el resto del soporte.",
  },
  {
    icon: ScrollText,
    title: SEGURIDAD.registroAuditoria,
    description:
      "Cada acción relevante queda ordenada con actor, momento y estado resultante para reducir reconstrucción manual.",
  },
  {
    icon: Fingerprint,
    title: SEGURIDAD.capturaConsentimiento,
    description:
      "El consentimiento se presenta vinculado al firmante correspondiente, junto con el momento de aceptación.",
  },
  {
    icon: Monitor,
    title: SEGURIDAD.registroSesion,
    description:
      "La sesión muestra dispositivo y secuencia de pasos completados para contextualizar la firma remota.",
  },
] as const;

export default function EvidenciaPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-primary">
          {SEGURIDAD.titulo}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {SEGURIDAD.subtitulo}
        </p>
      </header>

      <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {SECURITY_CONCEPTS.map((concept) => (
          <Card key={concept.title}>
            <CardHeader>
              <concept.icon
                className="size-5 text-secondary"
                aria-hidden="true"
              />
              <CardTitle className="text-base">{concept.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted">
                {concept.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 border-l-2 border-secondary py-1 pl-6">
        <div className="flex gap-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted">
            Estos conceptos se demuestran con datos simulados en la versión
            actual.
          </p>
        </div>
      </div>
    </div>
  );
}
