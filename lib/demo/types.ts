import type { LeasePacket, RegistryEntry, User, UserRole } from "@/lib/domain/types";

export interface DemoSnapshot {
  users: User[];
  packets: LeasePacket[];
  registry: RegistryEntry[];
  currentRole: UserRole;
}
export type DemoAccessRole = "presenter" | "notary" | "signer";

export interface DemoWorkspaceLinks {
  notary: string;
  signers: Record<string, string>;
}

export interface DemoWorkspacePayload {
  workspaceId: string;
  version: number;
  expiresAt: string;
  accessRole: DemoAccessRole;
  snapshot: DemoSnapshot;
  links: DemoWorkspaceLinks;
}

export type DemoSignerAction =
  | { type: "open_link" }
  | { type: "verify_otp"; code: string }
  | { type: "create_account" }
  | { type: "accept_consent" }
  | { type: "upload_identity" }
  | { type: "complete_liveness" }
  | { type: "review_lease" }
  | { type: "simulate_signature" }
  | { type: "resume_after_correction"; scope: "identity_recheck" | "contract_revision" };

export interface DemoControlState {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}
