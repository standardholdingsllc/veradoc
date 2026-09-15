"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { SIDEBAR } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
  badge?: number;
}

const AGENT_NAV: NavItem[] = [
  { label: SIDEBAR.panel, href: "/agente", exact: true },
  { label: SIDEBAR.nuevoPaquete, href: "/agente/nuevo-paquete" },
  { label: "Perfil", href: "/agente/perfil" },
];

const NOTARY_NAV: NavItem[] = [
  { label: "Cola", href: "/", exact: true },
  { label: "Historial", href: "/historial" },
  { label: "Ganancias", href: "/ganancias" },
  { label: "Perfil", href: "/perfil" },
];

function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface ProductionSidebarNavProps {
  user: { fullName: string; email: string };
  role?: "realtor" | "notary";
  notificationCount?: number;
}

export function ProductionSidebarNav({
  user,
  role = "realtor",
  notificationCount = 0,
}: ProductionSidebarNavProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    const result = await logout();
    if (result.redirect) {
      window.location.href = result.redirect;
    }
  };

  const navItems = role === "notary" ? NOTARY_NAV : AGENT_NAV;
  const defaultDisplayName = role === "notary" ? "Notario" : "Agente";
  const badgeHref = role === "notary" ? "/" : "/agente";
  const notificationLabel =
    notificationCount > 0
      ? `${notificationCount} notificaciones pendientes`
      : "Sin notificaciones pendientes";

  return (
    <nav aria-label="Navegación lateral" className="flex h-full flex-col py-6">
      <div className="mb-6 flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">
            {user.fullName || defaultDisplayName}
          </p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <Link
          href={badgeHref}
          aria-label={notificationLabel}
          title={notificationLabel}
          className={cn(
            "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors hover:text-primary",
            notificationCount > 0 && "border-secondary/30 text-secondary",
          )}
        >
          <Bell className="size-4" aria-hidden="true" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </Link>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const showBadge =
            notificationCount > 0 && item.href === badgeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between border-l-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-secondary font-medium text-primary"
                    : "border-transparent text-muted hover:border-border hover:text-primary",
                )}
              >
                {item.label}
                {showBadge && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto px-3 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-primary"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
