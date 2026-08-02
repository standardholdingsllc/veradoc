import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PricingInfo {
  amountCentimos: number;
  currency: string;
  description: string;
}

export async function getPacketPricing(): Promise<PricingInfo> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pricing_config")
    .select("amount_centimos, currency, description")
    .eq("product_code", "lease_packet_standard")
    .eq("active", true)
    .single();

  if (error || !data) {
    throw new Error("No active pricing configuration found. Payment cannot proceed.");
  }

  return {
    amountCentimos: data.amount_centimos,
    currency: data.currency,
    description: data.description,
  };
}
