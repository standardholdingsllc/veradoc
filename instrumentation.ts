export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate server-side environment variables at startup (fail fast)
    const { validateCulqiConfig, validateFirmEasyConfig } = await import("@/lib/env/server");
    validateCulqiConfig();
    validateFirmEasyConfig();
  }

  // Public env validation runs in all runtimes
  await import("@/lib/env/public");
}
