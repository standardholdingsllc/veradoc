import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfa } from "@/lib/auth/mfa";
import { isCommercialAccountingEnabled } from "@/lib/env/server";

export async function getPendingRealtors() {
  await requireAdminMfa();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, dni, province, department, company_name, ruc, license_number, phone, created_at",
    )
    .eq("role", "realtor")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getCoverage() {
  await requireAdminMfa();
  const admin = createAdminClient();
  const { data } = await admin
    .from("notary_coverage")
    .select(
      "id, province, department, active, created_at, notary_id, profiles!notary_id(full_name, email)",
    )
    .order("province");
  return data ?? [];
}

export async function getActiveNotaries() {
  await requireAdminMfa();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "notary")
    .eq("status", "active")
    .order("full_name");
  return data ?? [];
}

export async function getNotaryPayoutAdminData() {
  await requireAdminMfa();
  if (!isCommercialAccountingEnabled()) {
    return { rates: [], payouts: [] };
  }
  const admin = createAdminClient();
  const [rates, payouts] = await Promise.all([
    admin
      .from("notary_payout_rates")
      .select(
        "id, notary_id, participation_bps, formula_version, protect_standard_price_for_promos, currency, effective_from, effective_to, contract_reference, created_at",
      )
      .order("effective_from", { ascending: false }),
    admin
      .from("notary_monthly_payouts")
      .select(
        "id, notary_id, period_month, certification_count, gross_amount, currency, status, prepared_at, confirmed_at, paid_at, payment_reference, notary_comprobante_reference, contractual_amount_centimos, promo_top_up_centimos, notary_igv_centimos, notes",
      )
      .order("period_month", { ascending: false })
      .limit(240),
  ]);

  if (rates.error) throw new Error(`No se pudieron cargar las tarifas: ${rates.error.message}`);
  if (payouts.error) throw new Error(`No se pudieron cargar los pagos: ${payouts.error.message}`);

  return { rates: rates.data ?? [], payouts: payouts.data ?? [] };
}

export interface PacketFinancialSummaryRow {
  packet_id: string;
  payment_id: string;
  policy_version: string;
  standard_gross_centimos: number;
  promo_discount_centimos: number;
  gross_collected_centimos: number;
  included_igv_centimos: number;
  adjusted_net_revenue_centimos: number;
  direct_cost_centimos: number;
  notary_igv_centimos: number;
  recorded_cost_categories: string[];
  missing_cost_categories: string[];
  platform_contribution_margin_centimos: number;
  processing_fee_centimos: number | null;
  processing_fee_missing: boolean;
  recognized_at: string | null;
  service_window_ends_at: string | null;
  archived_at: string | null;
}

export async function getCommercialFinanceData(): Promise<PacketFinancialSummaryRow[]> {
  await requireAdminMfa();
  if (!isCommercialAccountingEnabled()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("packet_financial_summary")
    .select("*")
    .order("recognized_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(`No se pudo cargar el margen por paquete: ${error.message}`);
  return (data ?? []) as unknown as PacketFinancialSummaryRow[];
}

export async function getMetrics() {
  await requireAdminMfa();
  const admin = createAdminClient();

  const [realtors, notaries, signers] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "realtor")
      .eq("status", "active"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "notary")
      .eq("status", "active"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["landlord", "renter"])
      .eq("status", "active"),
  ]);

  const { data: packetRows } = await admin
    .from("lease_packets")
    .select("status");
  const packetsByStatus: Record<string, number> = {};
  for (const row of packetRows ?? []) {
    packetsByStatus[row.status] = (packetsByStatus[row.status] ?? 0) + 1;
  }

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: recentCerts } = await admin
    .from("notary_certifications")
    .select("id", { count: "exact", head: true })
    .gte("certified_at", thirtyDaysAgo);

  const { data: paymentRows } = await admin
    .from("payments")
    .select("status, amount");
  const paymentTotals: Record<string, number> = {
    pending: 0,
    completed: 0,
    refunded: 0,
  };
  for (const row of paymentRows ?? []) {
    paymentTotals[row.status] =
      (paymentTotals[row.status] ?? 0) + Number(row.amount);
  }

  return {
    activeRealtors: realtors.count ?? 0,
    activeNotaries: notaries.count ?? 0,
    activeSigners: signers.count ?? 0,
    packetsByStatus,
    totalPackets: (packetRows ?? []).length,
    recentCertifications: recentCerts ?? 0,
    paymentTotals,
  };
}

export async function getUsers(page = 1, pageSize = 50) {
  await requireAdminMfa();
  const admin = createAdminClient();
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(10, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const { data, count } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, role, status, province, phone, dni, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  return {
    rows: data ?? [],
    page: safePage,
    pageSize: safePageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / safePageSize)),
  };
}
