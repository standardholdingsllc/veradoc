import Link from "next/link";
import { BookOpen } from "lucide-react";
import { FOOTER, META } from "@/lib/i18n/labels";

const LEGAL_LINKS = [
  { href: "/privacidad", label: FOOTER.privacidad },
  { href: "/terminos", label: FOOTER.terminos },
  { href: "/devoluciones", label: FOOTER.devoluciones },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border print:hidden">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: brand + description */}
          <div className="max-w-sm text-center sm:text-left">
            <p className="text-sm font-semibold text-primary">
              {META.siteName}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {FOOTER.descripcion}
            </p>
            <p className="mt-2 text-xs text-muted">
              VERADOC S.A.C.S. · RUC 20616178548 · Lima, Perú
            </p>
          </div>

          {/* Center: legal links */}
          <nav aria-label="Enlaces legales" className="flex flex-col items-center gap-2 sm:items-end">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-muted transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Libro de Reclamaciones – prominent per INDECOPI Anexo III */}
            <Link
              href="/libro-de-reclamaciones"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
            >
              <BookOpen className="size-3.5" aria-hidden="true" />
              {FOOTER.libroReclamaciones}
            </Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-center text-xs text-muted">
            © {new Date().getFullYear()} {META.siteName} — {FOOTER.derechos}
          </p>
        </div>
      </div>
    </footer>
  );
}
