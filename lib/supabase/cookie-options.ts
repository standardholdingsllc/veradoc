import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Shared auth-cookie policy for every Supabase SSR client.
 *
 * Deliberately omit `domain` so sessions remain host-scoped across the
 * marketing, app, notary, admin, and demo surfaces.
 */
export function createSupabaseCookieOptions(
  isProduction = process.env.NODE_ENV === "production",
): CookieOptionsWithName {
  return {
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  };
}

export const SUPABASE_COOKIE_OPTIONS = createSupabaseCookieOptions();
