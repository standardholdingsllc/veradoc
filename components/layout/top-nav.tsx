"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { META, NAV } from "@/lib/i18n/labels";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { cn } from "@/lib/utils";

const MARKETING_LINKS = [
  { href: "/", label: NAV.inicio },
  { href: "/como-funciona", label: NAV.comoFunciona },
  { href: "/evidencia", label: NAV.seguridad },
  { href: "/posicionamiento-legal", label: NAV.posicionamientoLegal },
  { href: "/precios", label: NAV.precios },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDemoMode = pathname.startsWith("/demo");

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/88 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label={`${META.siteName} — ${NAV.inicio}`}
        >
          <Image
            src="/brand/veradoc-icon-transparent.svg"
            alt=""
            width={44}
            height={56}
            priority
            className="h-12 w-auto"
          />
          <span className="font-serif text-[1.7rem] font-semibold leading-none text-primary">
            VeraDoc.pe
          </span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-6 md:flex"
        >
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isDemoMode ? (
            <RoleSwitcher />
          ) : (
            <Link
              href="/demo"
              className="inline-flex h-10 items-center justify-center border border-primary bg-primary px-4 text-sm font-semibold text-surface transition-colors hover:bg-accent"
            >
              {NAV.verDemostracion}
            </Link>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center p-2 text-primary md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-border bg-surface md:hidden"
        >
          <nav aria-label="Navegación móvil" className="flex flex-col px-4 py-4">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "border-secondary text-primary"
                    : "border-transparent text-muted hover:border-border hover:text-primary",
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 border-t border-border pt-4">
              {isDemoMode ? (
                <RoleSwitcher />
              ) : (
                <Link
                  href="/demo"
                  className="inline-flex h-10 w-full items-center justify-center border border-primary bg-primary px-4 text-sm font-semibold text-surface transition-colors hover:bg-accent"
                >
                  {NAV.verDemostracion}
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
