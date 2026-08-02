import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTES, getDashboardForRole } from "@/lib/auth/constants";
import type { AppMetadata } from "@/lib/auth/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const invitationToken = searchParams.get("invitation");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this callback carries a VeraDoc invitation token (notary invite flow),
      // redirect to the invite acceptance page instead of the default destination.
      if (invitationToken) {
        return NextResponse.redirect(
          `${origin}${AUTH_ROUTES.invitePrefix}/${invitationToken}`,
        );
      }

      // For non-invite flows, check if the user has a role to route them correctly.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const meta = (user.app_metadata ?? {}) as AppMetadata;

        if (meta.role && meta.status === "active") {
          return NextResponse.redirect(
            `${origin}${getDashboardForRole(meta.role)}`,
          );
        }

        if (meta.status === "pending_approval") {
          return NextResponse.redirect(
            `${origin}${AUTH_ROUTES.pendingApproval}`,
          );
        }

        if (meta.status === "rejected") {
          return NextResponse.redirect(`${origin}${AUTH_ROUTES.rejected}`);
        }

        // New OAuth user with no role yet -- if Google, send to profile completion
        if (!meta.role) {
          const isGoogle = user.app_metadata?.provider === "google"
            || user.app_metadata?.providers?.includes("google")
            || user.identities?.some((id: { provider: string }) => id.provider === "google");

          if (isGoogle) {
            return NextResponse.redirect(
              `${origin}${AUTH_ROUTES.signup}?provider=google`,
            );
          }
          // Non-Google no-role users (e.g. email-confirmed signers mid-flow)
          // fall through to the default redirect below
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${AUTH_ROUTES.login}?error=auth`);
}
