import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";
import { requireApproved } from "./guards";

export async function hasRequiredAdminMfa(): Promise<boolean> {
  if (!serverEnv.ADMIN_MFA_REQUIRED) return true;

  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data.currentLevel === "aal2";
}

export const requireAdminMfa = cache(async () => {
  const profile = await requireApproved("admin");
  if (!(await hasRequiredAdminMfa())) {
    redirect("/auth/mfa");
  }
  return profile;
});
