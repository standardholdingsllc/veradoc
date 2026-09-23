import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { demoErrorResponse, isAllowedDemoRequest, noStoreJson } from "@/lib/demo/http";
import { getDemoControlState, getDemoSignerWorkspace } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    if (!(await getDemoControlState()).enabled) return new NextResponse(null, { status: 404 });
    const { token } = await context.params;
    return noStoreJson(await getDemoSignerWorkspace(token));
  } catch (error) {
    return demoErrorResponse(error);
  }
}
