import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTES, getDashboardForRole } from "@/lib/auth/constants";
import type { AppMetadata, AuthProfile, ProfileRole } from "@/lib/auth/types";

/**
 * Requires an authenticated user. Redirects to login if no session.
 * Returns the Supabase user object.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(AUTH_ROUTES.login);
  }

  return user;
}

/**
 * Requires an authenticated user with a specific role.
 * Redirects to login if unauthenticated, or to the user's correct
 * dashboard if they have the wrong role.
 */
export async function requireRole(...roles: ProfileRole[]): Promise<AuthProfile> {
  const user = await requireAuth();
  const meta = (user.app_metadata ?? {}) as AppMetadata;

  if (!meta.role || !roles.includes(meta.role)) {
    if (meta.role && meta.status === "active") {
      redirect(getDashboardForRole(meta.role));
    }
    redirect(AUTH_ROUTES.login);
  }

  return {
    id: user.id,
    role: meta.role,
    status: meta.status ?? "pending_approval",
    fullName: "",
    email: user.email ?? "",
  };
}

/**
 * Requires an authenticated user with a specific role AND active status.
 * Redirects appropriately for pending/rejected users.
 */
export async function requireApproved(
  ...roles: ProfileRole[]
): Promise<AuthProfile> {
  const profile = await requireRole(...roles);

  if (profile.status === "pending_approval") {
    redirect(AUTH_ROUTES.pendingApproval);
  }

  if (profile.status === "rejected") {
    redirect(AUTH_ROUTES.rejected);
  }

  if (profile.status !== "active") {
    redirect(AUTH_ROUTES.login);
  }

  return profile;
}
