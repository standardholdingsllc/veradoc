import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { processOutboxBatch } from "@/lib/services/notification-outbox";
import { processNotaryWorkflowJobBatch } from "@/lib/services/notary-workflow-jobs";

function getCronSecret(): string | undefined {
  return serverEnv.CRON_SECRET ?? serverEnv.OUTBOX_CRON_SECRET;
}

async function handleProcess(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = getCronSecret();

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let lifecycle: unknown = { enabled: false };
  let lifecycleError: { message: string } | null = null;
  if (serverEnv.COMMERCIAL_ARCHIVAL_MUTATIONS_ENABLED) {
    const scheduled = await admin.rpc("schedule_commercial_lifecycle");
    lifecycle = scheduled.data;
    lifecycleError = scheduled.error;
    if (lifecycleError) {
      console.error("[commercial-lifecycle] scheduling failed:", lifecycleError.message);
    }
  }
  const notaryJobs = await processNotaryWorkflowJobBatch(admin, 10);
  const result = await processOutboxBatch(admin, 20);

  return NextResponse.json({
    notaryJobs,
    lifecycle: lifecycleError ? { error: lifecycleError.message } : lifecycle,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  });
}

export async function GET(request: Request) {
  return handleProcess(request);
}

export async function POST(request: Request) {
  return handleProcess(request);
}
