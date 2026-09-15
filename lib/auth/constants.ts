import type { ProfileRole } from "./types";
import { ROLE_TARGETS } from "@/lib/routing/types";

export const AUTH_ROUTES = {
  login: "/auth/login",
  signup: "/auth/signup",
  callback: "/auth/callback",
  pendingApproval: "/auth/pending-approval",
  rejected: "/auth/rejected",
  invitePrefix: "/auth/invite",
  mfa: "/auth/mfa",
} as const;

/** Maps each role to its production dashboard root path. */
export const ROLE_DASHBOARD_MAP: Record<ProfileRole, string> = {
  admin: "/admin",
  notary: "/notario",
  realtor: "/agente",
  landlord: "/arrendador",
  renter: "/arrendatario",
};

/** Maps a dashboard URL prefix to the role required to access it. */
export const ROUTE_ROLE_MAP: { prefix: string; role: ProfileRole }[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/agente", role: "realtor" },
  { prefix: "/notario", role: "notary" },
  { prefix: "/arrendador", role: "landlord" },
  { prefix: "/arrendatario", role: "renter" },
];

export function getDashboardForRole(role: ProfileRole): string {
  return ROLE_DASHBOARD_MAP[role];
}

export function getPublicDashboardPathForRole(role: ProfileRole): string {
  return ROLE_TARGETS[role].path;
}
