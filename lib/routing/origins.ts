import "server-only";

import { serverEnv } from "@/lib/env/server";
import { buildAbsoluteUrlFromOrigins, parseOriginMap } from "./origin-config";
import type { PublicTarget } from "./types";

export const origins = parseOriginMap(
  {
    marketing: serverEnv.PUBLIC_ORIGIN,
    app: serverEnv.APP_ORIGIN,
    notary: serverEnv.NOTARY_ORIGIN,
    admin: serverEnv.ADMIN_ORIGIN,
    demo: serverEnv.DEMO_ORIGIN,
  },
  { requireHttps: process.env.NODE_ENV === "production" },
);

export function buildAbsoluteUrl(
  target: PublicTarget,
  query?: Record<string, string | undefined>,
): string {
  return buildAbsoluteUrlFromOrigins(origins, target, query);
}

export function buildSigningEntryUrl(rawToken: string): string {
  return buildAbsoluteUrl({ surface: "app", path: `/firma/${rawToken}` });
}

export function buildSigningCompletionUrl(rawToken: string): string {
  return buildAbsoluteUrl({
    surface: "app",
    path: `/firma/${rawToken}/completado`,
  });
}

export function buildNotaryInvitationCallbackUrl(
  invitationToken: string,
): string {
  return buildAbsoluteUrl(
    { surface: "notary", path: "/auth/callback" },
    { invitation: invitationToken },
  );
}

export function buildNotaryPacketUrl(packetId: string): string {
  return buildAbsoluteUrl({ surface: "notary", path: `/paquetes/${packetId}` });
}

export function buildAdminDashboardUrl(): string {
  return buildAbsoluteUrl({ surface: "admin", path: "/" });
}
