import { type NextRequest, NextResponse } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import {
  AUTH_ROUTES,
  getDashboardForRole,
  ROUTE_ROLE_MAP,
} from "@/lib/auth/constants";
import type { AppMetadata } from "@/lib/auth/types";

function isProtectedRoute(pathname: string): boolean {
  return ROUTE_ROLE_MAP.some((entry) => pathname.startsWith(entry.prefix));
}

function getRequiredRole(pathname: string): string | undefined {
  return ROUTE_ROLE_MAP.find((entry) => pathname.startsWith(entry.prefix))?.role;
}

/**
 * Creates a redirect response that preserves any Set-Cookie headers written
 * by the Supabase client during session refresh. Without this, a redirect
 * after getUser() would drop the refreshed auth token cookies.
 */
function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({ request });
  const supabase = createProxyClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.app_metadata ?? {}) as AppMetadata;
  const role = meta.role;
  const status = meta.status;
  const isActive = role && status === "active";

  // --- Auth routes: differentiated handling ---

  if (pathname.startsWith("/auth")) {
    if (pathname.startsWith(AUTH_ROUTES.callback)) {
      return response;
    }

    if (pathname.startsWith(AUTH_ROUTES.invitePrefix)) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = AUTH_ROUTES.login;
        return redirectWithCookies(url, response);
      }
      if (isActive) {
        const url = request.nextUrl.clone();
        url.pathname = getDashboardForRole(role);
        return redirectWithCookies(url, response);
      }
      return response;
    }

    if (pathname.startsWith(AUTH_ROUTES.pendingApproval)) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = AUTH_ROUTES.login;
        return redirectWithCookies(url, response);
      }
      if (isActive) {
        const url = request.nextUrl.clone();
        url.pathname = getDashboardForRole(role);
        return redirectWithCookies(url, response);
      }
      return response;
    }

    if (pathname.startsWith(AUTH_ROUTES.rejected)) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = AUTH_ROUTES.login;
        return redirectWithCookies(url, response);
      }
      if (isActive) {
        const url = request.nextUrl.clone();
        url.pathname = getDashboardForRole(role);
        return redirectWithCookies(url, response);
      }
      return response;
    }

    if (
      pathname.startsWith(AUTH_ROUTES.login) ||
      pathname.startsWith(AUTH_ROUTES.signup)
    ) {
      if (isActive) {
        const url = request.nextUrl.clone();
        url.pathname = getDashboardForRole(role);
        return redirectWithCookies(url, response);
      }
      return response;
    }

    return response;
  }

  // --- Protected dashboard routes ---

  if (isProtectedRoute(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_ROUTES.login;
      url.searchParams.set("next", pathname);
      return redirectWithCookies(url, response);
    }

    if (role === "realtor" && status === "pending_approval") {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_ROUTES.pendingApproval;
      return redirectWithCookies(url, response);
    }

    if (role === "realtor" && status === "rejected") {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_ROUTES.rejected;
      return redirectWithCookies(url, response);
    }

    const requiredRole = getRequiredRole(pathname);
    if (requiredRole && role !== requiredRole) {
      if (isActive) {
        const url = request.nextUrl.clone();
        url.pathname = getDashboardForRole(role);
        return redirectWithCookies(url, response);
      }
      const url = request.nextUrl.clone();
      url.pathname = AUTH_ROUTES.login;
      return redirectWithCookies(url, response);
    }

    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/agente/:path*",
    "/notario/:path*",
    "/arrendador/:path*",
    "/arrendatario/:path*",
    "/admin/:path*",
    "/auth/:path*",
  ],
};
