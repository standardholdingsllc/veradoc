import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  DEMO_NOTARY_COOKIE,
  DEMO_PRESENTER_COOKIE,
} from "@/lib/demo/constants";
import {
  demoErrorResponse,
  isAllowedDemoRequest,
  noStoreJson,
  readDemoJson,
} from "@/lib/demo/http";
import {
  deleteDemoWorkspace,
  getDemoControlState,
  getDemoWorkspaceByAccessToken,
  saveDemoWorkspace,
} from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

function access(request: NextRequest): { token: string; role: "presenter" | "notary" } | undefined {
  const presenter = request.cookies.get(DEMO_PRESENTER_COOKIE)?.value;
  if (presenter) return { token: presenter, role: "presenter" };
  const notary = request.cookies.get(DEMO_NOTARY_COOKIE)?.value;
  if (notary) return { token: notary, role: "notary" };
  return undefined;
}

async function enabled(): Promise<boolean> {
  return (await getDemoControlState()).enabled;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAllowedDemoRequest(request) || !(await enabled())) {
      return new NextResponse(null, { status: 404 });
    }
    const granted = access(request);
    if (!granted) return noStoreJson({ error: "DEMO_ACCESS_REQUIRED" }, { status: 401 });
    return noStoreJson(await getDemoWorkspaceByAccessToken(granted.token, granted.role));
  } catch (error) {
    return demoErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAllowedDemoRequest(request) || !(await enabled())) {
      return new NextResponse(null, { status: 404 });
    }
    const granted = access(request);
    if (!granted) return noStoreJson({ error: "DEMO_ACCESS_REQUIRED" }, { status: 401 });
    const body = await readDemoJson(request) as { version?: unknown; snapshot?: unknown };
    if (!Number.isInteger(body.version)) return noStoreJson({ error: "DEMO_VERSION_REQUIRED" }, { status: 400 });
    const payload = await saveDemoWorkspace(
      granted.token,
      granted.role,
      body.version as number,
      body.snapshot,
    );
    return noStoreJson(payload);
  } catch (error) {
    return demoErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    if (!(await enabled())) return new NextResponse(null, { status: 404 });
    const presenter = request.cookies.get(DEMO_PRESENTER_COOKIE)?.value;
    if (!presenter) return noStoreJson({ error: "DEMO_PRESENTER_REQUIRED" }, { status: 403 });
    await deleteDemoWorkspace(presenter);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.delete(DEMO_PRESENTER_COOKIE);
    response.cookies.delete(DEMO_NOTARY_COOKIE);
    return response;
  } catch (error) {
    return demoErrorResponse(error);
  }
}
