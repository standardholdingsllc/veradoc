/**
 * Integration tests for the notary seal workflow hardening RPCs and RLS policies.
 *
 * Requires a running local Supabase instance (`npx supabase start`).
 * Run with: npm run test:integration
 *
 * These tests exercise the actual database — no mocks.
 *
 * All test identities are created via admin.auth.admin.createUser to satisfy
 * the profiles.id → auth.users(id) FK.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAdminClient,
  createTestUser,
  createAuthenticatedClient,
  createTracker,
  cleanupAll,
  seedPacket,
  seedNotaryWorkflowSettings,
  seedDocument,
  seedChecklist,
  seedAttestation,
  seedCertification,
  uuid,
  type TestCleanupTracker,
} from "./supabase-test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const admin = createAdminClient();
const tracker: TestCleanupTracker = createTracker();

let notaryId: string;
let realtorId: string;
let otherNotaryId: string;

const VALID_SCAN_METADATA = {
  validation_result: {
    pdf_header_ok: true,
    pdf_structure_ok: true,
    not_encrypted: true,
    validator_version: "1.0.0",
  },
};

beforeAll(async () => {
  notaryId = await createTestUser(admin, tracker, "notary", "active");
  realtorId = await createTestUser(admin, tracker, "realtor", "active");
  otherNotaryId = await createTestUser(admin, tracker, "notary", "active");
  await seedNotaryWorkflowSettings(admin, notaryId, true);
  await seedNotaryWorkflowSettings(admin, otherNotaryId, true);
});

afterAll(async () => {
  await cleanupAll(admin, tracker);
});

// =========================================================================
// 1. is_active_notary authorization
// =========================================================================

describe("is_active_notary authorization", () => {
  it("returns true for active notary", async () => {
    const { data, error } = await admin.rpc("is_active_notary", { p_user_id: notaryId });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("returns false for a realtor", async () => {
    const { data, error } = await admin.rpc("is_active_notary", { p_user_id: realtorId });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("returns false for suspended notary", async () => {
    const suspendedId = await createTestUser(admin, tracker, "notary", "suspended");
    const { data, error } = await admin.rpc("is_active_notary", { p_user_id: suspendedId });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("returns false for nonexistent user", async () => {
    const { data, error } = await admin.rpc("is_active_notary", { p_user_id: uuid() });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

// =========================================================================
// 2. start_notary_review
// =========================================================================

describe("start_notary_review", () => {
  it("transitions packet to under_review", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "pending_notary" });

    const { error } = await admin.rpc("start_notary_review", {
      p_packet_id: packetId, p_actor_id: notaryId, p_workflow_version: "physical_seal_v1",
    });
    expect(error).toBeNull();

    const { data: packet } = await admin.from("lease_packets")
      .select("status, notary_workflow_version").eq("id", packetId).single();
    expect(packet?.status).toBe("under_review");
    expect(packet?.notary_workflow_version).toBe("physical_seal_v1");
  });

  it("rejects non-assigned notary", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "pending_notary" });

    const { error } = await admin.rpc("start_notary_review", {
      p_packet_id: packetId, p_actor_id: otherNotaryId, p_workflow_version: "physical_seal_v1",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not the assigned notary");
  });

  it("rejects realtor (wrong role)", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "pending_notary" });

    const { error } = await admin.rpc("start_notary_review", {
      p_packet_id: packetId, p_actor_id: realtorId, p_workflow_version: "physical_seal_v1",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not an active notary");
  });

  it("rejects wrong status", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });

    const { error } = await admin.rpc("start_notary_review", {
      p_packet_id: packetId, p_actor_id: notaryId, p_workflow_version: "physical_seal_v1",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("must be pending_notary");
  });
});

// =========================================================================
// 3. approve_evidence_for_seal
// =========================================================================

describe("approve_evidence_for_seal", () => {
  it("transitions to awaiting_notary_seal with complete prerequisites", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });
    await seedDocument(admin, packetId, "signed_pdf", realtorId);
    await seedDocument(admin, packetId, "evidence_report", notaryId);
    await seedChecklist(admin, packetId, notaryId, true);

    const { error } = await admin.rpc("approve_evidence_for_seal", {
      p_packet_id: packetId, p_actor_id: notaryId,
    });
    expect(error).toBeNull();

    const { data: packet } = await admin.from("lease_packets")
      .select("status").eq("id", packetId).single();
    expect(packet?.status).toBe("awaiting_notary_seal");
  });

  it("rejects incomplete checklist", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });
    await seedDocument(admin, packetId, "signed_pdf", realtorId);
    await seedDocument(admin, packetId, "evidence_report", notaryId);
    await seedChecklist(admin, packetId, notaryId, false);

    const { error } = await admin.rpc("approve_evidence_for_seal", {
      p_packet_id: packetId, p_actor_id: notaryId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not checked");
  });

  it("rejects missing signed_pdf", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });
    await seedDocument(admin, packetId, "evidence_report", notaryId);
    await seedChecklist(admin, packetId, notaryId, true);

    const { error } = await admin.rpc("approve_evidence_for_seal", {
      p_packet_id: packetId, p_actor_id: notaryId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("signed_pdf");
  });
});

// =========================================================================
// 4. replace_packet_document
// =========================================================================

describe("replace_packet_document", () => {
  it("creates new document on first call", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });
    const docId = uuid();

    const { data, error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "evidence_report",
      p_storage_path: `packets/${packetId}/evidence_reports/${docId}.pdf`,
      p_file_hash: "hash-abc-123", p_uploaded_by: notaryId, p_document_id: docId,
    });
    expect(error).toBeNull();
    const result = data as unknown as { new_document_id: string; idempotent: boolean };
    expect(result.idempotent).toBe(false);
    expect(result.new_document_id).toBe(docId);
  });

  it("idempotent replay returns accepted_storage_path and storage_path_to_delete", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });
    const docId = uuid();
    const hash = "hash-idem-001";
    const originalPath = `packets/${packetId}/evidence_reports/${docId}.pdf`;

    const { error: firstErr } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "evidence_report",
      p_storage_path: originalPath, p_file_hash: hash,
      p_uploaded_by: notaryId, p_document_id: docId,
    });
    expect(firstErr).toBeNull();

    const retryPath = `packets/${packetId}/evidence_reports/${uuid()}.pdf`;
    const { data, error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "evidence_report",
      p_storage_path: retryPath, p_file_hash: hash, p_uploaded_by: notaryId,
    });
    expect(error).toBeNull();
    const result = data as unknown as {
      new_document_id: string; idempotent: boolean;
      storage_path_to_delete: string; accepted_storage_path: string;
    };
    expect(result.idempotent).toBe(true);
    expect(result.new_document_id).toBe(docId);
    expect(result.storage_path_to_delete).toBe(retryPath);
    expect(result.accepted_storage_path).toBe(originalPath);
  });

  it("does NOT match idempotent when source_document_id differs", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });

    const signedDoc1 = await seedDocument(admin, packetId, "signed_pdf", realtorId, {
      fileHash: "hash-signed-src1",
    });
    // Seed second signed_pdf as superseded to respect idx_packet_documents_one_accepted
    const signedDoc2 = await seedDocument(admin, packetId, "signed_pdf", realtorId, {
      fileHash: "hash-signed-src2",
      status: "superseded",
    });

    const hash = "hash-scan-same-src";
    const { error: firstErr } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "notarial_scan",
      p_storage_path: `packets/${packetId}/scans/${uuid()}.pdf`,
      p_file_hash: hash, p_uploaded_by: notaryId, p_source_document_id: signedDoc1.docId,
    });
    expect(firstErr).toBeNull();

    // Supersede the first scan (created by the RPC) so the second call won't hit
    // the one-accepted constraint on notarial_scan either.
    // The RPC itself will supersede the old accepted notarial_scan when creating
    // a new one, so we just need to ensure the source differs.

    // Supersede signedDoc1 and accept signedDoc2 for the second source
    await admin.from("packet_documents").update({ status: "superseded" }).eq("id", signedDoc1.docId);
    await admin.from("packet_documents").update({ status: "accepted" }).eq("id", signedDoc2.docId);

    const { data, error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "notarial_scan",
      p_storage_path: `packets/${packetId}/scans/${uuid()}.pdf`,
      p_file_hash: hash, p_uploaded_by: notaryId, p_source_document_id: signedDoc2.docId,
    });
    expect(error).toBeNull();
    const result = data as unknown as { idempotent: boolean };
    expect(result.idempotent).toBe(false);
  });

  it("rejects non-replaceable document types", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });

    const { error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "lease_original",
      p_storage_path: `packets/${packetId}/original/${uuid()}.pdf`,
      p_file_hash: "hash-orig", p_uploaded_by: realtorId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not replaceable");
  });

  it("rejects physical artifact from non-assigned notary", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });

    const { error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "notarial_scan",
      p_storage_path: `packets/${packetId}/scans/${uuid()}.pdf`,
      p_file_hash: "hash-wrong-notary", p_uploaded_by: otherNotaryId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("assigned notary");
  });

  it("validates certification ownership before replay detection", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", realtorId);
    const scanDoc = await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId, metadata: VALID_SCAN_METADATA,
    });

    const fakeCertId = uuid();

    const { error } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "certification_report",
      p_storage_path: `packets/${packetId}/reports/${uuid()}.pdf`,
      p_file_hash: "hash-report-001", p_uploaded_by: notaryId,
      p_source_document_id: scanDoc.docId, p_certification_id: fakeCertId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not a prepared certification");
  });

  it("supersedes old document on replacement", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });

    const firstId = uuid();
    const { error: e1 } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "evidence_report",
      p_storage_path: `packets/${packetId}/evidence_reports/${firstId}.pdf`,
      p_file_hash: "hash-v1", p_uploaded_by: notaryId, p_document_id: firstId,
    });
    expect(e1).toBeNull();

    const secondId = uuid();
    const { error: e2 } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "evidence_report",
      p_storage_path: `packets/${packetId}/evidence_reports/${secondId}.pdf`,
      p_file_hash: "hash-v2", p_uploaded_by: notaryId, p_document_id: secondId,
    });
    expect(e2).toBeNull();

    const { data: first } = await admin.from("packet_documents")
      .select("status").eq("id", firstId).single();
    expect(first?.status).toBe("superseded");

    const { data: second } = await admin.from("packet_documents")
      .select("status").eq("id", secondId).single();
    expect(second?.status).toBe("accepted");
  });

  it("concurrent replacements serialize via packet-level lock", async () => {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "under_review", workflowVersion: "physical_seal_v1",
    });

    const results = await Promise.all([
      admin.rpc("replace_packet_document", {
        p_packet_id: packetId, p_document_type: "evidence_report",
        p_storage_path: `packets/${packetId}/evidence_reports/${uuid()}.pdf`,
        p_file_hash: "hash-concurrent-a", p_uploaded_by: notaryId,
      }),
      admin.rpc("replace_packet_document", {
        p_packet_id: packetId, p_document_type: "evidence_report",
        p_storage_path: `packets/${packetId}/evidence_reports/${uuid()}.pdf`,
        p_file_hash: "hash-concurrent-b", p_uploaded_by: notaryId,
      }),
    ]);

    const successes = results.filter((r) => r.error === null);
    expect(successes.length).toBe(2);

    const { data: accepted } = await admin.from("packet_documents")
      .select("id").eq("packet_id", packetId)
      .eq("document_type", "evidence_report").eq("status", "accepted");
    expect(accepted).toHaveLength(1);
  });
});

// =========================================================================
// 5. prepare_notarized_certification
// =========================================================================

describe("prepare_notarized_certification", () => {
  async function setupPreparation() {
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", realtorId, {
      fileHash: `hash-signed-${packetId.slice(0, 8)}`,
    });
    const scanDoc = await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId,
      fileHash: `hash-scan-${packetId.slice(0, 8)}`,
      metadata: VALID_SCAN_METADATA,
    });
    const attestationId = await seedAttestation(
      admin, packetId, notaryId, scanDoc.docId, signedDoc.docId,
      `hash-scan-${packetId.slice(0, 8)}`, `hash-signed-${packetId.slice(0, 8)}`,
    );
    await seedChecklist(admin, packetId, notaryId, true);

    return { packetId, signedDoc, scanDoc, attestationId };
  }

  it("creates a prepared certification", async () => {
    const { packetId, scanDoc } = await setupPreparation();

    const { data, error } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    expect(error).toBeNull();
    const result = data as unknown as { newly_prepared: boolean; certification_id: string };
    expect(result.newly_prepared).toBe(true);
    expect(result.certification_id).toBeTruthy();
  });

  it("returns idempotent on identical inputs", async () => {
    const { packetId, scanDoc } = await setupPreparation();

    const { data: first } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    const certId1 = (first as unknown as { certification_id: string }).certification_id;

    const { data: second, error } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    expect(error).toBeNull();
    const result = second as unknown as { newly_prepared: boolean; certification_id: string };
    expect(result.newly_prepared).toBe(false);
    expect(result.certification_id).toBe(certId1);
  });

  it("voids stale cert when checklist snapshot changes", async () => {
    const { packetId, scanDoc } = await setupPreparation();

    const { data: first } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    const certId1 = (first as unknown as { certification_id: string }).certification_id;

    const newChecklist: Record<string, unknown> = {};
    for (const key of [
      "revisarDocumento", "revisarPdfFirmado", "revisarIdentidad",
      "revisarWhatsapp", "revisarConsentimiento", "revisarFirmaIofe",
      "revisarCadena", "revisarTimestamp", "revisarHashes",
      "revisarPropiedad", "revisarRegistro", "revisarSesion", "determinacion",
    ]) {
      newChecklist[key] = { checked: true, checkedAt: "2026-06-15T12:00:00Z", note: "changed" };
    }
    await admin.from("notary_review_checklists").update({ checklist_data: newChecklist })
      .eq("packet_id", packetId).eq("notary_id", notaryId);

    const { data: second, error } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    expect(error).toBeNull();
    const result = second as unknown as { newly_prepared: boolean; certification_id: string };
    expect(result.newly_prepared).toBe(true);
    expect(result.certification_id).not.toBe(certId1);

    const { data: old } = await admin.from("notary_certifications")
      .select("publication_status").eq("id", certId1).single();
    expect(old?.publication_status).toBe("void");
  });

  it("rejects cross-packet scan document", async () => {
    const { packetId: p1 } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });
    const { packetId: p2 } = await seedPacket(admin, tracker, {
      realtorId, notaryId, status: "awaiting_notary_seal", workflowVersion: "physical_seal_v1",
    });
    await seedChecklist(admin, p1, notaryId, true);

    const signedDoc2 = await seedDocument(admin, p2, "signed_pdf", realtorId);
    const scanDoc2 = await seedDocument(admin, p2, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc2.docId, metadata: VALID_SCAN_METADATA,
    });

    const { error } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: p1, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc2.docId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("does not belong to this packet");
  });

  it("rejects non-assigned notary", async () => {
    const { packetId, scanDoc } = await setupPreparation();

    const { error } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: otherNotaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not assigned");
  });
});

// =========================================================================
// 6. finalize_notarized_certification
// =========================================================================

describe("finalize_notarized_certification", () => {
  async function setupFinalization() {
    const signerId = await createTestUser(admin, tracker, "realtor");
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, signerId, status: "awaiting_notary_seal",
      workflowVersion: "physical_seal_v1",
    });

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", realtorId, {
      fileHash: `hash-signed-fin-${packetId.slice(0, 8)}`,
    });
    const scanDoc = await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId,
      fileHash: `hash-scan-fin-${packetId.slice(0, 8)}`,
      metadata: VALID_SCAN_METADATA,
    });
    await seedAttestation(
      admin, packetId, notaryId, scanDoc.docId, signedDoc.docId,
      `hash-scan-fin-${packetId.slice(0, 8)}`, `hash-signed-fin-${packetId.slice(0, 8)}`,
    );
    await seedChecklist(admin, packetId, notaryId, true);

    const { data: prepResult, error: prepErr } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    expect(prepErr).toBeNull();
    const certId = (prepResult as unknown as { certification_id: string }).certification_id;

    const reportDocId = uuid();
    const { error: repErr } = await admin.rpc("replace_packet_document", {
      p_packet_id: packetId, p_document_type: "certification_report",
      p_storage_path: `packets/${packetId}/reports/${reportDocId}.pdf`,
      p_file_hash: `hash-report-fin-${packetId.slice(0, 8)}`,
      p_uploaded_by: notaryId, p_source_document_id: scanDoc.docId,
      p_certification_id: certId, p_document_id: reportDocId,
    });
    expect(repErr).toBeNull();

    return { packetId, certId, signedDoc, scanDoc, reportDocId };
  }

  it("finalizes and transitions to certified", async () => {
    const { packetId, certId } = await setupFinalization();

    const { data, error } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: certId,
    });
    expect(error).toBeNull();
    const result = data as unknown as {
      newly_finalized: boolean; registry_entry_id: string;
    };
    expect(result.newly_finalized).toBe(true);
    expect(result.registry_entry_id).toBeTruthy();

    const { data: packet } = await admin.from("lease_packets")
      .select("status").eq("id", packetId).single();
    expect(packet?.status).toBe("certified");
  });

  it("idempotent with correct certification succeeds", async () => {
    const { packetId, certId } = await setupFinalization();

    const { error: e1 } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: certId,
    });
    expect(e1).toBeNull();

    const { data, error: e2 } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: certId,
    });
    expect(e2).toBeNull();
    const result = data as unknown as { newly_finalized: boolean };
    expect(result.newly_finalized).toBe(false);
  });

  it("idempotent path rejects wrong certification ID", async () => {
    const { packetId, certId } = await setupFinalization();

    await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: certId,
    });

    const { error } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: uuid(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not the published certification");
  });

  it("idempotent path rejects inactive notary", async () => {
    const suspId = await createTestUser(admin, tracker, "notary", "suspended");

    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId: suspId, status: "certified", workflowVersion: "physical_seal_v1",
    });

    const { error } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: suspId, p_certification_id: uuid(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not active");
  });

  it("rejects non-assigned notary", async () => {
    const { packetId, certId } = await setupFinalization();

    const { error } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: otherNotaryId, p_certification_id: certId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("not assigned");
  });

  it("rejects report with mismatched certification_id", async () => {
    const signerId = await createTestUser(admin, tracker, "realtor");
    const { packetId } = await seedPacket(admin, tracker, {
      realtorId, notaryId, signerId, status: "awaiting_notary_seal",
      workflowVersion: "physical_seal_v1",
    });

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", realtorId, {
      fileHash: "hash-signed-mm",
    });
    const scanDoc = await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId, fileHash: "hash-scan-mm",
      metadata: VALID_SCAN_METADATA,
    });
    await seedAttestation(
      admin, packetId, notaryId, scanDoc.docId, signedDoc.docId,
      "hash-scan-mm", "hash-signed-mm",
    );
    await seedChecklist(admin, packetId, notaryId, true);

    const { data: prepResult } = await admin.rpc("prepare_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId,
      p_notarial_scan_document_id: scanDoc.docId,
    });
    const certId = (prepResult as unknown as { certification_id: string }).certification_id;

    const reportDocId = uuid();
    const wrongCertId = uuid();
    const { error: wrongCertError } = await admin.from("notary_certifications").insert({
      id: wrongCertId, packet_id: packetId, notary_id: notaryId,
      certification_type: "certified", publication_status: "void",
    });
    expect(wrongCertError).toBeNull();

    const { error: reportError } = await admin.from("packet_documents").insert({
      id: reportDocId, packet_id: packetId, document_type: "certification_report",
      storage_path: `packets/${packetId}/reports/${reportDocId}.pdf`,
      file_hash: "hash-report-bad", uploaded_by: notaryId, status: "accepted",
      version: 1, source_document_id: scanDoc.docId, certification_id: wrongCertId,
    });
    expect(reportError).toBeNull();

    const { error: linkError } = await admin.from("notary_certifications").update({
      certification_report_document_id: reportDocId,
    }).eq("id", certId);
    expect(linkError).toBeNull();

    const { error } = await admin.rpc("finalize_notarized_certification", {
      p_packet_id: packetId, p_notary_id: notaryId, p_certification_id: certId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("certification_id must match");
  });
});

// =========================================================================
// 7. claim_notification_outbox
// =========================================================================

describe("claim_notification_outbox", () => {
  it("claims pending rows and returns claim_token", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "certified" });

    await admin.from("notification_outbox").insert({
      packet_id: packetId, event_type: "packet_certified_realtor",
      recipient_key: `realtor:${uuid()}`, status: "pending",
      payload: { role: "realtor", user_id: realtorId },
      available_at: new Date(Date.now() - 60000).toISOString(),
    });

    const { data, error } = await admin.rpc("claim_notification_outbox", { p_limit: 100 });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const rows = data as unknown as Array<{ id: string; claim_token: string; packet_id: string }>;
    const ours = rows.find((r) => r.packet_id === packetId);
    expect(ours).toBeTruthy();
    expect(ours!.claim_token).toBeTruthy();
  });

  it("skips stale processing rows at max attempts", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "certified" });

    const outboxId = uuid();
    await admin.from("notification_outbox").insert({
      id: outboxId, packet_id: packetId, event_type: "packet_certified_realtor",
      recipient_key: `realtor:${uuid()}-stale`, status: "processing",
      payload: { role: "realtor", user_id: realtorId },
      attempt_count: 5,
      processing_started_at: new Date(Date.now() - 600000).toISOString(),
      available_at: new Date(Date.now() - 600000).toISOString(),
    });

    const { data, error } = await admin.rpc("claim_notification_outbox", { p_limit: 100 });
    expect(error).toBeNull();
    const rows = (data as unknown as Array<{ id: string }>) ?? [];
    expect(rows.find((r) => r.id === outboxId)).toBeUndefined();
  });

  it("reclaims stale processing rows below max attempts", async () => {
    const { packetId } = await seedPacket(admin, tracker, { realtorId, notaryId, status: "certified" });

    const outboxId = uuid();
    await admin.from("notification_outbox").insert({
      id: outboxId, packet_id: packetId, event_type: "packet_certified_realtor",
      recipient_key: `realtor:${uuid()}-recover`, status: "processing",
      payload: { role: "realtor", user_id: realtorId },
      attempt_count: 2,
      processing_started_at: new Date(Date.now() - 600000).toISOString(),
      available_at: new Date(Date.now() - 600000).toISOString(),
    });

    const { data, error } = await admin.rpc("claim_notification_outbox", { p_limit: 100 });
    expect(error).toBeNull();
    const rows = (data as unknown as Array<{ id: string }>) ?? [];
    expect(rows.find((r) => r.id === outboxId)).toBeTruthy();
  });
});

// =========================================================================
// 8. RLS pre-publication denial for participants
// =========================================================================

describe("RLS pre-publication denial", () => {
  let realtorClient: SupabaseClient;
  let testPacketId: string;

  beforeAll(async () => {
    const { client, userId } = await createAuthenticatedClient(admin, tracker, "realtor");
    realtorClient = client;

    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: userId, notaryId, status: "awaiting_notary_seal",
      workflowVersion: "physical_seal_v1",
    });
    testPacketId = packetId;

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", userId);
    await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId, metadata: VALID_SCAN_METADATA,
    });
    await seedDocument(admin, packetId, "certification_report", notaryId, {
      sourceDocumentId: signedDoc.docId,
    });

    const scanId = (await admin.from("packet_documents").select("id")
      .eq("packet_id", packetId).eq("document_type", "notarial_scan").single()).data!.id;
    const attestId = await seedAttestation(
      admin, packetId, notaryId, scanId, signedDoc.docId,
      `hash-${scanId.slice(0, 8)}`, `hash-${signedDoc.docId.slice(0, 8)}`,
    );
    await seedCertification(admin, packetId, notaryId, scanId, attestId, {
      publicationStatus: "prepared",
    });
  });

  it("realtor cannot see notarial_scan before publication", async () => {
    const { data: docs, error } = await realtorClient.from("packet_documents")
      .select("id, document_type").eq("packet_id", testPacketId).eq("document_type", "notarial_scan");
    expect(error).toBeNull();
    expect(docs).toHaveLength(0);
  });

  it("realtor cannot see certification_report before publication", async () => {
    const { data: docs, error } = await realtorClient.from("packet_documents")
      .select("id, document_type").eq("packet_id", testPacketId).eq("document_type", "certification_report");
    expect(error).toBeNull();
    expect(docs).toHaveLength(0);
  });

  it("realtor CAN see signed_pdf", async () => {
    const { data: docs, error } = await realtorClient.from("packet_documents")
      .select("id, document_type").eq("packet_id", testPacketId).eq("document_type", "signed_pdf");
    expect(error).toBeNull();
    expect(docs!.length).toBeGreaterThan(0);
  });

  it("realtor cannot see unpublished certifications", async () => {
    const { data: certs, error } = await realtorClient.from("notary_certifications")
      .select("id").eq("packet_id", testPacketId);
    expect(error).toBeNull();
    expect(certs).toHaveLength(0);
  });
});

// =========================================================================
// 9. Exact-ID download authorization (via RLS + document existence)
// =========================================================================

describe("exact-ID download authorization via RLS", () => {
  let realtorClient: SupabaseClient;
  let certifiedPacketId: string;
  let scanDocId: string;
  let signedPdfId: string;

  beforeAll(async () => {
    const { client, userId } = await createAuthenticatedClient(admin, tracker, "realtor");
    realtorClient = client;

    const { packetId } = await seedPacket(admin, tracker, {
      realtorId: userId, notaryId, status: "certified",
      workflowVersion: "physical_seal_v1",
    });
    certifiedPacketId = packetId;

    const signedDoc = await seedDocument(admin, packetId, "signed_pdf", userId);
    signedPdfId = signedDoc.docId;

    const scanDoc = await seedDocument(admin, packetId, "notarial_scan", notaryId, {
      sourceDocumentId: signedDoc.docId, metadata: VALID_SCAN_METADATA,
    });
    scanDocId = scanDoc.docId;

    const attestId = await seedAttestation(
      admin, packetId, notaryId, scanDoc.docId, signedDoc.docId,
      `hash-${scanDoc.docId.slice(0, 8)}`, `hash-${signedDoc.docId.slice(0, 8)}`,
    );
    await seedCertification(admin, packetId, notaryId, scanDoc.docId, attestId, {
      publicationStatus: "published",
    });
  });

  it("realtor can fetch signed_pdf by exact ID", async () => {
    const { data, error } = await realtorClient.from("packet_documents")
      .select("id").eq("id", signedPdfId).eq("packet_id", certifiedPacketId).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(signedPdfId);
  });

  it("realtor can fetch published notarial_scan by exact ID", async () => {
    const { data, error } = await realtorClient.from("packet_documents")
      .select("id").eq("id", scanDocId).eq("packet_id", certifiedPacketId).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(scanDocId);
  });

  it("realtor cannot fetch document from another packet by ID", async () => {
    const otherRealtor = await createTestUser(admin, tracker, "realtor");
    const { packetId: otherPkt } = await seedPacket(admin, tracker, {
      realtorId: otherRealtor, notaryId, status: "certified",
    });
    const otherDoc = await seedDocument(admin, otherPkt, "signed_pdf", notaryId);

    const { data } = await realtorClient.from("packet_documents")
      .select("id").eq("id", otherDoc.docId).eq("packet_id", otherPkt).maybeSingle();
    expect(data).toBeNull();
  });
});
