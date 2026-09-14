import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupAll,
  createAdminClient,
  createAuthenticatedClient,
  createTracker,
  seedPacket,
  type TestCleanupTracker,
} from "./supabase-test-helpers";

const admin = createAdminClient();
const tracker: TestCleanupTracker = createTracker();

let notary: { client: SupabaseClient; userId: string };
let otherNotary: { client: SupabaseClient; userId: string };
let realtor: { client: SupabaseClient; userId: string };
let adminUser: { client: SupabaseClient; userId: string };

beforeAll(async () => {
  notary = await createAuthenticatedClient(admin, tracker, "notary");
  otherNotary = await createAuthenticatedClient(admin, tracker, "notary");
  realtor = await createAuthenticatedClient(admin, tracker, "realtor");
  adminUser = await createAuthenticatedClient(admin, tracker, "admin");
});

afterAll(async () => cleanupAll(admin, tracker));

describe("roadmap 9 RPC authorization", () => {
  it("lets only the assigned notary update the checklist and emits actor/context audit", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: realtor.userId,
      notaryId: notary.userId,
      status: "under_review",
      workflowVersion: "legacy_v1",
    });

    const denied = await realtor.client.rpc("update_notary_checklist_item", {
      p_packet_id: packetId,
      p_item_key: "revisarDocumento",
      p_checked: true,
      p_context: { source: "integration-test" },
    });
    expect(denied.error).not.toBeNull();

    const allowed = await notary.client.rpc("update_notary_checklist_item", {
      p_packet_id: packetId,
      p_item_key: "revisarDocumento",
      p_checked: true,
      p_context: { source: "integration-test" },
    });
    expect(allowed.error).toBeNull();

    const { data: audit } = await admin
      .from("packet_audit_log")
      .select("actor_id, action, metadata, created_at")
      .eq("packet_id", packetId)
      .eq("action", "checklist_item_checked")
      .single();
    expect(audit?.actor_id).toBe(notary.userId);
    expect(Number.isFinite(new Date(audit?.created_at ?? "").getTime())).toBe(true);
    expect((audit?.metadata as Record<string, unknown>)?.item_key).toBe("revisarDocumento");
    expect(
      ((audit?.metadata as Record<string, unknown>)?.context as Record<string, unknown>)?.source,
    ).toBe("integration-test");
  });

  it("does not expose service-role workflow RPCs to authenticated users", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: realtor.userId,
      notaryId: notary.userId,
    });

    const actorSpoof = await notary.client.rpc("start_notary_review", {
      p_packet_id: packetId,
      p_actor_id: otherNotary.userId,
      p_workflow_version: "legacy_v1",
    });
    expect(actorSpoof.error).not.toBeNull();

    const workerClaim = await notary.client.rpc("claim_notary_workflow_jobs", {
      p_limit: 1,
    });
    expect(workerClaim.error).not.toBeNull();
  });

  it("rejects priority changes from a non-assigned notary", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: realtor.userId,
      notaryId: notary.userId,
    });

    const denied = await otherNotary.client.rpc("set_notary_assignment_priority", {
      p_packet_id: packetId,
      p_priority: "urgent",
      p_reason: "Not assigned",
    });
    expect(denied.error).not.toBeNull();

    const allowed = await notary.client.rpc("set_notary_assignment_priority", {
      p_packet_id: packetId,
      p_priority: "high",
      p_reason: "Plazo contractual",
    });
    expect(allowed.error).toBeNull();

    const { data: assignment } = await admin
      .from("notary_assignments")
      .select("priority, priority_reason")
      .eq("packet_id", packetId)
      .single();
    expect(assignment?.priority).toBe("high");
    expect(assignment?.priority_reason).toBe("Plazo contractual");
  });

  it("persists correction scope and enqueues recipient notifications atomically", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: realtor.userId,
      notaryId: notary.userId,
      status: "under_review",
      workflowVersion: "legacy_v1",
    });

    const denied = await realtor.client.rpc("submit_notary_decision", {
      p_packet_id: packetId,
      p_decision: "needs_correction",
      p_observations: "Actualizar DNI",
      p_correction_scope: "identity_recheck",
    });
    expect(denied.error).not.toBeNull();

    const allowed = await notary.client.rpc("submit_notary_decision", {
      p_packet_id: packetId,
      p_decision: "needs_correction",
      p_observations: "Actualizar DNI",
      p_correction_scope: "identity_recheck",
    });
    expect(allowed.error).toBeNull();

    const [{ data: assignment }, { data: outbox }] = await Promise.all([
      admin
        .from("notary_assignments")
        .select("decision, correction_scope")
        .eq("packet_id", packetId)
        .single(),
      admin
        .from("notification_outbox")
        .select("event_type, status")
        .eq("packet_id", packetId),
    ]);
    expect(assignment?.decision).toBe("needs_correction");
    expect(assignment?.correction_scope).toBe("identity_recheck");
    expect(outbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "packet_needs_correction_realtor",
          status: "pending",
        }),
      ]),
    );
  });

  it("records a structured SUNARP check only for the assigned notary", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: realtor.userId,
      notaryId: notary.userId,
      status: "under_review",
      workflowVersion: "legacy_v1",
    });
    const input = {
      p_packet_id: packetId,
      p_title_number: "12345678",
      p_verification_status: "verified",
      p_checked_at: "2026-09-08T12:00:00Z",
      p_query_reference: "SPR-TEST-001",
      p_owner_names: ["Titular de prueba"],
    };

    expect((await otherNotary.client.rpc("record_property_authority_check", input)).error)
      .not.toBeNull();
    expect((await notary.client.rpc("record_property_authority_check", input)).error)
      .toBeNull();
  });

  it("allows only admins to configure a contracted rate", async () => {
    const input = {
      p_notary_id: notary.userId,
      p_amount: 25,
      p_effective_from: "2026-09-01",
      p_contract_reference: "ADENDA-2026-09",
    };
    expect((await notary.client.rpc("set_notary_contracted_rate", input)).error)
      .not.toBeNull();
    expect((await adminUser.client.rpc("set_notary_contracted_rate", input)).error)
      .toBeNull();
  });
});
