import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { META } from "@/lib/i18n/labels";
import { ComplaintForm } from "@/components/legal/complaint-form";

export const metadata: Metadata = {
  title: `Libro de Reclamaciones — ${META.siteName}`,
  description:
    "Libro de Reclamaciones Virtual de VeraDoc conforme a la Ley N° 29571 y DS 011-2011-PCM (INDECOPI).",
};

export default function LibroReclamacionesPage() {
  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="size-8 text-accent" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-primary">
            Libro de Reclamaciones
          </h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Conforme a lo establecido en el Código de Protección y Defensa del
          Consumidor (Ley N° 29571) y el Decreto Supremo N° 011-2011-PCM, VERADOC
          S.A.C.S. pone a disposición del consumidor el presente Libro de
          Reclamaciones Virtual.
        </p>
      </header>

      {/* Provider identification – required by Anexo I */}
      <div className="mb-10 rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Identificación del Proveedor
        </h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Razón social</dt>
            <dd className="font-medium">VERADOC S.A.C.S.</dd>
          </div>
          <div>
            <dt className="text-muted">RUC</dt>
            <dd className="font-medium">20616178548</dd>
          </div>
          <div>
            <dt className="text-muted">Domicilio</dt>
            <dd className="font-medium">Lima, Perú</dd>
          </div>
          <div>
            <dt className="text-muted">Rubro</dt>
            <dd className="font-medium">
              Plataforma digital de certificación de arrendamientos
            </dd>
          </div>
        </dl>
      </div>

      <ComplaintForm />
    </article>
  );
}
