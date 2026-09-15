import type { ProfileRole } from "@/lib/auth/types";

export const CANONICAL_SURFACES = [
  "marketing",
  "app",
  "notary",
  "admin",
  "demo",
] as const;

export type CanonicalSurface = (typeof CANONICAL_SURFACES)[number];
export type Surface = CanonicalSurface | "preview" | "local" | "unknown";

export type PublicPath = `/${string}`;

export interface PublicTarget {
  surface: CanonicalSurface;
  path: PublicPath;
}

export const ROLE_TARGETS = {
  admin: { surface: "admin", path: "/" },
  notary: { surface: "notary", path: "/" },
  realtor: { surface: "app", path: "/agente" },
  landlord: { surface: "app", path: "/arrendador" },
  renter: { surface: "app", path: "/arrendatario" },
} satisfies Record<ProfileRole, PublicTarget>;
