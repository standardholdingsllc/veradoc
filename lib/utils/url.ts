import "server-only";

export function getBaseUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://veradoc.pe"
  );
}

export function buildSigningLink(rawToken: string): string {
  return `${getBaseUrl()}/firma/${rawToken}`;
}
