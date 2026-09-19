import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type UploadReservationCleanupResult = {
  claimed: number;
  deleted: number;
  failed: number;
};

export async function processUploadReservationCleanupBatch(
  admin: SupabaseClient<Database>,
  limit = 20,
): Promise<UploadReservationCleanupResult> {
  const { data: claims, error: claimError } = await admin.rpc(
    "claim_lease_upload_cleanup",
    { p_limit: limit },
  );

  if (claimError) {
    throw new Error(`Upload-reservation cleanup claim failed: ${claimError.message}`);
  }

  const result: UploadReservationCleanupResult = {
    claimed: claims?.length ?? 0,
    deleted: 0,
    failed: 0,
  };

  for (const claim of claims ?? []) {
    const canonicalPath = `packets/${claim.packet_id}/lease_original.pdf`;
    if (claim.storage_path !== canonicalPath) {
      result.failed += 1;
      console.error("[upload-reservation-cleanup] rejected non-canonical path", {
        packetId: claim.packet_id,
      });
      continue;
    }

    const { error: storageError } = await admin.storage
      .from("documents")
      .remove([canonicalPath]);

    if (storageError) {
      result.failed += 1;
      console.error("[upload-reservation-cleanup] storage deletion failed", {
        packetId: claim.packet_id,
        error: storageError.message,
      });
      continue;
    }

    const { data: completed, error: completionError } = await admin.rpc(
      "complete_lease_upload_cleanup",
      {
        p_packet_id: claim.packet_id,
        p_claim_token: claim.claim_token,
      },
    );

    if (completionError || completed !== true) {
      result.failed += 1;
      console.error("[upload-reservation-cleanup] completion failed", {
        packetId: claim.packet_id,
        error: completionError?.message ?? "claim no longer current",
      });
      continue;
    }

    result.deleted += 1;
  }

  return result;
}
