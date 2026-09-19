import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupAll,
  createAdminClient,
  createAuthenticatedClient,
  createTracker,
  uuid,
  type TestCleanupTracker,
} from "./supabase-test-helpers";

const admin = createAdminClient();
const tracker: TestCleanupTracker = createTracker();

let owner: { client: SupabaseClient; userId: string };
let otherRealtor: { client: SupabaseClient; userId: string };
let wrongRole: { client: SupabaseClient; userId: string };
let coverageId: string;

const pdf = Buffer.from("%PDF-1.4\n% synthetic integration fixture\n%%EOF\n");
const hash = crypto.createHash("sha256").update(pdf).digest("hex");

function canonicalPath(packetId: string): string {
  return `packets/${packetId}/lease_original.pdf`;
}

async function reserveAndUpload(packetId: string) {
  const reservation = await owner.client.rpc("reserve_lease_packet_upload", {
    p_packet_id: packetId,
    p_document_hash: hash,
  });
  expect(reservation.error).toBeNull();

  const upload = await owner.client.storage
    .from("documents")
    .upload(canonicalPath(packetId), pdf, {
      contentType: "application/pdf",
      upsert: false,
    });
  expect(upload.error).toBeNull();

  const marked = await admin.rpc("mark_lease_packet_uploaded", {
    p_packet_id: packetId,
    p_actor_id: owner.userId,
    p_document_hash: hash,
  });
  expect(marked.error).toBeNull();
}

beforeAll(async () => {
  owner = await createAuthenticatedClient(admin, tracker, "realtor");
  otherRealtor = await createAuthenticatedClient(admin, tracker, "realtor");
  wrongRole = await createAuthenticatedClient(admin, tracker, "notary");

  const coverage = await admin
    .from("notary_coverage")
    .insert({
      notary_id: wrongRole.userId,
      province: "LIMA",
      department: "LIMA",
      active: true,
    })
    .select("id")
    .single();
  if (coverage.error || !coverage.data) {
    throw new Error(`P-001 coverage fixture: ${coverage.error?.message}`);
  }
  coverageId = coverage.data.id;
});

afterAll(async () => {
  for (const packetId of tracker.packetIds) {
    await admin.storage.from("documents").remove([canonicalPath(packetId)]);
  }
  if (coverageId) {
    await admin.from("notary_coverage").delete().eq("id", coverageId);
  }
  await cleanupAll(admin, tracker);
});

describe("P-001 owned upload reservations", () => {
  it("allows only an active realtor to reserve and enforces packet ownership in Storage", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);

    const denied = await wrongRole.client.rpc("reserve_lease_packet_upload", {
      p_packet_id: uuid(),
      p_document_hash: hash,
    });
    expect(denied.error).not.toBeNull();

    const reserved = await owner.client.rpc("reserve_lease_packet_upload", {
      p_packet_id: packetId,
      p_document_hash: hash,
    });
    expect(reserved.error).toBeNull();
    expect(reserved.data?.[0]).toMatchObject({
      packet_id: packetId,
      creation_state: "uploading",
      document_hash: hash,
    });

    const wrongOwnerUpload = await otherRealtor.client.storage
      .from("documents")
      .upload(canonicalPath(packetId), pdf, {
        contentType: "application/pdf",
        upsert: false,
      });
    expect(wrongOwnerUpload.error).not.toBeNull();

    const ownerUpload = await owner.client.storage
      .from("documents")
      .upload(canonicalPath(packetId), pdf, {
        contentType: "application/pdf",
        upsert: false,
      });
    expect(ownerUpload.error).toBeNull();
  });

  it("makes same-ID/same-hash reservation retries idempotent and rejects hash changes", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);

    const first = await owner.client.rpc("reserve_lease_packet_upload", {
      p_packet_id: packetId,
      p_document_hash: hash,
    });
    const retry = await owner.client.rpc("reserve_lease_packet_upload", {
      p_packet_id: packetId,
      p_document_hash: hash,
    });
    const conflict = await owner.client.rpc("reserve_lease_packet_upload", {
      p_packet_id: packetId,
      p_document_hash: "0".repeat(64),
    });

    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data?.[0]?.packet_id).toBe(packetId);
    expect(conflict.error).not.toBeNull();
  });

  it("denies direct lifecycle, document, and signer mutations", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);
    await reserveAndUpload(packetId);

    const lifecycle = await owner.client
      .from("lease_packets")
      .update({ creation_state: "finalized" })
      .eq("id", packetId);
    const document = await owner.client.from("packet_documents").insert({
      packet_id: packetId,
      document_type: "lease_original",
      storage_path: canonicalPath(packetId),
      file_hash: hash,
      uploaded_by: owner.userId,
    });
    const signer = await owner.client.from("packet_signers").insert({
      packet_id: packetId,
      role_in_lease: "landlord",
      signer_email: "direct@example.test",
      signer_full_name: "Direct Insert",
      signer_dni: "12345678",
      signer_whatsapp: "+51999999999",
      status: "invited",
    });

    expect(lifecycle.error).not.toBeNull();
    expect(document.error).not.toBeNull();
    expect(signer.error).not.toBeNull();
  });

  it("finalizes atomically and returns idempotent success without duplicates", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);
    await reserveAndUpload(packetId);

    const input = {
      p_packet_id: packetId,
      p_property_address: `Av. P001 ${packetId.slice(0, 8)}`,
      p_property_unit: "",
      p_district: "MIRAFLORES",
      p_province: "LIMA",
      p_department: "LIMA",
      p_rental_amount: 1800,
      p_deposit_amount: 1800,
      p_lease_start: "2026-10-01",
      p_lease_end: "2027-10-01",
      p_signers: [
        {
          role_in_lease: "landlord",
          signer_email: "owner@example.test",
          signer_full_name: "Synthetic Owner",
          signer_dni: "12345678",
          signer_whatsapp: "+51999999999",
        },
        {
          role_in_lease: "renter",
          signer_email: "renter@example.test",
          signer_full_name: "Synthetic Renter",
          signer_dni: "87654321",
          signer_whatsapp: "+51988888888",
        },
      ],
    };

    const first = await owner.client.rpc("finalize_lease_packet", input);
    const retry = await owner.client.rpc("finalize_lease_packet", input);
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ idempotent: false, packet_id: packetId });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ idempotent: true, packet_id: packetId });

    const [{ count: signers }, { count: documents }, { count: audits }, packet] =
      await Promise.all([
        admin.from("packet_signers").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("packet_documents").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("packet_audit_log").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("lease_packets").select("creation_state, upload_reservation_expires_at").eq("id", packetId).single(),
      ]);

    expect(signers).toBe(2);
    expect(documents).toBe(1);
    expect(audits).toBe(2);
    expect(packet.data).toMatchObject({
      creation_state: "finalized",
      upload_reservation_expires_at: null,
    });
  });

  it("rolls back all finalization writes when signer validation fails", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);
    await reserveAndUpload(packetId);

    const failed = await owner.client.rpc("finalize_lease_packet", {
      p_packet_id: packetId,
      p_property_address: `Av. Invalid ${packetId.slice(0, 8)}`,
      p_property_unit: "",
      p_district: "MIRAFLORES",
      p_province: "LIMA",
      p_department: "LIMA",
      p_rental_amount: 1800,
      p_deposit_amount: 1800,
      p_lease_start: "2026-10-01",
      p_lease_end: "2027-10-01",
      p_signers: [{ role_in_lease: "landlord" }],
    });
    expect(failed.error).not.toBeNull();

    const [{ count: signers }, { count: documents }, { count: audits }, packet] =
      await Promise.all([
        admin.from("packet_signers").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("packet_documents").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("packet_audit_log").select("id", { count: "exact", head: true }).eq("packet_id", packetId),
        admin.from("lease_packets").select("creation_state").eq("id", packetId).single(),
      ]);

    expect(signers).toBe(0);
    expect(documents).toBe(0);
    expect(audits).toBe(0);
    expect(packet.data?.creation_state).toBe("uploaded");
  });

  it("makes cleanup fencing irreversible across worker-claim expiry", async () => {
    const packetId = uuid();
    tracker.packetIds.push(packetId);
    await reserveAndUpload(packetId);

    await admin
      .from("lease_packets")
      .update({ upload_reservation_expires_at: "2020-01-01T00:00:00Z" })
      .eq("id", packetId);

    const firstClaim = await admin.rpc("claim_lease_upload_cleanup", { p_limit: 100 });
    expect(firstClaim.error).toBeNull();
    const claim = firstClaim.data?.find(
      (row: { packet_id: string }) => row.packet_id === packetId,
    );
    expect(claim).toBeDefined();

    await admin
      .from("lease_packets")
      .update({ cleanup_claim_expires_at: "2020-01-01T00:00:00Z" })
      .eq("id", packetId);

    const finalize = await owner.client.rpc("finalize_lease_packet", {
      p_packet_id: packetId,
      p_property_address: "Av. Cleanup 123",
      p_property_unit: "",
      p_district: "MIRAFLORES",
      p_province: "LIMA",
      p_department: "LIMA",
      p_rental_amount: 1800,
      p_deposit_amount: 1800,
      p_lease_start: "2026-10-01",
      p_lease_end: "2027-10-01",
      p_signers: [{
        role_in_lease: "landlord",
        signer_email: "cleanup@example.test",
        signer_full_name: "Cleanup Fixture",
        signer_dni: "12345678",
        signer_whatsapp: "+51999999999",
      }],
    });
    expect(finalize.error).not.toBeNull();

    const secondClaim = await admin.rpc("claim_lease_upload_cleanup", { p_limit: 100 });
    const replacement = secondClaim.data?.find(
      (row: { packet_id: string }) => row.packet_id === packetId,
    );
    expect(replacement).toBeDefined();
    expect(replacement?.claim_token).not.toBe(claim?.claim_token);

    const staleCompletion = await admin.rpc("complete_lease_upload_cleanup", {
      p_packet_id: packetId,
      p_claim_token: claim!.claim_token,
    });
    expect(staleCompletion.data).toBe(false);

    const removal = await admin.storage.from("documents").remove([canonicalPath(packetId)]);
    expect(removal.error).toBeNull();
    const completed = await admin.rpc("complete_lease_upload_cleanup", {
      p_packet_id: packetId,
      p_claim_token: replacement!.claim_token,
    });
    expect(completed.error).toBeNull();
    expect(completed.data).toBe(true);
  });
});
