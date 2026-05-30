import { META } from "@/lib/i18n/labels";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <p className="text-center text-sm text-muted">
          © 2024 {META.siteName} — Plataforma de evidencia notarial para
          arrendamientos
        </p>
      </div>
    </footer>
  );
}
