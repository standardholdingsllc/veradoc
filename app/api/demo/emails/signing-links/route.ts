import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PRESENTER_COOKIE } from "@/lib/demo/constants";
import { sendDemoSigningEmails } from "@/lib/demo/email";
import { demoErrorResponse, isAllowedDemoRequest, noStoreJson, readDemoJson } from "@/lib/demo/http";
import { getDemoControlState } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  packetId: z.string().min(1).max(200),
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  const presenterToken = request.cookies.get(DEMO_PRESENTER_COOKIE)?.value;
  if (!presenterToken) return noStoreJson({ error: "DEMO_PRESENTER_REQUIRED" }, { status: 403 });
  try {
    if (!(await getDemoControlState()).enabled) return new NextResponse(null, { status: 404 });
    const body = schema.parse(await readDemoJson(request));
    return noStoreJson(await sendDemoSigningEmails({ presenterToken, ...body }));
  } catch (error) {
    const code =
      error instanceof Error && /^DEMO_[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "DEMO_SIGNING_EMAIL_REQUEST_FAILED";
    console.error("[demo-signing-email] request failed", { code });
    return demoErrorResponse(error);
  }
}
