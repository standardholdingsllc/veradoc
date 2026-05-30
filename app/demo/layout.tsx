"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { SidebarNav } from "@/components/layout/sidebar-nav";

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
  const showShell = shouldShowDashboardShell(pathname);

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
