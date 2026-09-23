import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_MODE: z.enum(["production", "demo"]).default("demo"),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
});

export const publicEnv = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (process.env.DEMO_ISOLATED_DEPLOYMENT === "true" ? "https://demo-disabled.invalid" : undefined),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    (process.env.DEMO_ISOLATED_DEPLOYMENT === "true" ? "demo-disabled" : undefined),
  NEXT_PUBLIC_MODE: process.env.NEXT_PUBLIC_MODE,
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
});

export function isMercadoPagoPublicKeyConfigured(): boolean {
  return !!publicEnv.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
}
