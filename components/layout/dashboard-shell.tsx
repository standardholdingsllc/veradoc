"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  className?: string;
}

export function DashboardShell({
  children,
  sidebar,
  className,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className={cn("flex min-h-[calc(100vh-41px)] flex-col md:flex-row", className)}>
      <div className="flex items-center border-b border-border px-4 py-3 md:hidden">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md p-2 text-primary"
          aria-expanded={mobileNavOpen}
          aria-controls="dashboard-mobile-nav"
          aria-label={mobileNavOpen ? "Cerrar navegación" : "Abrir navegación"}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileNavOpen ? (
        <nav
          id="dashboard-mobile-nav"
          aria-label="Navegación del panel"
          className="border-b border-border md:hidden"
        >
          {sidebar}
        </nav>
      ) : null}

      <aside
        className="hidden w-[240px] shrink-0 border-r border-border bg-background md:block"
        aria-label="Navegación del panel"
      >
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
