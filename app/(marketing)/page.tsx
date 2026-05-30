import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  Building2,
  CheckCircle2,
  FileSignature,
  FileText,
  Home,
  Package,
  Scale,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  HOMEPAGE,
  HOMEPAGE_EVIDENCE,
  HOMEPAGE_PROBLEM,
  HOMEPAGE_SOLUTION,
  HOMEPAGE_TRUST,
  HOMEPAGE_WORKFLOW,
  META,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
};

const AUDIENCES = [
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

const CORE_FLOW = [
  {
    icon: Package,
    title: HOMEPAGE_WORKFLOW.crear,
    detail: HOMEPAGE_SOLUTION.paqueteControlado,
  },
  {
    icon: ShieldCheck,
    title: HOMEPAGE_WORKFLOW.verificar,
    detail: HOMEPAGE_SOLUTION.verificacionFirmantes,
  },
  {
    icon: FileSignature,
    title: HOMEPAGE_WORKFLOW.firmar,
    detail: HOMEPAGE_SOLUTION.evidenciaFirma,
  },
  {
    icon: Scale,
    title: HOMEPAGE_WORKFLOW.certificar,
    detail: HOMEPAGE_SOLUTION.informeNotarial,
  },
] as const;

const EVIDENCE = [
  "DNI y selfie",
  "Consentimiento",
  "Firma digital",
  "Hash SHA-256",
  "Timestamp",
  "Registro de auditoría",
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
    "inline-flex h-11 items-center justify-center border px-6 text-sm font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-2",
    variant === "primary"
      ? "border-primary bg-primary text-surface hover:bg-accent"
      : "border-border bg-surface/70 text-primary hover:border-primary",
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-border/70">
        <SectionContainer className="grid min-h-[calc(84svh-5rem)] items-center gap-12 py-14 md:grid-cols-[1.04fr_0.72fr] md:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Evidencia notarial para arrendamientos
            </p>
            <h1 className="mt-5 max-w-4xl font-serif text-4xl font-semibold leading-[1.03] text-primary md:text-6xl">
              Certifique contratos de alquiler con presencia, orden y respaldo.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              VeraDoc.pe convierte firmas remotas, identidad y documentos en un
              expediente claro para revisión notarial en Perú.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className={buttonLinkClass("primary")}>
                {HOMEPAGE.ctaDemo}
              </Link>
              <Link
                href="/como-funciona"
                className={buttonLinkClass("outline")}
              >
                {HOMEPAGE.ctaComoFunciona}
              </Link>
            </div>
          </div>

          <aside className="paper-panel hidden rounded-md p-5 md:block md:p-7">
            <div className="border-b border-border/70 pb-5">
              <p className="font-serif text-2xl font-semibold text-primary">
                Informe de Evidencia Notarial
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Un paquete legible para agentes, firmantes y notarios.
              </p>
            </div>
            <div className="grid gap-3 py-5">
              {EVIDENCE.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2
                    className="size-4 shrink-0 text-secondary"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {item}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/70 pt-5 text-sm leading-6 text-muted">
              {HOMEPAGE.posicionamiento}
            </div>
          </aside>
        </SectionContainer>
      </section>

      <section className="border-b border-border/70 py-14">
        <SectionContainer>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((item) => (
              <article key={item.title} className="border-t border-border pt-5">
                <item.icon className="size-5 text-secondary" aria-hidden="true" />
                <h2 className="mt-4 text-base font-semibold text-primary">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section className="border-b border-border/70 py-16">
        <SectionContainer className="grid gap-10 md:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              El problema
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-primary md:text-4xl">
              {HOMEPAGE_PROBLEM.titulo}
            </h2>
          </div>
          <div className="grid gap-5">
            {[
              HOMEPAGE_PROBLEM.fragmentacion,
              HOMEPAGE_PROBLEM.identidad,
              HOMEPAGE_PROBLEM.confianza,
            ].map((text) => (
              <p
                key={text}
                className="border-l border-border pl-5 text-base leading-7 text-foreground"
              >
                {text}
              </p>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section className="border-b border-border/70 bg-surface/44 py-16">
        <SectionContainer>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Sistema
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-primary md:text-4xl">
              {HOMEPAGE_SOLUTION.titulo}
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {CORE_FLOW.map((item, index) => (
              <article key={item.title} className="paper-panel rounded-md p-5">
                <div className="flex items-center justify-between gap-3">
                  <item.icon className="size-5 text-secondary" aria-hidden="true" />
                  <span className="font-mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-semibold text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section className="py-16">
        <SectionContainer className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {HOMEPAGE_EVIDENCE.titulo}
            </p>
            <h2 className="mt-3 max-w-3xl font-serif text-3xl font-semibold text-primary md:text-4xl">
              Evidencia estructurada, lista para una decisión profesional.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Link href="/demo" className={buttonLinkClass("primary")}>
              {HOMEPAGE.ctaDemo}
            </Link>
            <Link href="/contacto" className={buttonLinkClass("outline")}>
              {HOMEPAGE.ctaFinal}
            </Link>
          </div>
        </SectionContainer>
        <SectionContainer className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: FileText,
              title: "Documento",
              detail: "Versiones bloqueadas y hashes verificables.",
            },
            {
              icon: Archive,
              title: "Auditoría",
              detail: "Acciones, tiempos y actores en un solo expediente.",
            },
            {
              icon: Scale,
              title: "Notaría",
              detail: "Revisión enfocada en evidencia, no en reconstruir hechos.",
            },
          ].map((item) => (
            <article key={item.title} className="border-t border-border pt-5">
              <item.icon className="size-5 text-secondary" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            </article>
          ))}
        </SectionContainer>
      </section>
    </div>
  );
}
