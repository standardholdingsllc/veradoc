import type { PacketStatus, SignerStatus } from "@/lib/domain/types";

export function domainPacketStatusToDb(status: PacketStatus): string {
  const map: Record<PacketStatus, string> = {
    draft: "draft",
    awaiting_payment: "draft",
    ready_to_send: "draft",
    sent_to_signers: "signing",
    partially_signed: "signing",
    all_signers_complete: "all_signed",
    evidence_report_generated: "all_signed",
    ready_for_notary: "pending_notary",
    under_notary_review: "under_review",
    certified: "certified",
    certified_with_observations: "certified",
    needs_correction: "needs_correction",
    rejected: "rejected",
    archived: "certified",
    expired: "certified",
    renewal_available: "certified",
    renewal_in_progress: "certified",
  };
  return map[status];
}

export function dbPacketStatusToDomain(
  dbStatus: string,
  context: {
    hasPaymentPending?: boolean;
    hasPaymentCompleted?: boolean;
    signingTokensSent?: boolean;
    allSignersComplete?: boolean;
    submittedToNotaryAt?: string | null;
    certificationType?: string | null;
    leaseEndDate?: string | null;
    hasChildPacket?: boolean;
  },
): PacketStatus {
  switch (dbStatus) {
    case "draft":
      if (context.hasPaymentPending) return "awaiting_payment";
      if (context.hasPaymentCompleted && !context.signingTokensSent) return "ready_to_send";
      return "draft";
    case "signing":
      if (context.allSignersComplete) return "all_signers_complete";
      return context.signingTokensSent ? "partially_signed" : "sent_to_signers";
    case "all_signed":
      if (context.submittedToNotaryAt) return "ready_for_notary";
      return "all_signers_complete";
    case "pending_notary":
      return "ready_for_notary";
    case "under_review":
      return "under_notary_review";
    case "needs_correction":
      return "needs_correction";
    case "certified":
      if (context.certificationType === "certified_with_observations")
        return "certified_with_observations";
      if (context.hasChildPacket) return "renewal_in_progress";
      if (context.leaseEndDate && new Date(context.leaseEndDate) < new Date())
        return "expired";
      return "certified";
    case "rejected":
      return "rejected";
    default:
      return "draft";
  }
}

export function domainSignerStatusToDb(status: SignerStatus): string {
  const map: Record<SignerStatus, string> = {
    link_sent: "invited",
    link_opened: "invited",
    otp_verified: "otp_verified",
    account_created: "account_created",
    consent_accepted: "consent_given",
    identity_uploaded: "identity_verified",
    identity_verified_demo: "identity_verified",
    lease_reviewed: "identity_verified",
    signature_started: "identity_verified",
    signed: "signed",
    complete: "complete",
    needs_correction: "invited",
  };
  return map[status];
}

export function dbSignerStatusToDomain(dbStatus: string): SignerStatus {
  const map: Record<string, SignerStatus> = {
    invited: "link_sent",
    otp_verified: "otp_verified",
    account_created: "account_created",
    identity_verified: "identity_uploaded",
    consent_given: "consent_accepted",
    signed: "signed",
    complete: "complete",
  };
  return map[dbStatus] ?? "link_sent";
}
