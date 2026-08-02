import type { UserRole } from "@/lib/domain/types";

/** Superset of UserRole that includes the admin role used by the auth layer. */
export type ProfileRole = "admin" | UserRole;

export type ProfileStatus =
  | "active"
  | "pending_approval"
  | "rejected"
  | "suspended";

export interface AuthProfile {
  id: string;
  role: ProfileRole;
  status: ProfileStatus;
  fullName: string;
  email: string;
}

export interface AppMetadata {
  role?: ProfileRole;
  status?: ProfileStatus;
  province?: string;
}
