"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabaseRegistryAdapter } from "@/lib/adapters/supabase-adapter";

export async function checkDuplicateAction(
  address: string,
  unit: string | null,
  startDate: string,
  endDate: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const adapter = new SupabaseRegistryAdapter();
  return adapter.checkDuplicate(address, unit, startDate, endDate);
}

export async function getRegistryEntriesAction() {
  const adapter = new SupabaseRegistryAdapter();
  return adapter.getAll();
}
