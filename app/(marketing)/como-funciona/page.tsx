import type { Metadata } from "next";
import {
  ArrowDown,
  Building2,
  CreditCard,
  FileCheck,
  FileText,
  Link2,
  Package,
  Scale,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  COMO_FUNCIONA,
  META,
  PAGE_TITLES,
  ROLES,
  TERMINOLOGY,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/domain/types";

export const metadata: Metadata = {
  title: `${PAGE_TITLES.comoFunciona} — ${META.siteName}`,
  description: COMO_FUNCIONA.subtitulo,
};

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  role: UserRole | "system";
  evidence: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: WorkflowStep[] = [
  {
    step: 1,
    title: "El agente inmobiliario crea un paquete de arrendamiento",
    description:
      "Inicia un nuevo paquete controlado con datos básicos del inmueble y los participantes del contrato.",
    role: "realtor",
    evidence: ["Metadatos del paquete", "Código de paquete", "Registro de creación"],
    icon: Package,
  },
  {
    step: 2,
    title: "El agente carga el contrato y agrega datos",
    description:
      "Sube el documento de arrendamiento y completa los datos contractuales. La versión queda bloqueada.",
    role: "realtor",
    evidence: ["Hash de carga inicial", "Versión del documento", "Datos del contrato"],
    icon: FileText,
  },
  {
    step: 3,
    title: "El agente paga la tarifa VeraDoc",
    description:
      "Confirma el pago del servicio para activar el paquete y habilitar el envío a firmantes.",
    role: "realtor",
    evidence: ["Registro de pago", "Factura", "Estado de paquete actualizado"],
    icon: CreditCard,
  },
  {
    step: 4,
    title: "El agente envía enlaces de firma",
    description:
      "Distribuye enlaces seguros personalizados a cada firmante por correo o WhatsApp.",
    role: "realtor",
    evidence: ["Enlaces seguros", "Registro de envío", "Tokens de acceso"],
    icon: Send,
  },
  {
    step: 5,
    title: "Los firmantes verifican identidad y firman",
    description:
      "Arrendador y arrendatario completan verificación WhatsApp, consentimiento, identidad y firma digital.",
    role: "landlord",
    evidence: [
      "Verificación OTP",
      "DNI y selfie",
      "Consentimiento",
      "Firma digital IOFE",
    ],
    icon: Users,
  },
  {
    step: 6,
    title: "VeraDoc genera el Informe de Evidencia Notarial",
    description:
      "Consolida toda la evidencia recopilada en un expediente estructurado para revisión notarial.",
    role: "system",
    evidence: [
      TERMINOLOGY.informeEvidenciaNotarial,
      "Cadena de hashes",
      "Resumen por firmante",
    ],
    icon: FileCheck,
  },
  {
    step: 7,
    title: "El agente envía el paquete al notario",
    description:
      "Transfiere el expediente completo al notario participante para iniciar la revisión formal.",
    role: "realtor",
    evidence: ["Registro de envío notarial", "Estado: listo para notario"],
    icon: Link2,
  },
  {
    step: 8,
    title: "El notario revisa la evidencia",
    description:
      "Examina identidad, firmas, cadena de certificados, timestamps y verificación de registro.",
    role: "notary",
    evidence: [
      "Lista de verificación completada",
      "Registro de revisión",
      "Observaciones preliminares",
    ],
    icon: Scale,
  },
  {
    step: 9,
    title: "El notario certifica, devuelve, o rechaza",
    description:
      "Toma una decisión formal: certificar, certificar con observaciones, devolver para corrección o rechazar.",
    role: "notary",
    evidence: [
      "Decisión de certificación",
      "Observaciones notariales",
      "Hash de certificación final",
    ],
    icon: ShieldCheck,
  },
  {
    step: 10,
    title: "El contrato certificado queda disponible para todas las partes",
    description:
      "Agente, arrendador, arrendatario y notario acceden al documento certificado y su evidencia.",
    role: "system",
    evidence: [
      "Contrato certificado",
      "Acceso post-certificación",
      "Registro de descarga",
    ],
    icon: FileText,
  },
  {
    step: 11,
    title: "El registro se actualiza",
    description:
      "Se registra el arrendamiento certificado y se habilitan alertas de duplicados para futuros paquetes.",
    role: "system",
    evidence: [
      "Entrada en registro de arrendamientos",
      "Estado registral",
      "Indicador de vigencia",
    ],
    icon: Building2,
  },
];

function roleLabel(role: WorkflowStep["role"]): string {
  if (role === "system") return "VeraDoc";
  return ROLES[role];
}

function roleBadgeVariant(
  role: WorkflowStep["role"],
): "default" | "info" | "muted" {
  if (role === "notary") return "default";
  if (role === "realtor") return "info";
  if (role === "system") return "muted";
  return "info";
}

export default function ComoFuncionaPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-primary">
          {COMO_FUNCIONA.titulo}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {COMO_FUNCIONA.subtitulo}
        </p>
      </header>

      <div className="relative mt-16">
        <div
          className="absolute left-5 top-0 hidden h-full w-px bg-border md:block"
          aria-hidden="true"
        />

        <ol className="flex flex-col gap-0">
          {STEPS.map((step, index) => (
            <li key={step.step} className="relative">
              <div className="flex gap-6 pb-12">
                <div className="relative z-10 flex shrink-0 flex-col items-center">
                  <div className="flex size-10 items-center justify-center rounded-full border border-border bg-background">
                    <step.icon
                      className="size-4 text-secondary"
                      aria-hidden="true"
                    />
                  </div>
                  {index < STEPS.length - 1 ? (
                    <ArrowDown
                      className="mt-2 size-4 text-border md:hidden"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                <Card className="flex-1">
                  <CardContent className="py-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-muted">
                        {String(step.step).padStart(2, "0")}
                      </span>
                      <Badge variant={roleBadgeVariant(step.role)}>
                        {COMO_FUNCIONA.quienActua}: {roleLabel(step.role)}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-base font-semibold text-primary">
                      {step.title}
                    </h2>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                          {COMO_FUNCIONA.queSucede}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">
                          {step.description}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                          {COMO_FUNCIONA.evidenciaCreada}
                        </h3>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {step.evidence.map((item) => (
                            <li
                              key={item}
                              className={cn(
                                "text-sm text-foreground",
                                "flex gap-2 before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-secondary before:content-['']",
                              )}
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
