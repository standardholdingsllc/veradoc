import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { CONTACTO, META, PAGE_TITLES } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `${PAGE_TITLES.contacto} — ${META.siteName}`,
  description: CONTACTO.subtitulo,
};

export default function ContactoPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-primary">
          {CONTACTO.titulo}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {CONTACTO.subtitulo}
        </p>
      </header>

      <div className="mt-12 max-w-md border-l-2 border-secondary py-1 pl-6">
        <div className="flex items-center gap-3">
          <Mail className="size-5 text-secondary" aria-hidden="true" />
          <a
            href="mailto:contacto@veradoc.pe"
            className="text-base font-medium text-primary hover:underline"
          >
            contacto@veradoc.pe
          </a>
        </div>
        <p className="mt-6 text-sm text-muted">{CONTACTO.placeholder}</p>
      </div>
    </div>
  );
}
