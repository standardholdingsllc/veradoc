import type { CorrectionScope, SignerStatus } from "./types";

export interface SignerTransitionEvent {
  type: string;
  correctionScope?: CorrectionScope;
}

interface SignerTransitionRule {
  from: SignerStatus;
  eventType: string;
  to: SignerStatus;
  correctionScopes?: CorrectionScope[];
}

const SIGNER_TRANSITIONS: SignerTransitionRule[] = [
  { from: "link_sent", eventType: "open_link", to: "link_opened" },
  { from: "link_opened", eventType: "verify_otp", to: "otp_verified" },
  { from: "otp_verified", eventType: "create_account", to: "account_created" },
  {
    from: "account_created",
    eventType: "accept_consent",
    to: "consent_accepted",
  },
  {
    from: "consent_accepted",
    eventType: "upload_identity",
    to: "identity_uploaded",
  },
  {
    from: "identity_uploaded",
    eventType: "verify_identity_demo",
    to: "identity_verified_demo",
  },
  {
    from: "identity_verified_demo",
    eventType: "review_lease",
    to: "lease_reviewed",
  },
  {
    from: "lease_reviewed",
    eventType: "start_signature",
    to: "signature_started",
  },
  {
    from: "signature_started",
    eventType: "complete_signature",
    to: "signed",
  },
  { from: "signed", eventType: "confirm_signature", to: "complete" },
  // needs_correction → consent_accepted — identity_recheck: redo identity, preserve consent
  {
    from: "needs_correction",
    eventType: "resume_after_correction",
    to: "consent_accepted",
    correctionScopes: ["identity_recheck"],
  },
  // needs_correction → link_opened — contract_revision: redo flow from OTP onward
  {
    from: "needs_correction",
    eventType: "resume_after_correction",
    to: "link_opened",
    correctionScopes: ["contract_revision"],
  },
];

const SIGNER_TRANSITION_MAP = new Map<string, SignerTransitionRule[]>(
  SIGNER_TRANSITIONS.reduce((map, rule) => {
    const key = `${rule.from}:${rule.eventType}`;
    const existing = map.get(key) ?? [];
    existing.push(rule);
    map.set(key, existing);
    return map;
  }, new Map<string, SignerTransitionRule[]>()),
);

function findSignerRule(
  current: SignerStatus,
  event: SignerTransitionEvent,
): SignerTransitionRule | undefined {
  const rules = SIGNER_TRANSITION_MAP.get(`${current}:${event.type}`);
  if (!rules) {
    return undefined;
  }

  return rules.find((rule) => {
    if (!rule.correctionScopes) {
      return !event.correctionScope;
    }
    return (
      event.correctionScope !== undefined &&
      rule.correctionScopes.includes(event.correctionScope)
    );
  });
}

export function canTransitionSigner(
  current: SignerStatus,
  event: SignerTransitionEvent,
): boolean {
  return findSignerRule(current, event) !== undefined;
}

export function transitionSigner(
  current: SignerStatus,
  event: SignerTransitionEvent,
): SignerStatus {
  const rule = findSignerRule(current, event);
  if (!rule) {
    throw new Error(
      `Invalid signer transition: ${current} + ${event.type}`,
    );
  }
  return rule.to;
}

/** 8 user-facing steps: inicio → verificar → crear-cuenta → consentimiento → identidad → revisión → firmar → completado */
export const SIGNER_STEPS = [
  { key: "inicio", label: "Inicio", statuses: ["link_sent", "link_opened"] },
  { key: "verificar", label: "Verificar", statuses: ["otp_verified"] },
  {
    key: "crear-cuenta",
    label: "Crear cuenta",
    statuses: ["account_created"],
  },
  {
    key: "consentimiento",
    label: "Consentimiento",
    statuses: ["consent_accepted"],
  },
  {
    key: "identidad",
    label: "Identidad",
    statuses: ["identity_uploaded", "identity_verified_demo"],
  },
  { key: "revision", label: "Revisión", statuses: ["lease_reviewed"] },
  {
    key: "firmar",
    label: "Firmar",
    statuses: ["signature_started", "signed"],
  },
  { key: "completado", label: "Completado", statuses: ["complete"] },
] as const;

const STATUS_TO_STEP_INDEX = new Map<SignerStatus, number>(
  SIGNER_STEPS.flatMap((step, index) =>
    step.statuses.map((status) => [status as SignerStatus, index]),
  ),
);

/** Returns 0–7 for the 8 user-facing steps, or -1 for needs_correction */
export function getSignerStepIndex(status: SignerStatus): number {
  if (status === "needs_correction") {
    return -1;
  }
  return STATUS_TO_STEP_INDEX.get(status) ?? 0;
}
