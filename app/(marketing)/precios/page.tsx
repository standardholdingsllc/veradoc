import type { Metadata } from "next";
import Link from "next/link";
import { META, NAV, PAGE_TITLES, PRECIOS } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `${PAGE_TITLES.precios} — ${META.siteName}`,
  description: PRECIOS.subtitulo,
};

export default function PreciosPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-primary">
          {PRECIOS.titulo}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted">
          Próximamente — Contáctenos para información sobre precios.
        </p>
        <p className="mt-4">
          <Link
            href="/contacto"
            className="text-sm font-medium text-secondary underline-offset-4 hover:underline"
          >
            {NAV.contactenos}
          </Link>
        </p>
      </header>
    </div>
  );
}
