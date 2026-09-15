import { redirect } from "next/navigation";
import { AdminMfaClient } from "@/components/auth/admin-mfa-client";
import { requireApproved } from "@/lib/auth/guards";
import { hasRequiredAdminMfa } from "@/lib/auth/mfa";
import { serverEnv } from "@/lib/env/server";

export default async function AdminMfaPage() {
  await requireApproved("admin");
  if (!serverEnv.ADMIN_MFA_REQUIRED || (await hasRequiredAdminMfa())) {
    redirect("/");
  }
  return <AdminMfaClient />;
}
