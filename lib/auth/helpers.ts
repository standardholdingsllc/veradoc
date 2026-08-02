import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Cached profile fetcher for server components.
 * React cache() deduplicates within a single server request,
 * so calling this in both the layout and a page does not double-query.
 */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
});
