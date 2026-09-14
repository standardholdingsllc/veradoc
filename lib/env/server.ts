import "server-only";
import { z } from "zod";

const booleanFromString = z
  .string()
  .optional()
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  SITE_URL: z.string().url().default("https://veradoc.pe"),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  IOFE_SIGNING_API_KEY: z.string().optional(),
  IOFE_SIGNING_API_URL: z.string().url().optional(),
  DEMO_PAYMENTS_ENABLED: booleanFromString,
  // Mercado Pago Checkout API (Payments API)
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_ENVIRONMENT: z.enum(["test", "production"]).default("test"),
  // FirmEasy digital signature (firmeasy.legal)
  FIRMEASY_API_BASE_URL: z.string().url().optional(),
  FIRMEASY_USER_INTEGRATION_TOKEN: z.string().optional(),
  FIRMEASY_EMAIL: z.string().optional(),
  FIRMEASY_PASSWORD: z.string().optional(),
  FIRMEASY_WEBHOOK_SECRET: z.string().optional(),
  FIRMEASY_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
  FIRMEASY_ALLOW_DEV_STUB: booleanFromString,
  // Physical-sello notary workflow
  NOTARY_SEAL_WORKFLOW_ENABLED: booleanFromString,
  COMMERCIAL_ARCHIVAL_MUTATIONS_ENABLED: booleanFromString,
  OUTBOX_CRON_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // APIsPERU Facturación v1.3 — electronic CPE issuance
  APISPERU_COMPANY_TOKEN: z.string().optional(),
  APISPERU_BASE_URL: z
    .string()
    .url()
    .default("https://facturacion.apisperu.com/api/v1"),
  APISPERU_ENVIRONMENT: z.enum(["beta", "production"]).default("beta"),
  APISPERU_EMITTER_RUC: z.string().optional(),
  APISPERU_EMITTER_RAZON_SOCIAL: z.string().optional(),
  APISPERU_EMITTER_NOMBRE_COMERCIAL: z.string().optional(),
  APISPERU_EMITTER_DIRECCION: z.string().optional(),
  APISPERU_EMITTER_UBIGUEO: z.string().optional(),
  APISPERU_EMITTER_PROVINCIA: z.string().optional(),
  APISPERU_EMITTER_DEPARTAMENTO: z.string().optional(),
  APISPERU_EMITTER_DISTRITO: z.string().optional(),
  APISPERU_FACTURA_SERIES: z.string().optional(),
  APISPERU_BOLETA_SERIES: z.string().optional(),
  APISPERU_CREDIT_NOTE_FACTURA_SERIES: z.string().optional(),
  APISPERU_CREDIT_NOTE_BOLETA_SERIES: z.string().optional(),
  // API PERÚ RUC lookup product (separate host/subscription)
  APIPERU_LOOKUP_TOKEN: z.string().optional(),
  APIPERU_LOOKUP_BASE_URL: z
    .string()
    .url()
    .default("https://apiperu.net/api"),
});

export const serverEnv = schema.parse(process.env);

export function isDemoPaymentsEnabled(): boolean {
  return serverEnv.DEMO_PAYMENTS_ENABLED;
}

// ---------------------------------------------------------------------------
// Mercado Pago configuration helpers
// ---------------------------------------------------------------------------

export function isMercadoPagoConfigured(): boolean {
  return !!(
    serverEnv.MERCADOPAGO_ACCESS_TOKEN &&
    serverEnv.MERCADOPAGO_WEBHOOK_SECRET
  );
}

export function validateMercadoPagoConfig(): void {
  const { MERCADOPAGO_ENVIRONMENT, DEMO_PAYMENTS_ENABLED } = serverEnv;

  if (MERCADOPAGO_ENVIRONMENT === "production" && DEMO_PAYMENTS_ENABLED) {
    throw new Error(
      "FATAL: DEMO_PAYMENTS_ENABLED must be false when MERCADOPAGO_ENVIRONMENT=production",
    );
  }

  if (MERCADOPAGO_ENVIRONMENT === "production") {
    if (!serverEnv.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("FATAL: MERCADOPAGO_ACCESS_TOKEN required in production mode");
    }
    if (!serverEnv.MERCADOPAGO_WEBHOOK_SECRET) {
      throw new Error("FATAL: MERCADOPAGO_WEBHOOK_SECRET required in production mode");
    }
  }
}

// ---------------------------------------------------------------------------
// FirmEasy configuration helpers
// ---------------------------------------------------------------------------

export function validateFirmEasyConfig(): void {
  const {
    FIRMEASY_MODE,
    FIRMEASY_API_BASE_URL,
    FIRMEASY_USER_INTEGRATION_TOKEN,
    FIRMEASY_EMAIL,
    FIRMEASY_PASSWORD,
    FIRMEASY_WEBHOOK_SECRET,
  } = serverEnv;

  if (FIRMEASY_MODE === "production") {
    if (!FIRMEASY_API_BASE_URL) {
      throw new Error("FATAL: FIRMEASY_API_BASE_URL required in production mode");
    }
    if (!FIRMEASY_USER_INTEGRATION_TOKEN) {
      throw new Error("FATAL: FIRMEASY_USER_INTEGRATION_TOKEN required in production mode");
    }
    if (!FIRMEASY_EMAIL) {
      throw new Error("FATAL: FIRMEASY_EMAIL required in production mode");
    }
    if (!FIRMEASY_PASSWORD) {
      throw new Error("FATAL: FIRMEASY_PASSWORD required in production mode");
    }
    if (!FIRMEASY_WEBHOOK_SECRET) {
      throw new Error("FATAL: FIRMEASY_WEBHOOK_SECRET required in production mode");
    }
  }
}

export function isFirmEasyConfigured(): boolean {
  return !!(
    serverEnv.FIRMEASY_API_BASE_URL &&
    serverEnv.FIRMEASY_USER_INTEGRATION_TOKEN &&
    serverEnv.FIRMEASY_EMAIL &&
    serverEnv.FIRMEASY_PASSWORD
  );
}

// ---------------------------------------------------------------------------
// Notary physical-sello workflow configuration
// ---------------------------------------------------------------------------

export function isNotarySealWorkflowGloballyEnabled(): boolean {
  return serverEnv.NOTARY_SEAL_WORKFLOW_ENABLED;
}

// ---------------------------------------------------------------------------
// APIsPERU CPE issuance configuration
// ---------------------------------------------------------------------------

export function isApisPeruConfigured(): boolean {
  return !!(
    serverEnv.APISPERU_COMPANY_TOKEN &&
    serverEnv.APISPERU_EMITTER_RUC &&
    serverEnv.APISPERU_EMITTER_RAZON_SOCIAL &&
    serverEnv.APISPERU_FACTURA_SERIES &&
    serverEnv.APISPERU_BOLETA_SERIES &&
    serverEnv.APISPERU_CREDIT_NOTE_FACTURA_SERIES &&
    serverEnv.APISPERU_CREDIT_NOTE_BOLETA_SERIES
  );
}

export function validateApisPeruConfig(): {
  companyToken: string;
  baseUrl: string;
  environment: "beta" | "production";
  emitter: {
    ruc: string;
    razonSocial: string;
    nombreComercial: string | undefined;
    direccion: string;
    ubigueo: string;
    provincia: string;
    departamento: string;
    distrito: string;
  };
  series: {
    factura: string;
    boleta: string;
    creditNoteFactura: string;
    creditNoteBoleta: string;
  };
} {
  const {
    APISPERU_COMPANY_TOKEN,
    APISPERU_BASE_URL,
    APISPERU_ENVIRONMENT,
    APISPERU_EMITTER_RUC,
    APISPERU_EMITTER_RAZON_SOCIAL,
    APISPERU_EMITTER_NOMBRE_COMERCIAL,
    APISPERU_EMITTER_DIRECCION,
    APISPERU_EMITTER_UBIGUEO,
    APISPERU_EMITTER_PROVINCIA,
    APISPERU_EMITTER_DEPARTAMENTO,
    APISPERU_EMITTER_DISTRITO,
    APISPERU_FACTURA_SERIES,
    APISPERU_BOLETA_SERIES,
    APISPERU_CREDIT_NOTE_FACTURA_SERIES,
    APISPERU_CREDIT_NOTE_BOLETA_SERIES,
  } = serverEnv;

  if (!APISPERU_COMPANY_TOKEN) throw new Error("FATAL: APISPERU_COMPANY_TOKEN is required");
  if (!APISPERU_EMITTER_RUC) throw new Error("FATAL: APISPERU_EMITTER_RUC is required");
  if (!APISPERU_EMITTER_RAZON_SOCIAL) throw new Error("FATAL: APISPERU_EMITTER_RAZON_SOCIAL is required");
  if (!APISPERU_EMITTER_DIRECCION) throw new Error("FATAL: APISPERU_EMITTER_DIRECCION is required");
  if (!APISPERU_EMITTER_UBIGUEO) throw new Error("FATAL: APISPERU_EMITTER_UBIGUEO is required");
  if (!APISPERU_EMITTER_PROVINCIA) throw new Error("FATAL: APISPERU_EMITTER_PROVINCIA is required");
  if (!APISPERU_EMITTER_DEPARTAMENTO) throw new Error("FATAL: APISPERU_EMITTER_DEPARTAMENTO is required");
  if (!APISPERU_EMITTER_DISTRITO) throw new Error("FATAL: APISPERU_EMITTER_DISTRITO is required");
  if (!APISPERU_FACTURA_SERIES) throw new Error("FATAL: APISPERU_FACTURA_SERIES is required");
  if (!APISPERU_BOLETA_SERIES) throw new Error("FATAL: APISPERU_BOLETA_SERIES is required");
  if (!APISPERU_CREDIT_NOTE_FACTURA_SERIES) throw new Error("FATAL: APISPERU_CREDIT_NOTE_FACTURA_SERIES is required");
  if (!APISPERU_CREDIT_NOTE_BOLETA_SERIES) throw new Error("FATAL: APISPERU_CREDIT_NOTE_BOLETA_SERIES is required");

  if (!/^F/.test(APISPERU_FACTURA_SERIES)) {
    throw new Error("FATAL: APISPERU_FACTURA_SERIES must start with 'F'");
  }
  if (!/^B/.test(APISPERU_BOLETA_SERIES)) {
    throw new Error("FATAL: APISPERU_BOLETA_SERIES must start with 'B'");
  }
  if (!/^F/.test(APISPERU_CREDIT_NOTE_FACTURA_SERIES)) {
    throw new Error("FATAL: APISPERU_CREDIT_NOTE_FACTURA_SERIES must start with 'F' (factura family)");
  }
  if (!/^B/.test(APISPERU_CREDIT_NOTE_BOLETA_SERIES)) {
    throw new Error("FATAL: APISPERU_CREDIT_NOTE_BOLETA_SERIES must start with 'B' (boleta family)");
  }

  return {
    companyToken: APISPERU_COMPANY_TOKEN,
    baseUrl: APISPERU_BASE_URL,
    environment: APISPERU_ENVIRONMENT,
    emitter: {
      ruc: APISPERU_EMITTER_RUC,
      razonSocial: APISPERU_EMITTER_RAZON_SOCIAL,
      nombreComercial: APISPERU_EMITTER_NOMBRE_COMERCIAL || undefined,
      direccion: APISPERU_EMITTER_DIRECCION,
      ubigueo: APISPERU_EMITTER_UBIGUEO,
      provincia: APISPERU_EMITTER_PROVINCIA,
      departamento: APISPERU_EMITTER_DEPARTAMENTO,
      distrito: APISPERU_EMITTER_DISTRITO,
    },
    series: {
      factura: APISPERU_FACTURA_SERIES,
      boleta: APISPERU_BOLETA_SERIES,
      creditNoteFactura: APISPERU_CREDIT_NOTE_FACTURA_SERIES,
      creditNoteBoleta: APISPERU_CREDIT_NOTE_BOLETA_SERIES,
    },
  };
}

export function isRucLookupConfigured(): boolean {
  return !!serverEnv.APIPERU_LOOKUP_TOKEN;
}

export function getRucLookupConfig(): {
  token: string;
  baseUrl: string;
} {
  if (!serverEnv.APIPERU_LOOKUP_TOKEN) {
    throw new Error("FATAL: APIPERU_LOOKUP_TOKEN is required for RUC lookup");
  }
  return {
    token: serverEnv.APIPERU_LOOKUP_TOKEN,
    baseUrl: serverEnv.APIPERU_LOOKUP_BASE_URL,
  };
}
