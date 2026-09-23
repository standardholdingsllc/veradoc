import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEMO_NOTARY_COOKIE, DEMO_PRESENTER_COOKIE } from "@/lib/demo/constants";
import { demoErrorResponse, isAllowedDemoRequest, noStoreJson } from "@/lib/demo/http";
import { createDemoWorkspace, getDemoControlState } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    if (!(await getDemoControlState()).enabled) return new NextResponse(null, { status: 404 });
    const { payload, presenterToken } = await createDemoWorkspace();
    const response = noStoreJson(payload, { status: 201 });
    response.cookies.set(DEMO_PRESENTER_COOKIE, presenterToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      expires: new Date(payload.expiresAt),
    });
    response.cookies.delete(DEMO_NOTARY_COOKIE);
    return response;
  } catch (error) {
    return demoErrorResponse(error);
  }
}
