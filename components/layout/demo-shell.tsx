"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { DemoWorkspaceProvider } from "@/components/demo/demo-workspace-provider";
import type { UserRole } from "@/lib/domain/types";
import { useCurrentRole, useSetCurrentRole } from "@/lib/services/hooks";

function shouldShowDashboardShell(pathname: string): boolean {
  const publicPath = pathname.startsWith("/demo") ? pathname.slice(5) || "/" : pathname;
  if (publicPath === "/") return false;
  if (publicPath.startsWith("/firma")) return false;
  return true;
}

function DemoShellContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const currentRole = useCurrentRole();
  const setCurrentRole = useSetCurrentRole();
  const showShell = shouldShowDashboardShell(pathname);

  useEffect(() => {
    const publicPath = pathname.startsWith("/demo") ? pathname.slice(5) || "/" : pathname;
    const routeRoleMap: { prefix: string; role: UserRole }[] = [
      { prefix: "/agente", role: "realtor" },
      { prefix: "/notario", role: "notary" },
      { prefix: "/arrendador", role: "landlord" },
      { prefix: "/arrendatario", role: "renter" },
    ];
    const match = routeRoleMap.find((entry) => publicPath.startsWith(entry.prefix));
    if (match && match.role !== currentRole) setCurrentRole(match.role);
  }, [currentRole, pathname, setCurrentRole]);

  return (
    <div className="flex min-h-screen flex-col">
      <Toaster position="top-right" richColors closeButton />
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            aria-label="VeraDoc.pe — inicio de la demostración"
          >
            <Image
              src="/brand/veradoc-icon-transparent.svg"
              alt=""
              width={44}
              height={56}
              priority
              className="h-10 w-auto"
            />
            <span className="font-serif text-2xl font-semibold leading-none text-primary">
              VeraDoc.pe
            </span>
          </Link>
        </div>
      </header>
      <DemoModeBanner />
      {showShell ? (
        <DashboardShell sidebar={<SidebarNav />}>{children}</DashboardShell>
      ) : (
        <main className="flex-1">{children}</main>
      )}
    </div>
  );
}

export function DemoShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DemoWorkspaceProvider>
      <DemoShellContent>{children}</DemoShellContent>
    </DemoWorkspaceProvider>
  );
}
