import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));

import { processUploadReservationCleanupBatch } from "@/lib/services/upload-reservation-cleanup";

const packetId = "11111111-1111-4111-8111-111111111111";
const claimToken = "22222222-2222-4222-8222-222222222222";
const canonicalPath = `packets/${packetId}/lease_original.pdf`;

function mockAdmin(options?: {
  path?: string;
  storageError?: string;
  completed?: boolean;
}) {
  const remove = vi.fn().mockResolvedValue({
    data: null,
    error: options?.storageError ? { message: options.storageError } : null,
  });
  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_lease_upload_cleanup") {
      return {
        data: [{
          packet_id: packetId,
          storage_path: options?.path ?? canonicalPath,
          claim_token: claimToken,
        }],
        error: null,
      };
    }
    return { data: options?.completed ?? true, error: null };
  });
  const client = {
    rpc,
    storage: { from: vi.fn(() => ({ remove })) },
  } as unknown as SupabaseClient<Database>;
  return { client, remove, rpc };
}

describe("upload reservation cleanup worker", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("deletes only the canonical object before completing the claim", async () => {
    const { client, remove, rpc } = mockAdmin();

    await expect(processUploadReservationCleanupBatch(client, 5)).resolves.toEqual({
      claimed: 1,
      deleted: 1,
      failed: 0,
    });
    expect(remove).toHaveBeenCalledWith([canonicalPath]);
    expect(rpc).toHaveBeenLastCalledWith("complete_lease_upload_cleanup", {
      p_packet_id: packetId,
      p_claim_token: claimToken,
    });
  });

  it("refuses a non-canonical path without touching Storage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, remove, rpc } = mockAdmin({
      path: `packets/${packetId}/unexpected.pdf`,
    });

    await expect(processUploadReservationCleanupBatch(client)).resolves.toEqual({
      claimed: 1,
      deleted: 0,
      failed: 1,
    });
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("leaves the reservation claimed when Storage deletion fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, rpc } = mockAdmin({ storageError: "temporary failure" });

    await expect(processUploadReservationCleanupBatch(client)).resolves.toEqual({
      claimed: 1,
      deleted: 0,
      failed: 1,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
