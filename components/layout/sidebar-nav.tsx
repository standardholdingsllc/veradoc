"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/domain/types";
import { SIDEBAR } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  realtor: [
    { label: SIDEBAR.panel, href: "/demo/agente", exact: true },
    { label: SIDEBAR.paquetes, href: "/demo/agente/paquetes" },
    { label: SIDEBAR.nuevoPaquete, href: "/demo/agente/nuevo-paquete" },
    { label: SIDEBAR.registro, href: "/demo/registro" },
  ],
  notary: [
    { label: SIDEBAR.panel, href: "/demo/notario", exact: true },
    { label: SIDEBAR.colaNotarial, href: "/demo/notario/cola" },
    { label: SIDEBAR.registro, href: "/demo/registro" },
  ],
  landlord: [
    { label: SIDEBAR.panel, href: "/demo/arrendador", exact: true },
    { label: SIDEBAR.contratos, href: "/demo/arrendador/contratos" },
  ],
  renter: [
    { label: SIDEBAR.panel, href: "/demo/arrendatario", exact: true },
    { label: SIDEBAR.contratos, href: "/demo/arrendatario/contratos" },
  ],
};

const ROUTE_ROLE_MAP: { prefix: string; role: UserRole }[] = [
  { prefix: "/demo/agente", role: "realtor" },
  { prefix: "/demo/notario", role: "notary" },
  { prefix: "/demo/arrendador", role: "landlord" },
  { prefix: "/demo/arrendatario", role: "renter" },
  { prefix: "/demo/registro", role: "realtor" },
];

function roleFromPathname(pathname: string): UserRole {
  const match = ROUTE_ROLE_MAP.find((entry) => pathname.startsWith(entry.prefix));
  return match?.role ?? "realtor";
}

function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const currentRole = roleFromPathname(pathname);
  const items = NAV_BY_ROLE[currentRole];

  return (
    <nav aria-label="Navegación lateral" className="flex h-full flex-col py-6">
      <ul className="flex flex-col gap-1 px-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-l-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-secondary font-medium text-primary"
                    : "border-transparent text-muted hover:border-border hover:text-primary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
