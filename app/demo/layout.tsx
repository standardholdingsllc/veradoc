"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { UserRole } from "@/lib/domain/types";
import { useCurrentRole, useSetCurrentRole } from "@/lib/services/hooks";

function shouldShowDashboardShell(pathname: string): boolean {
  if (pathname === "/demo") {
    return false;
  }
  if (pathname.startsWith("/demo/firma")) {
    return false;
  }
  return true;
}

export default function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const currentRole = useCurrentRole();
  const setCurrentRole = useSetCurrentRole();
  const showShell = shouldShowDashboardShell(pathname);

  useEffect(() => {
    const routeRoleMap: { prefix: string; role: UserRole }[] = [
      { prefix: "/demo/agente", role: "realtor" },
      { prefix: "/demo/notario", role: "notary" },
      { prefix: "/demo/arrendador", role: "landlord" },
      { prefix: "/demo/arrendatario", role: "renter" },
    ];

    const match = routeRoleMap.find((entry) => pathname.startsWith(entry.prefix));
    if (match && match.role !== currentRole) {
      setCurrentRole(match.role);
    }
  }, [currentRole, pathname, setCurrentRole]);

  return (
    <div className="flex min-h-screen flex-col">
      <Toaster position="top-right" richColors closeButton />
      <DemoModeBanner />
      {showShell ? (
        <DashboardShell sidebar={<SidebarNav />}>{children}</DashboardShell>
      ) : (
        <main className="flex-1">{children}</main>
      )}
    </div>
  );
}
