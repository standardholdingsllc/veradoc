import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_NOTARY_COOKIE, DEMO_PRESENTER_COOKIE } from "@/lib/demo/constants";
import { demoErrorResponse, isAllowedDemoRequest, noStoreJson, readDemoJson } from "@/lib/demo/http";
import { getDemoControlState, getDemoWorkspaceByAccessToken } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(40).max(200) });

export async function POST(request: NextRequest) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    if (!(await getDemoControlState()).enabled) return new NextResponse(null, { status: 404 });
    const { token } = schema.parse(await readDemoJson(request));
    const payload = await getDemoWorkspaceByAccessToken(token, "notary");
    const response = noStoreJson(payload);
    response.cookies.set(DEMO_NOTARY_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      expires: new Date(payload.expiresAt),
    });
    response.cookies.delete(DEMO_PRESENTER_COOKIE);
    return response;
  } catch (error) {
    return demoErrorResponse(error);
  }
}
