import { type NextRequest, NextResponse } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";
import {
  AUTH_ROUTES,
  getDashboardForRole,
  ROUTE_ROLE_MAP,
} from "@/lib/auth/constants";
import type { AppMetadata, ProfileRole } from "@/lib/auth/types";
import { buildAbsoluteUrl } from "@/lib/routing/origins";
import { decideRoute, type RouteDecision } from "@/lib/routing/policy";
import { classifyHost } from "@/lib/routing/surfaces";
import { getPublicTargetForRole } from "@/lib/routing/targets";
import type { CanonicalSurface, Surface } from "@/lib/routing/types";

function isProtectedRoute(pathname: string): boolean {
  return ROUTE_ROLE_MAP.some((entry) =>
    pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
}

function getRequiredRole(pathname: string): ProfileRole | undefined {
  return ROUTE_ROLE_MAP.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )?.role;
}

function copyCookies(source: NextResponse, destination: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie.name, cookie.value, cookie);
  });
  return destination;
}

function applySurfaceHeaders(response: NextResponse, surface: Surface): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (surface !== "marketing") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
  } else {
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  if (surface === "admin" || surface === "notary") {
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }

  if (process.env.VERCEL_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return response;
}

function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
  surface: Surface,
): NextResponse {
  return applySurfaceHeaders(
    copyCookies(supabaseResponse, NextResponse.redirect(url, 307)),
    surface,
  );
}

function canonicalUrl(
  request: NextRequest,
  target: { surface: CanonicalSurface; path: `/${string}` },
  preserveQuery = false,
): URL {
  const url = new URL(buildAbsoluteUrl(target));
  if (preserveQuery) url.search = request.nextUrl.search;
  return url;
}

function sameRequestOriginUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return url;
}

function roleDestination(
  request: NextRequest,
  surface: Surface,
  role: ProfileRole,
): URL {
  if (surface === "local" || surface === "preview") {
    return sameRequestOriginUrl(request, getDashboardForRole(role));
  }
  return canonicalUrl(request, getPublicTargetForRole(role));
}

function loginDestination(
  request: NextRequest,
  surface: Surface,
  targetSurface?: CanonicalSurface,
): URL {
  if (surface === "local" || surface === "preview" || !targetSurface) {
    return sameRequestOriginUrl(request, AUTH_ROUTES.login);
  }
  return new URL(buildAbsoluteUrl({ surface: targetSurface, path: AUTH_ROUTES.login }));
}

function createRoutingResponse(request: NextRequest, decision: RouteDecision): NextResponse {
  if (decision.kind === "rewrite") {
    const destination = request.nextUrl.clone();
    destination.pathname = decision.internalPath;
    return NextResponse.rewrite(destination);
  }
  return NextResponse.next({ request });
}

function sanitizePathFamily(pathname: string): string {
  if (pathname.startsWith("/firma/")) return "/firma/[token]";
  if (pathname.startsWith("/paquetes/")) return "/paquetes/[packetId]";
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}` : "/";
}

function emitShadowDecision(
  request: NextRequest,
  surface: Surface,
  decision: RouteDecision,
): void {
  console.info("[host-routing-shadow]", {
    surface,
    pathFamily: sanitizePathFamily(request.nextUrl.pathname),
    decision: decision.kind,
    reason: decision.reason,
    method: request.method,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  });
}

function getHostRoutingMode(): "off" | "shadow" | "enforce" {
  const mode = process.env.HOST_ROUTING_MODE;
  return mode === "shadow" || mode === "enforce" ? mode : "off";
}

export default async function proxy(request: NextRequest) {
  const hostRoutingMode = getHostRoutingMode();
  const classification = classifyHost(request.nextUrl.host, {
    vercelEnvironment: process.env.VERCEL_ENV,
    vercelHostname: [
      process.env.VERCEL_URL ?? "",
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    ],
  });
  if (
    request.nextUrl.pathname === "/auth/invite" ||
    request.nextUrl.pathname.startsWith("/auth/invite/")
  ) {
    return applySurfaceHeaders(
      new NextResponse(null, { status: 404 }),
      classification.surface,
    );
  }
  const computedDecision = decideRoute({
    surface: classification.surface,
    pathname: request.nextUrl.pathname,
    method: request.method,
    isWww: classification.isWww,
    isProductionDeploymentHost: classification.isProductionDeploymentHost,
  });

  if (hostRoutingMode === "shadow") {
    emitShadowDecision(request, classification.surface, computedDecision);
  }

  const decision: RouteDecision =
    hostRoutingMode === "enforce"
      ? computedDecision
      : {
          kind: "allow",
          reason: "HOST_PATH_ALLOWED",
          internalPath: request.nextUrl.pathname as `/${string}`,
        };

  if (decision.kind === "reject") {
    return applySurfaceHeaders(
      new NextResponse(null, { status: decision.status }),
      classification.surface,
    );
  }

  if (decision.kind === "redirect") {
    return applySurfaceHeaders(
      NextResponse.redirect(canonicalUrl(request, decision.target, true), 307),
      classification.surface,
    );
  }

  const internalPath = decision.internalPath;
  const response = createRoutingResponse(request, decision);
  const authRelevant =
    internalPath.startsWith("/auth") || isProtectedRoute(internalPath);

  if (!authRelevant) {
    return applySurfaceHeaders(response, classification.surface);
  }

  const supabase = createProxyClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.app_metadata ?? {}) as AppMetadata;
  const role = meta.role;
  const status = meta.status;
  const isActive = Boolean(role && status === "active");

  if (internalPath.startsWith("/auth")) {
    if (internalPath === AUTH_ROUTES.callback) {
      return applySurfaceHeaders(response, classification.surface);
    }

    if (
      internalPath === AUTH_ROUTES.pendingApproval ||
      internalPath === AUTH_ROUTES.rejected
    ) {
      if (!user) {
        return redirectWithCookies(
          loginDestination(request, classification.surface, "app"),
          response,
          classification.surface,
        );
      }
      if (isActive && role) {
        return redirectWithCookies(
          roleDestination(request, classification.surface, role),
          response,
          classification.surface,
        );
      }
      return applySurfaceHeaders(response, classification.surface);
    }

    if (internalPath === AUTH_ROUTES.login || internalPath === AUTH_ROUTES.signup) {
      if (isActive && role) {
        const target = getPublicTargetForRole(role);
        if (
          classification.surface !== "local" &&
          classification.surface !== "preview" &&
          classification.surface !== target.surface
        ) {
          await supabase.auth.signOut();
          const destination = loginDestination(
            request,
            classification.surface,
            target.surface,
          );
          destination.searchParams.set("error", "wrong-surface");
          return redirectWithCookies(
            destination,
            response,
            classification.surface,
          );
        }
        return redirectWithCookies(
          roleDestination(request, classification.surface, role),
          response,
          classification.surface,
        );
      }
      return applySurfaceHeaders(response, classification.surface);
    }

    return applySurfaceHeaders(response, classification.surface);
  }

  if (isProtectedRoute(internalPath)) {
    if (!user) {
      const targetSurface =
        classification.surface === "admin" ||
        classification.surface === "notary" ||
        classification.surface === "app"
          ? classification.surface
          : undefined;
      const destination = loginDestination(
        request,
        classification.surface,
        targetSurface,
      );
      destination.searchParams.set("next", request.nextUrl.pathname);
      return redirectWithCookies(
        destination,
        response,
        classification.surface,
      );
    }

    if (role === "realtor" && status === "pending_approval") {
      return redirectWithCookies(
        new URL(buildAbsoluteUrl({ surface: "app", path: AUTH_ROUTES.pendingApproval })),
        response,
        classification.surface,
      );
    }

    if (role === "realtor" && status === "rejected") {
      return redirectWithCookies(
        new URL(buildAbsoluteUrl({ surface: "app", path: AUTH_ROUTES.rejected })),
        response,
        classification.surface,
      );
    }

    const requiredRole = getRequiredRole(internalPath);
    if (requiredRole && role !== requiredRole) {
      if (isActive && role) {
        const target = getPublicTargetForRole(role);
        if (
          classification.surface !== "local" &&
          classification.surface !== "preview" &&
          classification.surface !== target.surface
        ) {
          await supabase.auth.signOut();
          const destination = loginDestination(
            request,
            classification.surface,
            target.surface,
          );
          destination.searchParams.set("error", "wrong-surface");
          return redirectWithCookies(
            destination,
            response,
            classification.surface,
          );
        }
        return redirectWithCookies(
          roleDestination(request, classification.surface, role),
          response,
          classification.surface,
        );
      }
      return redirectWithCookies(
        loginDestination(request, classification.surface),
        response,
        classification.surface,
      );
    }
  }

  return applySurfaceHeaders(response, classification.surface);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
