import "server-only";

import { z } from "zod";

const optionalUrl = z.string().url().optional();

const schema = z.object({
  DEMO_ISOLATED_DEPLOYMENT: z.string().optional().default("false").transform((value) => value === "true"),
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  DEMO_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  DEMO_CONTROL_SECRET: z.string().min(32).optional(),
  DEMO_CONTROL_ORIGIN: optionalUrl,
  DEMO_EMAIL_API_KEY: z.string().min(1).optional(),
  DEMO_EMAIL_FROM: z.string().email().optional(),
  DEMO_ORIGIN: z.string().url().default("https://demo.veradoc.pe"),
});

const parsed = schema.parse(process.env);

export const demoConfig = {
  isolatedDeployment: parsed.DEMO_ISOLATED_DEPLOYMENT,
  backendUrl: parsed.KV_REST_API_URL,
  backendSecretKey: parsed.KV_REST_API_TOKEN,
  tokenEncryptionKey: parsed.DEMO_TOKEN_ENCRYPTION_KEY,
  controlSecret: parsed.DEMO_CONTROL_SECRET,
  controlOrigin: parsed.DEMO_CONTROL_ORIGIN,
  emailApiKey: parsed.DEMO_EMAIL_API_KEY,
  emailFrom: parsed.DEMO_EMAIL_FROM,
  origin: parsed.DEMO_ORIGIN.replace(/\/$/, ""),
};

export function buildDemoAbsoluteUrl(path: `/${string}`): string {
  if (path.startsWith("//")) throw new Error("DEMO_PATH_INVALID");
  return new URL(path, `${demoConfig.origin}/`).toString();
}

export function hasPersistentDemoBackend(): boolean {
  return Boolean(demoConfig.backendUrl && demoConfig.backendSecretKey);
}

export function assertPersistentDemoBackendConfigured(): void {
  if (!hasPersistentDemoBackend()) {
    throw new Error("DEMO_BACKEND_NOT_CONFIGURED");
  }
  if (!demoConfig.tokenEncryptionKey) {
    throw new Error("DEMO_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
  }
  if (process.env.NODE_ENV === "production" && !demoConfig.isolatedDeployment) {
    throw new Error("DEMO_ISOLATED_DEPLOYMENT_REQUIRED");
  }
}
