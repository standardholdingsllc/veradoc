import { requireApproved } from "@/lib/auth/guards";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProductionSidebarNav } from "@/components/layout/production-sidebar-nav";

export default async function NotarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApproved("notary");
  const profile = await getCurrentProfile();

  const supabase = await createClient();
  const { count } = await supabase
    .from("notary_assignments")
    .select("id", { count: "exact", head: true })
    .eq("notary_id", profile?.id ?? "")
    .is("decision", null)
    .is("review_started_at", null);

  return (
    <DashboardShell
      mainClassName="overflow-visible"
      sidebar={
        <ProductionSidebarNav
          role="notary"
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
