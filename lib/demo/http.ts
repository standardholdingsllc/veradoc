import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { classifyHost } from "@/lib/routing/surfaces";
import { DEMO_MAX_REQUEST_BYTES } from "./constants";

const STATUS_BY_ERROR: Record<string, number> = {
  DEMO_BACKEND_NOT_CONFIGURED: 503,
  DEMO_BACKEND_UNAVAILABLE: 503,
  DEMO_CONTROL_UNAVAILABLE: 503,
  DEMO_WORKSPACE_NOT_FOUND: 404,
  DEMO_WORKSPACE_EXPIRED: 410,
  DEMO_SIGNER_LINK_INVALID: 404,
  DEMO_PACKET_NOT_FOUND: 404,
  DEMO_OTP_INVALID: 400,
  DEMO_SIGNER_INVALID_TRANSITION: 409,
  DEMO_VERSION_CONFLICT: 409,
  DEMO_SNAPSHOT_TOO_LARGE: 413,
  DEMO_EMAIL_NOT_ALLOWED: 422,
  DEMO_DNI_MUST_BE_SYNTHETIC: 422,
  DEMO_PHONE_MUST_BE_SYNTHETIC: 422,
  DEMO_EMAIL_NOT_CONFIGURED: 503,
  DEMO_EMAIL_RATE_LIMITED: 429,
};

export function demoErrorResponse(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "DEMO_REQUEST_FAILED";
  const status = STATUS_BY_ERROR[code] ?? 500;
  return NextResponse.json(
    { error: code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function isAllowedDemoRequest(request: NextRequest): boolean {
  const classification = classifyHost(request.nextUrl.host, {
    vercelEnvironment: process.env.VERCEL_ENV,
    isolatedDemoDeployment: process.env.DEMO_ISOLATED_DEPLOYMENT === "true",
    vercelHostname: [
      process.env.VERCEL_URL ?? "",
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    ],
  });
  if (!["demo", "local", "preview"].includes(classification.surface)) return false;
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function readDemoJson(request: NextRequest): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > DEMO_MAX_REQUEST_BYTES) throw new Error("DEMO_SNAPSHOT_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > DEMO_MAX_REQUEST_BYTES) {
    throw new Error("DEMO_SNAPSHOT_TOO_LARGE");
  }
  return JSON.parse(text) as unknown;
}

export function constantTimeSecretMatch(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function noStoreJson(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
