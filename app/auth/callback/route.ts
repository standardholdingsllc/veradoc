import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTES, getDashboardForRole } from "@/lib/auth/constants";
import type { AppMetadata } from "@/lib/auth/types";
import { buildAbsoluteUrl } from "@/lib/routing/origins";
import { classifyHost } from "@/lib/routing/surfaces";
import { getPublicTargetForRole } from "@/lib/routing/targets";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const surface = classifyHost(requestUrl.host, {
    vercelEnvironment: process.env.VERCEL_ENV,
    vercelHostname: [
      process.env.VERCEL_URL ?? "",
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    ],
  }).surface;

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
          const target = getPublicTargetForRole(meta.role);
          if (surface === "local" || surface === "preview") {
            return NextResponse.redirect(
              `${origin}${getDashboardForRole(meta.role)}`,
            );
          }
          if (surface !== target.surface) {
            await supabase.auth.signOut();
            return NextResponse.redirect(
              buildAbsoluteUrl(
                { surface: target.surface, path: AUTH_ROUTES.login },
                { error: "wrong-surface" },
              ),
            );
          }
          return NextResponse.redirect(
            buildAbsoluteUrl(target),
          );
        }

        if (meta.status === "pending_approval") {
          if (surface !== "app" && surface !== "local" && surface !== "preview") {
            await supabase.auth.signOut();
            return NextResponse.redirect(
              buildAbsoluteUrl(
                { surface: "app", path: AUTH_ROUTES.login },
                { error: "wrong-surface" },
              ),
            );
          }
          return NextResponse.redirect(
            surface === "app"
              ? buildAbsoluteUrl({ surface: "app", path: AUTH_ROUTES.pendingApproval })
              : `${origin}${AUTH_ROUTES.pendingApproval}`,
          );
        }

        if (meta.status === "rejected") {
          if (surface !== "app" && surface !== "local" && surface !== "preview") {
            await supabase.auth.signOut();
            return NextResponse.redirect(
              buildAbsoluteUrl(
                { surface: "app", path: AUTH_ROUTES.login },
                { error: "wrong-surface" },
              ),
            );
          }
          return NextResponse.redirect(
            surface === "app"
              ? buildAbsoluteUrl({ surface: "app", path: AUTH_ROUTES.rejected })
              : `${origin}${AUTH_ROUTES.rejected}`,
          );
        }

        // New OAuth user with no role yet -- if Google, send to profile completion
        if (!meta.role) {
          const isGoogle = user.app_metadata?.provider === "google"
            || user.app_metadata?.providers?.includes("google")
            || user.identities?.some((id: { provider: string }) => id.provider === "google");

          if (isGoogle) {
            if (surface !== "app" && surface !== "local" && surface !== "preview") {
              await supabase.auth.signOut();
              return NextResponse.redirect(
                buildAbsoluteUrl(
                  { surface: "app", path: AUTH_ROUTES.login },
                  { error: "wrong-surface" },
                ),
              );
            }
            return NextResponse.redirect(
              surface === "app"
                ? buildAbsoluteUrl(
                    { surface: "app", path: AUTH_ROUTES.signup },
                    { provider: "google" },
                  )
                : `${origin}${AUTH_ROUTES.signup}?provider=google`,
            );
          }
          // Non-Google no-role users (e.g. email-confirmed signers mid-flow)
          // fall through to the default redirect below
        }
      }

      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}${AUTH_ROUTES.login}?error=auth`);
}
