import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any --
 * This migration-added table/RPC is intentionally isolated here until the
 * generated database types are refreshed; see the module documentation below.
 */

/**
 * Type-safe wrapper for firmeasy_webhook_log operations.
 * This table was added in migration 00014 and is not yet in database.types.ts.
 * Remove this file and use direct .from("firmeasy_webhook_log") after running
 * `npm run db:types` post-migration.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface WebhookLogRow {
  id: string;
  event_type: string;
  document_token: string | null;
  signer_token: string | null;
  payload_hash: string;
  raw_payload: Record<string, unknown>;
  processing_state: "received" | "processing" | "processed" | "failed";
  retry_count: number;
  processed_at: string | null;
  error_message: string | null;
  processing_started_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface WebhookLogInsert {
  event_type: string;
  document_token?: string | null;
  signer_token?: string | null;
  payload_hash: string;
  raw_payload: Record<string, unknown>;
  processing_state?: string;
  processing_started_at?: string;
}

function webhookLogTable(admin: AdminClient): any {
  return (admin as any).from("firmeasy_webhook_log");
}

/**
 * Inserts a webhook log row.
 * Returns the row on success, null on unique constraint violation (idempotency conflict).
 * Throws on any other error to prevent silent webhook loss.
 */
export async function insertWebhookLog(
  admin: AdminClient,
  data: WebhookLogInsert,
): Promise<{ id: string } | null> {
  const { data: inserted, error } = await webhookLogTable(admin)
    .insert({
      ...data,
      processing_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // Postgres unique_violation = conflict on payload_hash (expected for idempotency)
    if (error.code === "23505") {
      return null;
    }
    throw new Error(`[insertWebhookLog] ${error.message}`);
  }

  return inserted as { id: string } | null;
}

export async function findWebhookLogByHash(
  admin: AdminClient,
  payloadHash: string,
): Promise<Pick<WebhookLogRow, "id" | "processing_state" | "processing_started_at" | "created_at" | "retry_count"> | null> {
  const { data, error } = await webhookLogTable(admin)
    .select("id, processing_state, processing_started_at, created_at, retry_count")
    .eq("payload_hash", payloadHash)
    .maybeSingle();

  if (error) {
    throw new Error(`[findWebhookLogByHash] ${error.message}`);
  }

  return data as Pick<WebhookLogRow, "id" | "processing_state" | "processing_started_at" | "created_at" | "retry_count"> | null;
}

/**
 * Atomically claims a webhook log row for retry processing.
 * The RPC enforces staleness atomically in the WHERE clause, preventing
 * two concurrent retries from both claiming the same row.
 *
 * Returns { id } if successfully claimed, null if another worker already
 * claimed it (RPC returned false). Throws on RPC/DB errors so the route
 * can return 500 and allow FirmEasy to retry.
 */
export async function claimWebhookForRetry(
  admin: AdminClient,
  id: string,
): Promise<{ id: string } | null> {
  const { data, error } = await (admin as any)
    .rpc("claim_webhook_for_retry", { p_log_id: id });

  if (error) {
    throw new Error(`[claimWebhookForRetry] ${error.message}`);
  }

  // RPC returns boolean: true if a row was claimed, false if lost to another worker
  if (data === true) {
    return { id };
  }

  return null;
}

export async function markWebhookProcessed(
  admin: AdminClient,
  id: string,
): Promise<void> {
  const { error } = await webhookLogTable(admin)
    .update({
      processing_state: "processed",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`[markWebhookProcessed] ${error.message}`);
  }
}

export async function markWebhookFailed(
  admin: AdminClient,
  id: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await webhookLogTable(admin)
    .update({
      processing_state: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    // Log but don't throw — we're already in the error path.
    // Throwing here would mask the original processing error.
    console.error(`[markWebhookFailed] Could not update log ${id}: ${error.message}`);
  }
}
