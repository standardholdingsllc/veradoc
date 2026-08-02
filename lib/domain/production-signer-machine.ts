import type { DbSignerStatus } from "./status-mapping";

/**
 * Canonical 8-step production signing flow.
 * Steps 0 (landing) and 5 (review) are UI-only gates that don't advance DB status.
 */
export const PRODUCTION_SIGNER_STEPS = [
  { key: "inicio", route: "", dbStatus: null, label: "Inicio" },
  { key: "verificar", route: "/verificar", dbStatus: "otp_verified" as const, label: "Verificación" },
  { key: "crear-cuenta", route: "/crear-cuenta", dbStatus: "account_created" as const, label: "Crear cuenta" },
  { key: "consentimiento", route: "/consentimiento", dbStatus: "consent_given" as const, label: "Consentimiento" },
  { key: "identidad", route: "/identidad", dbStatus: "identity_verified" as const, label: "Identidad" },
  { key: "revision", route: "/revision", dbStatus: null, label: "Revisión" },
  { key: "firmar", route: "/firmar", dbStatus: "signed" as const, label: "Firma" },
  { key: "completado", route: "/completado", dbStatus: "complete" as const, label: "Completado" },
] as const;

export const PRODUCTION_STEP_LABELS = PRODUCTION_SIGNER_STEPS.map((s) => s.label);

/**
 * DB signer status → step index in the production flow.
 * Used for resume logic and forward guards.
 */
const DB_STATUS_TO_STEP_INDEX: Record<DbSignerStatus, number> = {
  invited: 0,
  otp_verified: 1,
  account_created: 2,
  consent_given: 3,
  identity_verified: 4,
  signed: 6,
  complete: 7,
};

export function getProductionStepIndex(dbStatus: DbSignerStatus): number {
  return DB_STATUS_TO_STEP_INDEX[dbStatus] ?? 0;
}

/**
 * Given a DB signer status, return the route suffix to resume to,
 * or null if the signer should stay on the landing page.
 */
export function getResumeRoute(dbStatus: DbSignerStatus): string | null {
  switch (dbStatus) {
    case "invited":
      return null;
    case "otp_verified":
      return "/crear-cuenta";
    case "account_created":
      return "/consentimiento";
    case "consent_given":
      return "/identidad";
    case "identity_verified":
      return "/revision";
    case "signed":
    case "complete":
      return "/completado";
    default:
      return null;
  }
}

/**
 * Set of DB statuses that indicate the signer has passed a given step.
 * Used by forward guards on each step page.
 */
export function hasPassedStep(dbStatus: DbSignerStatus, stepIndex: number): boolean {
  return getProductionStepIndex(dbStatus) > stepIndex;
}
