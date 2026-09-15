import type { PublicTarget } from "./types";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function stripPrefix(pathname: string, prefix: string): `/${string}` {
  if (pathname === prefix) return "/";
  return pathname.slice(prefix.length) as `/${string}`;
}

export function getLegacyCanonicalTarget(
  pathname: string,
): PublicTarget | null {
  if (matchesPrefix(pathname, "/agente")) {
    return { surface: "app", path: pathname as `/${string}` };
  }
  if (matchesPrefix(pathname, "/arrendador")) {
    return { surface: "app", path: pathname as `/${string}` };
  }
  if (matchesPrefix(pathname, "/arrendatario")) {
    return { surface: "app", path: pathname as `/${string}` };
  }
  if (matchesPrefix(pathname, "/firma")) {
    return { surface: "app", path: pathname as `/${string}` };
  }
  if (matchesPrefix(pathname, "/notario")) {
    return { surface: "notary", path: stripPrefix(pathname, "/notario") };
  }
  if (matchesPrefix(pathname, "/admin")) {
    return { surface: "admin", path: stripPrefix(pathname, "/admin") };
  }
  if (matchesPrefix(pathname, "/demo")) {
    return { surface: "demo", path: stripPrefix(pathname, "/demo") };
  }
  if (pathname === "/auth/login" || pathname === "/auth/signup") {
    return { surface: "app", path: pathname };
  }
  return null;
}
