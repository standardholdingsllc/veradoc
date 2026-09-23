import { requireAdminMfa } from "@/lib/auth/mfa";
import {
  getPendingRealtors,
  getCoverage,
  getActiveNotaries,
  getMetrics,
  getUsers,
  getNotaryPayoutAdminData,
  getCommercialFinanceData,
} from "@/lib/admin/queries";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { isCommercialAccountingEnabled } from "@/lib/env/server";
import { logoutAndRedirect } from "@/lib/auth/logout-actions";
import { readAdminDemoControl } from "@/lib/demo/admin-control";

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
  const commercialAccountingEnabled = isCommercialAccountingEnabled();

  const coreDataPromise = Promise.all([
    getPendingRealtors(),
    getCoverage(),
    getActiveNotaries(),
    getMetrics(),
    getUsers(Number.isFinite(usersPage) ? usersPage : 1),
  ]);
  const commercialDataPromise = commercialAccountingEnabled
    ? Promise.all([getNotaryPayoutAdminData(), getCommercialFinanceData()])
    : Promise.resolve(null);
  const demoControlPromise = readAdminDemoControl()
    .then((state) => ({ ...state, available: true }))
    .catch(() => ({ enabled: false, available: false, updatedAt: undefined }));

  const [coreData, commercialData, demoControl] = await Promise.all([
    coreDataPromise,
    commercialDataPromise,
    demoControlPromise,
  ]);
  const [pendingRealtors, coverage, notaries, metrics, users] =
    coreData;
  const payoutData = commercialData?.[0] ?? { rates: [], payouts: [] };
  const financeData = commercialData?.[1] ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <p className="mt-1 text-sm text-muted">Bienvenido, {profile.email}</p>
        </div>
        <form action={logoutAndRedirect}>
          <AdminLogoutButton />
        </form>
      </div>

      <div className="mt-6">
        <AdminTabs
          pendingRealtors={pendingRealtors}
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
          commercialAccountingEnabled={commercialAccountingEnabled}
          initialTab={params.adminTab}
          demoControl={demoControl}
        />
      </div>
    </div>
  );
}
