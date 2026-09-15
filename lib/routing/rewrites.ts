import type { CanonicalSurface, PublicPath } from "./types";

function prefixInternalPath(prefix: string, pathname: string): PublicPath {
  if (pathname === "/") return prefix as PublicPath;
  return `${prefix}${pathname}` as PublicPath;
}

export function publicToInternalPath(
  surface: CanonicalSurface,
  pathname: string,
): PublicPath {
  if (surface === "notary") return prefixInternalPath("/notario", pathname);
  if (surface === "admin") return prefixInternalPath("/admin", pathname);
  if (surface === "demo") return prefixInternalPath("/demo", pathname);
  return pathname as PublicPath;
}

export function stripInternalPrefix(
  surface: "notary" | "admin" | "demo",
  pathname: string,
): PublicPath | null {
  const prefix = surface === "notary" ? "/notario" : `/${surface}`;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) as PublicPath;
  }
  return null;
}
