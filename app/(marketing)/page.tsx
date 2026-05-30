import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  Building2,
  Camera,
  CheckSquare,
  Clock,
  Copy,
  FileSignature,
  FileText,
  FileX,
  FolderSearch,
  Hash,
  Home,
  Key,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Monitor,
  Package,
  Scale,
  ShieldAlert,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HOMEPAGE,
  HOMEPAGE_EVIDENCE,
  HOMEPAGE_PROBLEM,
  HOMEPAGE_SOLUTION,
  HOMEPAGE_TRUST,
  HOMEPAGE_WORKFLOW,
  META,
  ROLES,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
};

const TRUST_ITEMS = [
  {
    icon: Building2,
    title: HOMEPAGE_TRUST.paraAgentes,
    description: HOMEPAGE_TRUST.agentesDesc,
  },
  {
    icon: Home,
    title: HOMEPAGE_TRUST.paraArrendadores,
    description: HOMEPAGE_TRUST.arrendadoresDesc,
  },
  {
    icon: User,
    title: HOMEPAGE_TRUST.paraArrendatarios,
    description: HOMEPAGE_TRUST.arrendatariosDesc,
  },
  {
    icon: Scale,
    title: HOMEPAGE_TRUST.paraNotarios,
    description: HOMEPAGE_TRUST.notariosDesc,
  },
] as const;

const PROBLEM_ITEMS = [
  { icon: FileX, text: HOMEPAGE_PROBLEM.fragmentacion },
  { icon: UserX, text: HOMEPAGE_PROBLEM.identidad },
  { icon: ShieldAlert, text: HOMEPAGE_PROBLEM.confianza },
  { icon: Copy, text: HOMEPAGE_PROBLEM.duplicados },
  { icon: FolderSearch, text: HOMEPAGE_PROBLEM.recuperacion },
] as const;

const SOLUTION_ITEMS = [
  { icon: Package, title: HOMEPAGE_SOLUTION.paqueteControlado },
  { icon: UserCheck, title: HOMEPAGE_SOLUTION.verificacionFirmantes },
  { icon: FileSignature, title: HOMEPAGE_SOLUTION.evidenciaFirma },
  { icon: FileText, title: HOMEPAGE_SOLUTION.informeNotarial },
  { icon: LayoutDashboard, title: HOMEPAGE_SOLUTION.panelNotarial },
  { icon: Archive, title: HOMEPAGE_SOLUTION.almacenamiento },
] as const;

const ROLE_ITEMS = [
  {
    role: ROLES.realtor,
    icon: Building2,
    actions: [
      "Crear paquetes de arrendamiento estructurados",
      "Cargar contrato y datos del inmueble",
      "Enviar enlaces de firma a firmantes",
      "Presentar expediente completo al notario",
    ],
  },
  {
    role: ROLES.landlord,
    icon: Home,
    actions: [
      "Verificar identidad mediante WhatsApp y DNI",
      "Aceptar consentimiento informado",
      "Revisar y firmar el contrato digitalmente",
      "Acceder al contrato certificado",
    ],
  },
  {
    role: ROLES.renter,
    icon: User,
    actions: [
      "Completar verificación de identidad remota",
      "Revisar términos del arrendamiento",
      "Firmar con proveedor de firma digital",
      "Consultar estado y documento certificado",
    ],
  },
  {
    role: ROLES.notary,
    icon: Scale,
    actions: [
      "Revisar expediente de evidencia estructurado",
      "Validar identidad, firmas y cadena de certificados",
      "Certificar, devolver o rechazar el paquete",
      "Emitir contrato con respaldo documental",
    ],
  },
] as const;

const WORKFLOW_STEPS = [
  HOMEPAGE_WORKFLOW.crear,
  HOMEPAGE_WORKFLOW.verificar,
  HOMEPAGE_WORKFLOW.firmar,
  HOMEPAGE_WORKFLOW.evidencia,
  HOMEPAGE_WORKFLOW.enviar,
  HOMEPAGE_WORKFLOW.certificar,
  HOMEPAGE_WORKFLOW.registrar,
] as const;

const EVIDENCE_ITEMS = [
  { icon: User, label: "DNI" },
  { icon: Camera, label: "Selfie" },
  { icon: MessageSquare, label: "OTP" },
  { icon: CheckSquare, label: "Consentimiento" },
  { icon: Key, label: "Firma IOFE" },
  { icon: Link2, label: "Cadena de certificados" },
  { icon: Hash, label: "Hash" },
  { icon: Clock, label: "Timestamp" },
  { icon: Monitor, label: "Sesión" },
  { icon: Building2, label: "Propiedad" },
  { icon: Archive, label: "Registro" },
] as const;

function SectionContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-4", className)}>
      {children}
    </div>
  );
}

function buttonLinkClass(variant: "primary" | "outline" = "primary") {
  return cn(
    "inline-flex h-11 items-center justify-center px-6 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
    variant === "primary"
      ? "border border-primary bg-primary text-white hover:bg-primary/90"
      : "border border-border bg-transparent text-primary hover:bg-surface",
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <section className="border-b border-primary bg-primary text-white">
        <SectionContainer className="py-16 md:py-24">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
            {HOMEPAGE.heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 md:text-lg">
            {HOMEPAGE.heroSubtitle}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className={buttonLinkClass("primary")}>
              {HOMEPAGE.ctaDemo}
            </Link>
            <Link
              href="/como-funciona"
              className={cn(
                buttonLinkClass("outline"),
                "border-white/30 text-white hover:bg-white/10",
              )}
            >
              {HOMEPAGE.ctaComoFunciona}
            </Link>
          </div>
        </SectionContainer>
      </section>

      {/* 2. Trust strip */}
      <section className="border-b border-border bg-background py-12">
        <SectionContainer>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_ITEMS.map((item) => (
              <Card key={item.title}>
                <CardHeader className="pb-2">
                  <item.icon
                    className="size-5 text-secondary"
                    aria-hidden="true"
                  />
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* 3. Problem */}
      <section className="border-b border-border py-16">
        <SectionContainer>
          <h2 className="text-2xl font-semibold text-primary">
            {HOMEPAGE_PROBLEM.titulo}
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_ITEMS.map((item) => (
              <div
                key={item.text}
                className="flex gap-4 border-t border-border pt-5"
              >
                <item.icon
                  className="mt-0.5 size-5 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* 4. Solution */}
      <section className="border-b border-border bg-surface py-16">
        <SectionContainer>
          <h2 className="text-2xl font-semibold text-primary">
            {HOMEPAGE_SOLUTION.titulo}
          </h2>
          <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTION_ITEMS.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <item.icon
                    className="size-5 text-secondary"
                    aria-hidden="true"
                  />
                  <CardTitle className="text-sm font-medium">
                    {item.title}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* 5. Role-based */}
      <section className="border-b border-border py-16">
        <SectionContainer>
          <h2 className="text-2xl font-semibold text-primary">
            Por rol
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {ROLE_ITEMS.map((item) => (
              <Card key={item.role}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <item.icon
                      className="size-5 text-secondary"
                      aria-hidden="true"
                    />
                    <CardTitle>{item.role}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {item.actions.map((action) => (
                      <li
                        key={action}
                        className="flex gap-2 text-sm text-muted before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-secondary before:content-['']"
                      >
                        {action}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* 6. Workflow timeline */}
      <section className="border-b border-border bg-surface py-16">
        <SectionContainer>
          <h2 className="text-2xl font-semibold text-primary">
            {HOMEPAGE_WORKFLOW.titulo}
          </h2>
          <div className="mt-12 overflow-x-auto pb-2">
            <div className="flex min-w-[640px] items-center justify-between">
              {WORKFLOW_STEPS.map((step, index) => (
                <div
                  key={step}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex size-10 items-center justify-center border border-secondary bg-background text-xs font-medium text-primary">
                      {index + 1}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {step}
                    </span>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 ? (
                    <div
                      className="mx-2 h-px flex-1 bg-border"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* 7. Evidence packet */}
      <section className="border-b border-border py-16">
        <SectionContainer>
          <h2 className="text-2xl font-semibold text-primary">
            {HOMEPAGE_EVIDENCE.titulo}
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Cada paquete consolida evidencia estructurada para revisión
            notarial.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {EVIDENCE_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 border-t border-border py-3"
              >
                <item.icon
                  className="size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* 8. Legal positioning */}
      <section className="border-b border-border bg-surface py-16">
        <SectionContainer>
          <p className="max-w-3xl text-base leading-relaxed text-muted">
            {HOMEPAGE.posicionamiento}
          </p>
        </SectionContainer>
      </section>

      {/* 9. CTA footer */}
      <section className="py-16">
        <SectionContainer>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className={buttonLinkClass("primary")}>
              {HOMEPAGE.ctaDemo}
            </Link>
            <Link href="/contacto" className={buttonLinkClass("outline")}>
              {HOMEPAGE.ctaFinal}
            </Link>
          </div>
        </SectionContainer>
      </section>
    </div>
  );
}
