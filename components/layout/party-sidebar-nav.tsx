"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
}

function buildNav(basePath: string): NavItem[] {
  return [
    { label: "Panel", href: basePath, exact: true },
    { label: "Contratos", href: `${basePath}/contratos` },
    { label: "Perfil", href: `${basePath}/perfil` },
  ];
}

function isActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface PartySidebarNavProps {
  role: "landlord" | "renter";
  user: { fullName: string; email: string };
}

export function PartySidebarNav({ role, user }: PartySidebarNavProps) {
  const pathname = usePathname();
  const basePath = role === "landlord" ? "/arrendador" : "/arrendatario";
  const navItems = buildNav(basePath);
  const defaultDisplayName = role === "landlord" ? "Arrendador" : "Arrendatario";

  const handleLogout = async () => {
    const result = await logout();
    if (result.redirect) {
      window.location.href = result.redirect;
    }
  };

  return (
    <nav aria-label="Navegación lateral" className="flex h-full flex-col py-6">
      <div className="mb-6 px-4">
        <p className="truncate text-sm font-medium text-primary">
          {user.fullName || defaultDisplayName}
        </p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
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
