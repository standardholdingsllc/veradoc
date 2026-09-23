import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoErrorResponse, isAllowedDemoRequest, noStoreJson, readDemoJson } from "@/lib/demo/http";
import { getDemoControlState, mutateDemoSignerWorkspace } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("open_link") }),
  z.object({ type: z.literal("verify_otp"), code: z.string().length(6) }),
  z.object({ type: z.literal("create_account") }),
  z.object({ type: z.literal("accept_consent") }),
  z.object({ type: z.literal("upload_identity") }),
  z.object({ type: z.literal("complete_liveness") }),
  z.object({ type: z.literal("review_lease") }),
  z.object({ type: z.literal("simulate_signature") }),
  z.object({
    type: z.literal("resume_after_correction"),
    scope: z.enum(["identity_recheck", "contract_revision"]),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  if (!isAllowedDemoRequest(request)) return new NextResponse(null, { status: 404 });
  try {
    if (!(await getDemoControlState()).enabled) return new NextResponse(null, { status: 404 });
    const { token } = await context.params;
    const action = actionSchema.parse(await readDemoJson(request));
    return noStoreJson(await mutateDemoSignerWorkspace(token, action));
  } catch (error) {
    return demoErrorResponse(error);
  }
}
