import type { Metadata } from "next";
import Link from "next/link";
import { HOMEPAGE, META, PAGE_TITLES, PRECIOS } from "@/lib/i18n/labels";

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
          VeraDoc no se posiciona como una alternativa de menor costo al proceso
          notarial tradicional. La propuesta es conveniencia: permitir que cada
          parte complete el flujo remoto desde su propio dispositivo y que el
          notario revise el expediente sin coordinar una cita conjunta.
        </p>
        <p className="mt-4">
          <Link
            href="/demo"
            className="text-sm font-medium text-secondary underline-offset-4 hover:underline"
          >
            {HOMEPAGE.ctaDemo}
          </Link>
        </p>
      </header>
    </div>
  );
}
