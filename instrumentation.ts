export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateFirmEasyConfig, validateMercadoPagoConfig } = await import("@/lib/env/server");
    validateFirmEasyConfig();
    validateMercadoPagoConfig();
  }

  await import("@/lib/env/public");
}
