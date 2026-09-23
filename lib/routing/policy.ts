import { getLegacyCanonicalTarget } from "./legacy";
import { publicToInternalPath, stripInternalPrefix } from "./rewrites";
import type { PublicPath, PublicTarget, Surface } from "./types";

export type RouteReason =
  | "HOST_UNKNOWN"
  | "HOST_PATH_ALLOWED"
  | "HOST_PATH_REWRITE"
  | "HOST_PATH_LEGACY_REDIRECT"
  | "HOST_PATH_WRONG_SURFACE"
  | "HOST_METHOD_REJECTED";

export type RouteDecision =
  | { kind: "allow"; reason: RouteReason; internalPath: PublicPath }
  | { kind: "rewrite"; reason: RouteReason; internalPath: PublicPath }
  | { kind: "redirect"; reason: RouteReason; target: PublicTarget }
  | { kind: "reject"; reason: RouteReason; status: 404 | 421 };

export interface RouteDecisionInput {
  surface: Surface;
  pathname: string;
  method: string;
  isWww?: boolean;
  isProductionDeploymentHost?: boolean;
}

const APP_PREFIXES = ["/agente", "/arrendador", "/arrendatario", "/firma"];
const DEMO_PREFIXES = [
  "/registro",
  "/agente",
  "/arrendador",
  "/arrendatario",
  "/notario",
  "/firma",
];
const NOTARY_PREFIXES = ["/perfil", "/paquetes", "/historial", "/ganancias"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesAnyPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

function isSafeRedirectMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function redirectOrReject(target: PublicTarget, method: string): RouteDecision {
  if (!isSafeRedirectMethod(method)) {
    return { kind: "reject", reason: "HOST_METHOD_REJECTED", status: 404 };
  }
  return { kind: "redirect", reason: "HOST_PATH_LEGACY_REDIRECT", target };
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isAllowedAppAuthPath(pathname: string): boolean {
  return (
    pathname === "/auth/login" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/pending-approval" ||
    pathname === "/auth/rejected"
  );
}

function isAllowedNotaryAuthPath(pathname: string): boolean {
  return (
    pathname === "/auth/login" ||
    pathname === "/auth/callback"
  );
}

function isAllowedAdminAuthPath(pathname: string): boolean {
  return pathname === "/auth/login" || pathname === "/auth/mfa";
}

export function decideRoute(input: RouteDecisionInput): RouteDecision {
  const method = input.method.toUpperCase();
  const pathname = input.pathname.startsWith("/")
    ? input.pathname
    : `/${input.pathname}`;

  if (input.surface === "unknown") {
    return { kind: "reject", reason: "HOST_UNKNOWN", status: 404 };
  }

  if (matchesPrefix(pathname, "/auth/invite")) {
    return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
  }

  if (input.isWww) {
    return redirectOrReject(
      { surface: "marketing", path: pathname as PublicPath },
      method,
    );
  }

  if (isApiPath(pathname)) {
    if (matchesPrefix(pathname, "/api/demo")) {
      if (
        input.surface === "demo" ||
        input.surface === "local" ||
        (input.surface === "preview" && !input.isProductionDeploymentHost)
      ) {
        return {
          kind: "allow",
          reason: "HOST_PATH_ALLOWED",
          internalPath: pathname as PublicPath,
        };
      }
      return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
    }
    if (
      input.surface === "marketing" ||
      input.surface === "local" ||
      (input.surface === "preview" && !input.isProductionDeploymentHost) ||
      input.isProductionDeploymentHost
    ) {
      return {
        kind: "allow",
        reason: "HOST_PATH_ALLOWED",
        internalPath: pathname as PublicPath,
      };
    }
    return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
  }

  if (input.surface === "local" || input.surface === "preview") {
    if (input.isProductionDeploymentHost) {
      return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
    }
    return {
      kind: "allow",
      reason: "HOST_PATH_ALLOWED",
      internalPath: pathname as PublicPath,
    };
  }

  if (input.surface === "marketing") {
    // Narrow legacy callback compatibility remains on the apex during the
    // migration window. Ordinary auth forms canonicalize to the app surface.
    if (pathname === "/auth/callback") {
      return {
        kind: "allow",
        reason: "HOST_PATH_ALLOWED",
        internalPath: pathname as PublicPath,
      };
    }
    const legacyTarget = getLegacyCanonicalTarget(pathname);
    if (legacyTarget) return redirectOrReject(legacyTarget, method);
    if (pathname.startsWith("/auth/")) {
      return redirectOrReject(
        { surface: "app", path: pathname as PublicPath },
        method,
      );
    }
    return {
      kind: "allow",
      reason: "HOST_PATH_ALLOWED",
      internalPath: pathname as PublicPath,
    };
  }

  if (input.surface === "app") {
    if (pathname === "/") {
      return redirectOrReject({ surface: "app", path: "/auth/login" }, method);
    }
    if (
      matchesAnyPrefix(pathname, APP_PREFIXES) ||
      isAllowedAppAuthPath(pathname)
    ) {
      return {
        kind: "allow",
        reason: "HOST_PATH_ALLOWED",
        internalPath: pathname as PublicPath,
      };
    }
    const legacyTarget = getLegacyCanonicalTarget(pathname);
    if (legacyTarget) return redirectOrReject(legacyTarget, method);
    return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
  }

  if (input.surface === "notary") {
    const cleaned = stripInternalPrefix("notary", pathname);
    if (cleaned)
      return redirectOrReject({ surface: "notary", path: cleaned }, method);
    if (pathname === "/" || matchesAnyPrefix(pathname, NOTARY_PREFIXES)) {
      return {
        kind: "rewrite",
        reason: "HOST_PATH_REWRITE",
        internalPath: publicToInternalPath("notary", pathname),
      };
    }
    if (isAllowedNotaryAuthPath(pathname)) {
      return {
        kind: "allow",
        reason: "HOST_PATH_ALLOWED",
        internalPath: pathname as PublicPath,
      };
    }
    const legacyTarget = getLegacyCanonicalTarget(pathname);
    if (legacyTarget) return redirectOrReject(legacyTarget, method);
    return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
  }

  if (input.surface === "admin") {
    const cleaned = stripInternalPrefix("admin", pathname);
    if (cleaned)
      return redirectOrReject({ surface: "admin", path: cleaned }, method);
    if (isAllowedAdminAuthPath(pathname)) {
      return {
        kind: "allow",
        reason: "HOST_PATH_ALLOWED",
        internalPath: pathname as PublicPath,
      };
    }
    const legacyTarget = getLegacyCanonicalTarget(pathname);
    if (legacyTarget && legacyTarget.surface !== "admin") {
      return redirectOrReject(legacyTarget, method);
    }
    if (matchesPrefix(pathname, "/auth")) {
      return {
        kind: "reject",
        reason: "HOST_PATH_WRONG_SURFACE",
        status: 404,
      };
    }
    return {
      kind: "rewrite",
      reason: "HOST_PATH_REWRITE",
      internalPath: publicToInternalPath("admin", pathname),
    };
  }

  // Demo page mutations remain disabled. Shared-state mutations are accepted
  // only through the explicitly classified /api/demo boundary above.
  if (!isSafeRedirectMethod(method)) {
    return { kind: "reject", reason: "HOST_METHOD_REJECTED", status: 404 };
  }
  const cleaned = stripInternalPrefix("demo", pathname);
  if (cleaned)
    return redirectOrReject({ surface: "demo", path: cleaned }, method);
  if (pathname === "/" || matchesAnyPrefix(pathname, DEMO_PREFIXES)) {
    return {
      kind: "rewrite",
      reason: "HOST_PATH_REWRITE",
      internalPath: publicToInternalPath("demo", pathname),
    };
  }
  if (pathname.startsWith("/auth/")) {
    return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
  }
  const legacyTarget = getLegacyCanonicalTarget(pathname);
  if (legacyTarget) return redirectOrReject(legacyTarget, method);
  return { kind: "reject", reason: "HOST_PATH_WRONG_SURFACE", status: 404 };
}
