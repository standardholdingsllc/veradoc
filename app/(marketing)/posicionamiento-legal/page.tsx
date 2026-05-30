import type { Metadata } from "next";
import { AlertTriangle, Scale } from "lucide-react";
import { LEGAL, META, PAGE_TITLES } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `${PAGE_TITLES.posicionamientoLegal} — ${META.siteName}`,
  description: LEGAL.plataformaEvidencia,
};

const LEGAL_POINTS = [
  {
    icon: Scale,
    text: LEGAL.plataformaEvidencia,
  },
  {
    icon: Scale,
    text: LEGAL.apoyaRecopilacion,
  },
  {
    icon: Scale,
    text: LEGAL.notarioAutoridad,
  },
  {
    icon: AlertTriangle,
    text: LEGAL.produccionRequiere,
  },
] as const;

export default function PosicionamientoLegalPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          {LEGAL.titulo}
        </h1>
      </header>

      <div className="mt-12 max-w-3xl space-y-6">
        {LEGAL_POINTS.map((point, index) => (
          <div
            key={index}
            className="flex gap-4 border-b border-border pb-6 last:border-0"
          >
            <point.icon
              className="mt-1 size-5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <p className="text-base leading-relaxed text-foreground">
              {point.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 max-w-3xl rounded-md border border-border bg-surface px-6 py-5">
        <p className="text-sm leading-relaxed text-muted">{LEGAL.disclaimer}</p>
      </div>
    </div>
  );
}
