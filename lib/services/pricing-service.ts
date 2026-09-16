import "server-only";
import { isCommercialAccountingEnabled } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PricingInfo {
  amountCentimos: number;
  currency: string;
  description: string;
  policyVersion: string;
  taxIncluded: boolean;
  taxRateBps: number;
  serviceWindowDays: number;
  includedServices: string[];
  excludedServices: string[];
}

export async function getPacketPricing(): Promise<PricingInfo> {
  const admin = createAdminClient();
  const result = isCommercialAccountingEnabled()
    ? await getVersionedPricing(admin)
    : await getLegacyPricing(admin);
  const { data, error } = result;

  if (error || !data) {
    throw new Error("No active pricing configuration found. Payment cannot proceed.");
  }

  const row = data as {
    amount_centimos: number;
    currency: string;
    description: string;
    policy_version?: string;
    tax_included?: boolean;
    tax_rate_bps?: number;
    service_window_days?: number;
    included_services?: unknown;
    excluded_services?: unknown;
  };

  return {
    amountCentimos: row.amount_centimos,
    currency: row.currency,
    description: row.description,
    policyVersion: row.policy_version ?? "legacy_v1",
    taxIncluded: row.tax_included ?? true,
    taxRateBps: row.tax_rate_bps ?? 1_800,
    serviceWindowDays: row.service_window_days ?? 90,
    includedServices: toStringArray(row.included_services),
    excludedServices: toStringArray(row.excluded_services),
  };
}

type PricingAdminClient = ReturnType<typeof createAdminClient>;

function getLegacyPricing(admin: PricingAdminClient) {
  return admin
    .from("pricing_config")
    .select("amount_centimos, currency, description")
    .eq("product_code", "lease_packet_standard")
    .eq("active", true)
    .single();
}

function getVersionedPricing(admin: PricingAdminClient) {
  const now = new Date().toISOString();
  return admin
    .from("pricing_config")
    .select("*")
    .eq("product_code", "lease_packet_standard")
    .eq("active", true)
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gt.${now}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .single();
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
