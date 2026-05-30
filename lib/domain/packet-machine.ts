import type { CorrectionScope, PacketStatus } from "./types";

export interface PacketTransitionEvent {
  type: string;
  actor: "realtor" | "notary" | "system";
  correctionScope?: CorrectionScope;
}

type TransitionKey = `${PacketStatus}:${string}`;

interface TransitionRule {
  from: PacketStatus;
  eventType: string;
  to: PacketStatus;
  actor: PacketTransitionEvent["actor"];
  /** Guard: correctionScope required for needs_correction resubmission routing */
  correctionScopes?: CorrectionScope[];
}

// [fromState, eventType] → toState with guard descriptions as comments
const TRANSITIONS: TransitionRule[] = [
  // draft → awaiting_payment — Guard: packet form complete, lease document uploaded; Actor: realtor
  {
    from: "draft",
    eventType: "packet_form_complete",
    to: "awaiting_payment",
    actor: "realtor",
  },
  // awaiting_payment → ready_to_send — Guard: payment confirmed; Actor: system
  {
    from: "awaiting_payment",
    eventType: "payment_confirmed",
    to: "ready_to_send",
    actor: "system",
  },
  // ready_to_send → sent_to_signers — Guard: signers exist; Actor: realtor
  {
    from: "ready_to_send",
    eventType: "send_to_signers",
    to: "sent_to_signers",
    actor: "realtor",
  },
  // sent_to_signers → partially_signed — Guard: at least one signer complete; Actor: system
  {
    from: "sent_to_signers",
    eventType: "signer_complete",
    to: "partially_signed",
    actor: "system",
  },
  // partially_signed → all_signers_complete — Guard: all signers complete; Actor: system
  {
    from: "partially_signed",
    eventType: "all_signers_complete",
    to: "all_signers_complete",
    actor: "system",
  },
  // all_signers_complete → evidence_report_generated — Guard: evidence report generated; Actor: system
  {
    from: "all_signers_complete",
    eventType: "evidence_report_generated",
    to: "evidence_report_generated",
    actor: "system",
  },
  // evidence_report_generated → ready_for_notary — Guard: evidence report exists; Actor: realtor
  {
    from: "evidence_report_generated",
    eventType: "submit_to_notary",
    to: "ready_for_notary",
    actor: "realtor",
  },
  // ready_for_notary → under_notary_review — Guard: explicit notary start; Actor: notary
  {
    from: "ready_for_notary",
    eventType: "start_review",
    to: "under_notary_review",
    actor: "notary",
  },
  // under_notary_review → certified — Guard: checklist complete, decision certify; Actor: notary
  {
    from: "under_notary_review",
    eventType: "certify",
    to: "certified",
    actor: "notary",
  },
  // under_notary_review → certified_with_observations — Guard: checklist complete, observations; Actor: notary
  {
    from: "under_notary_review",
    eventType: "certify_with_observations",
    to: "certified_with_observations",
    actor: "notary",
  },
  // under_notary_review → needs_correction — Guard: correction reason provided; Actor: notary
  {
    from: "under_notary_review",
    eventType: "return_for_correction",
    to: "needs_correction",
    actor: "notary",
  },
  // under_notary_review → rejected — Guard: rejection reason provided; Actor: notary
  {
    from: "under_notary_review",
    eventType: "reject",
    to: "rejected",
    actor: "notary",
  },
  // needs_correction → sent_to_signers — Guard: identity_recheck or contract_revision; Actor: realtor
  {
    from: "needs_correction",
    eventType: "resubmit_to_signers",
    to: "sent_to_signers",
    actor: "realtor",
    correctionScopes: ["identity_recheck", "contract_revision"],
  },
  // needs_correction → ready_for_notary — Guard: document_metadata or notary_observation; Actor: realtor
  {
    from: "needs_correction",
    eventType: "resubmit_to_notary",
    to: "ready_for_notary",
    actor: "realtor",
    correctionScopes: ["document_metadata", "notary_observation"],
  },
  // certified → renewal_available — Guard: lease expired; Actor: system (time-based)
  {
    from: "certified",
    eventType: "renewal_eligible",
    to: "renewal_available",
    actor: "system",
  },
  // certified_with_observations → renewal_available — Guard: lease expired; Actor: system (time-based)
  {
    from: "certified_with_observations",
    eventType: "renewal_eligible",
    to: "renewal_available",
    actor: "system",
  },
];

const TRANSITION_MAP = new Map<TransitionKey, TransitionRule>(
  TRANSITIONS.map((rule) => [`${rule.from}:${rule.eventType}`, rule]),
);

function findMatchingRule(
  current: PacketStatus,
  event: PacketTransitionEvent,
): TransitionRule | undefined {
  const rule = TRANSITION_MAP.get(`${current}:${event.type}`);
  if (!rule || rule.actor !== event.actor) {
    return undefined;
  }

  if (rule.correctionScopes) {
    if (!event.correctionScope) {
      return undefined;
    }
    if (!rule.correctionScopes.includes(event.correctionScope)) {
      return undefined;
    }
  }

  return rule;
}

export function canTransition(
  current: PacketStatus,
  event: PacketTransitionEvent,
): boolean {
  return findMatchingRule(current, event) !== undefined;
}

export function transition(
  current: PacketStatus,
  event: PacketTransitionEvent,
): PacketStatus {
  const rule = findMatchingRule(current, event);
  if (!rule) {
    throw new Error(
      `Invalid packet transition: ${current} + ${event.type} (actor: ${event.actor})`,
    );
  }
  return rule.to;
}

const NEXT_ACTIONS_BY_STATUS: Record<
  PacketStatus,
  Partial<Record<PacketTransitionEvent["actor"], string[]>>
> = {
  draft: { realtor: ["packet_form_complete"] },
  awaiting_payment: {},
  ready_to_send: { realtor: ["send_to_signers"] },
  sent_to_signers: {},
  partially_signed: {},
  all_signers_complete: { realtor: ["evidence_report_generated"] },
  evidence_report_generated: { realtor: ["submit_to_notary"] },
  ready_for_notary: { notary: ["start_review"] },
  under_notary_review: {
    notary: [
      "certify",
      "certify_with_observations",
      "return_for_correction",
      "reject",
    ],
  },
  needs_correction: {
    realtor: ["resubmit_to_signers", "resubmit_to_notary"],
  },
  certified: {},
  certified_with_observations: {},
  rejected: {},
  archived: {},
  renewal_available: { realtor: ["start_renewal"] },
  renewal_in_progress: {},
};

export function getNextActions(status: PacketStatus, role: string): string[] {
  const roleActions = NEXT_ACTIONS_BY_STATUS[status];
  if (!roleActions) {
    return [];
  }

  const actor = role as PacketTransitionEvent["actor"];
  if (actor in roleActions) {
    return roleActions[actor] ?? [];
  }

  return [];
}
