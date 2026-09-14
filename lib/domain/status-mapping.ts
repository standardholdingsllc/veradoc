import type { PacketStatus, SignerStatus } from "./types";

// DB lease_packets.status values
export const DB_PACKET_STATUSES = [
  "draft",
  "signing",
  "all_signed",
  "pending_notary",
  "under_review",
  "awaiting_notary_seal",
  "needs_correction",
  "certified",
  "rejected",
  "archived",
] as const;

export type DbPacketStatus = (typeof DB_PACKET_STATUSES)[number];

// DB packet_signers.status values (7 total)
// Production order: consent_given before identity_verified
export const DB_SIGNER_STATUSES = [
  "invited",
  "otp_verified",
  "account_created",
  "consent_given",
  "identity_verified",
  "signed",
  "complete",
] as const;

export type DbSignerStatus = (typeof DB_SIGNER_STATUSES)[number];

const PACKET_DB_TO_DISPLAY: Record<DbPacketStatus, PacketStatus> = {
  draft: "draft",
  signing: "sent_to_signers",
  all_signed: "all_signers_complete",
  pending_notary: "ready_for_notary",
  under_review: "under_notary_review",
  awaiting_notary_seal: "awaiting_notary_seal",
  needs_correction: "needs_correction",
  certified: "certified",
  rejected: "rejected",
  archived: "archived",
};

const PACKET_DISPLAY_TO_DB: Partial<Record<PacketStatus, DbPacketStatus>> = {
  draft: "draft",
  awaiting_payment: "draft",
  ready_to_send: "draft",
  sent_to_signers: "signing",
  partially_signed: "signing",
  all_signers_complete: "all_signed",
  evidence_report_generated: "all_signed",
  ready_for_notary: "pending_notary",
  under_notary_review: "under_review",
  awaiting_notary_seal: "awaiting_notary_seal",
  needs_correction: "needs_correction",
  certified: "certified",
  certified_with_observations: "certified",
  rejected: "rejected",
  archived: "archived",
};

/**
 * Map a DB lease_packets.status to a display PacketStatus.
 * For `certified`, pass context.certType from notary_certifications.certification_type
 * to distinguish `certified` from `certified_with_observations`.
 * Pass context.isExpired for certified leases whose term has ended.
 */
export function dbStatusToDisplay(
  dbStatus: string,
  context?: { certType?: string; isExpired?: boolean },
): PacketStatus {
  if (dbStatus === "certified" && context?.isExpired) {
    return "expired";
  }
  if (
    dbStatus === "certified" &&
    context?.certType === "certified_with_observations"
  ) {
    return "certified_with_observations";
  }
  if (dbStatus === "awaiting_notary_seal") {
    return "awaiting_notary_seal";
  }
  return (
    PACKET_DB_TO_DISPLAY[dbStatus as DbPacketStatus] ?? (dbStatus as PacketStatus)
  );
}

/**
 * Map a display PacketStatus back to DB status for query filters.
 */
export function displayStatusToDb(displayStatus: string): DbPacketStatus | undefined {
  return PACKET_DISPLAY_TO_DB[displayStatus as PacketStatus];
}

const SIGNER_DB_TO_DISPLAY: Record<DbSignerStatus, SignerStatus> = {
  invited: "link_sent",
  otp_verified: "otp_verified",
  account_created: "account_created",
  identity_verified: "identity_uploaded",
  consent_given: "consent_accepted",
  signed: "signed",
  complete: "complete",
};

/**
 * Map a DB packet_signers.status to a display SignerStatus.
 */
export function dbSignerStatusToDisplay(dbStatus: string): SignerStatus {
  return (
    SIGNER_DB_TO_DISPLAY[dbStatus as DbSignerStatus] ??
    (dbStatus as SignerStatus)
  );
}

/** Terminal packet statuses that represent completed/closed states */
export const TERMINAL_DB_STATUSES: DbPacketStatus[] = [
  "certified",
  "rejected",
  "archived",
];

export function isTerminalDbStatus(status: string): boolean {
  return TERMINAL_DB_STATUSES.includes(status as DbPacketStatus);
}
