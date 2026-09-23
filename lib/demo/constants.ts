export const DEMO_EMAIL_ALLOWLIST = [
  "jonahllarson@gmail.com",
  "kimberlydayanara08@gmail.com",
] as const;

export const DEMO_WORKSPACE_TTL_HOURS = 8;
export const DEMO_MAX_PACKETS = 25;
export const DEMO_MAX_REQUEST_BYTES = 1_000_000;
export const DEMO_POLL_INTERVAL_MS = 5_000;
export const DEMO_CONSENT_VERSION = "demo-v1";

export const DEMO_PRESENTER_COOKIE = "veradoc_demo_presenter";
export const DEMO_NOTARY_COOKIE = "veradoc_demo_notary";

export function isAllowedDemoEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_EMAIL_ALLOWLIST.some((allowed) => allowed === normalized);
}
