import type { ProfileRole } from "@/lib/auth/types";
import { ROLE_TARGETS, type PublicTarget } from "./types";

export function getPublicTargetForRole(role: ProfileRole): PublicTarget {
  return ROLE_TARGETS[role];
}
