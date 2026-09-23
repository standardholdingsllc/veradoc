import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoConfig } from "@/lib/demo/config";
import { constantTimeSecretMatch, demoErrorResponse, noStoreJson, readDemoJson } from "@/lib/demo/http";
import { getDemoControlState, setDemoControlState } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  actorId: z.string().uuid(),
});

function authorized(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  return constantTimeSecretMatch(token, demoConfig.controlSecret);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 404 });
  try {
    return noStoreJson(await getDemoControlState());
  } catch (error) {
    return demoErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return new NextResponse(null, { status: 404 });
  try {
    const body = schema.parse(await readDemoJson(request));
    return noStoreJson(await setDemoControlState(body.enabled, body.actorId));
  } catch (error) {
    return demoErrorResponse(error);
  }
}
