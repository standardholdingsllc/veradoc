import { SIGNER_STEPS } from "@/lib/i18n/labels";

/** Ordered labels for the 8-step signer flow (matches signer-machine step order). */
export const SIGNER_STEP_LABELS = [
  SIGNER_STEPS.inicio,
  SIGNER_STEPS.verificar,
  SIGNER_STEPS.crearCuenta,
  SIGNER_STEPS.consentimiento,
  SIGNER_STEPS.identidad,
  SIGNER_STEPS.revision,
  SIGNER_STEPS.firmar,
  SIGNER_STEPS.completado,
] as const;
