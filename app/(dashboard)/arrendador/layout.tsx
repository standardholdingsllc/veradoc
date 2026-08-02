import { requireApproved } from "@/lib/auth/guards";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PartySidebarNav } from "@/components/layout/party-sidebar-nav";

export default async function ArrendadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApproved("landlord");
  const profile = await getCurrentProfile();

  return (
    <DashboardShell
      sidebar={
        <PartySidebarNav
          role="landlord"
          user={{
            fullName: profile?.full_name ?? "",
            email: profile?.email ?? "",
          }}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
