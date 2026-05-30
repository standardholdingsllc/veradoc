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
      "Cada documento mantiene un historial de versiones con hashes registrados en cada etapa: carga inicial, post-firmas y certificación final. Las modificaciones quedan detectables.",
  },
  {
    icon: Hash,
    title: SEGURIDAD.cadenaHashes,
    description:
      "Se calculan hashes SHA-256 del documento en puntos clave del flujo. Cualquier alteración posterior produce un hash distinto, evidenciando cambios no autorizados.",
  },
  {
    icon: ShieldCheck,
    title: SEGURIDAD.validacionCertificados,
    description:
      "Las firmas digitales se validan contra la cadena de certificados del emisor, verificando vigencia, revocación e integridad del documento firmado.",
  },
  {
    icon: ScrollText,
    title: SEGURIDAD.registroAuditoria,
    description:
      "Cada acción relevante — creación, envío, firma, revisión, certificación — queda registrada con actor, timestamp y estado resultante.",
  },
  {
    icon: Fingerprint,
    title: SEGURIDAD.capturaConsentimiento,
    description:
      "El consentimiento informado se captura con registro de aceptación, dispositivo y momento exacto, vinculado al firmante correspondiente.",
  },
  {
    icon: Monitor,
    title: SEGURIDAD.registroSesion,
    description:
      "Las sesiones de firma registran dispositivo, dirección IP aproximada y secuencia de pasos completados para trazabilidad completa.",
  },
] as const;

export default function SeguridadPage() {
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
