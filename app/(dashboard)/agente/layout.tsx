import { requireApproved } from "@/lib/auth/guards";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductionSidebarNav } from "@/components/layout/production-sidebar-nav";

export default async function AgenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApproved("realtor");
  const profile = await getCurrentProfile();

  const supabase = await createClient();
  const { count } = await supabase
    .from("lease_packets")
    .select("id", { count: "exact", head: true })
    .eq("created_by", profile?.id ?? "")
    .eq("creation_state", "finalized")
    .in("status", ["all_signed", "needs_correction"]);

  return (
    <DashboardShell
      sidebar={
        <ProductionSidebarNav
          role="realtor"
          notificationCount={count ?? 0}
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
