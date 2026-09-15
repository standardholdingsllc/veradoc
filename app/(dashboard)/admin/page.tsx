import { requireAdminMfa } from "@/lib/auth/mfa";
import {
  getPendingRealtors,
  getInvitations,
  getCoverage,
  getActiveNotaries,
  getMetrics,
  getUsers,
  getNotaryPayoutAdminData,
  getCommercialFinanceData,
} from "@/lib/admin/queries";
import { AdminTabs } from "@/components/admin/admin-tabs";

interface AdminDashboardPageProps {
  searchParams?: Promise<{
    adminTab?: string;
    usersPage?: string;
  }>;
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const profile = await requireAdminMfa();
  const params = (await searchParams) ?? {};
  const usersPage = Number(params.usersPage ?? "1");

  const [pendingRealtors, rawInvitations, coverage, notaries, metrics, users, payoutData, financeData] =
    await Promise.all([
      getPendingRealtors(),
      getInvitations(),
      getCoverage(),
      getActiveNotaries(),
      getMetrics(),
      getUsers(Number.isFinite(usersPage) ? usersPage : 1),
      getNotaryPayoutAdminData(),
      getCommercialFinanceData(),
    ]);

  const invitations = rawInvitations.map(
    (inv) => {
      const safe = { ...inv } as Record<string, unknown> & {
        id: string;
        email: string;
        role: string;
        status: string;
        expires_at: string;
        accepted_at: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
        invited_by: string;
        token?: unknown;
      };
      delete safe.token;
      return safe;
    },
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Panel de administración</h1>
      <p className="mt-1 text-sm text-muted">Bienvenido, {profile.email}</p>

      <div className="mt-6">
        <AdminTabs
          pendingRealtors={pendingRealtors}
          invitations={invitations}
          coverage={coverage}
          notaries={notaries}
          metrics={metrics}
          users={users.rows}
          usersPageInfo={{
            page: users.page,
            pageSize: users.pageSize,
            total: users.total,
            pageCount: users.pageCount,
          }}
          payoutRates={payoutData.rates}
          payouts={payoutData.payouts}
          financeRows={financeData}
          initialTab={params.adminTab}
        />
      </div>
    </div>
  );
}
