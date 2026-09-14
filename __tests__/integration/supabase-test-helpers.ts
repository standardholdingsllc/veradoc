/**
 * Helpers for integration tests that run against a local Supabase instance.
 *
 * Prerequisites:
 *   1. `npx supabase start` (Docker must be running)
 *   2. All migrations applied (automatic with `supabase start`)
 *
 * Every seed function throws on Supabase errors so that test setup failures
 * are never silently ignored.
 *
 * All test identities are created through auth.admin.createUser to satisfy
 * the profiles.id → auth.users(id) FK constraint.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function uuid(): string {
  return crypto.randomUUID();
}

function throwOnError<T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

// =========================================================================
// Identity management
// =========================================================================

/**
 * Creates an auth.users row and a profiles row in one call.
 * Returns the user ID. Tracks the user for cleanup.
 */
export async function createTestUser(
  admin: SupabaseClient,
  tracker: TestCleanupTracker,
  role: "realtor" | "notary" | "admin",
  status: "active" | "suspended" = "active",
): Promise<string> {
  const id = uuid();
  const email = `test-${role}-${id.slice(0, 8)}@integration.test`;
  const password = "TestPassword123!";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser auth: ${error.message}`);

  const userId = data.user.id;
  tracker.authUserIds.push(userId);

  throwOnError(
    await admin.from("profiles").upsert({
      id: userId,
      role,
      status,
      full_name: `Test ${role} ${userId.slice(0, 8)}`,
      email,
      accreditation_number: role === "notary" ? "NOT-123" : null,
    }),
    `createTestUser profile(${userId})`,
  );

  return userId;
}

/**
 * Creates an auth user and returns a signed-in Supabase client + userId.
 */
export async function createAuthenticatedClient(
  admin: SupabaseClient,
  tracker: TestCleanupTracker,
  role: "realtor" | "notary" | "admin",
): Promise<{ client: SupabaseClient; userId: string }> {
  const id = uuid();
  const email = `test-auth-${id.slice(0, 8)}@integration.test`;
  const password = "TestPassword123!";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createAuthenticatedClient: ${error.message}`);

  const userId = data.user.id;
  tracker.authUserIds.push(userId);

  throwOnError(
    await admin.from("profiles").upsert({
      id: userId,
      role,
      status: "active",
      full_name: `Test auth ${role} ${userId.slice(0, 8)}`,
      email,
      accreditation_number: role === "notary" ? "NOT-123" : null,
    }),
    `createAuthenticatedClient profile(${userId})`,
  );

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError)
    throw new Error(`Failed to sign in: ${signInError.message}`);

  return { client, userId };
}

// =========================================================================
// Cleanup tracker
// =========================================================================

export interface TestCleanupTracker {
  packetIds: string[];
  authUserIds: string[];
}

export function createTracker(): TestCleanupTracker {
  return { packetIds: [], authUserIds: [] };
}

/**
 * Removes all test data, profiles, and auth users.
 */
export async function cleanupAll(
  admin: SupabaseClient,
  tracker: TestCleanupTracker,
) {
  for (const pid of tracker.packetIds) {
    await admin.from("notary_workflow_jobs").delete().eq("packet_id", pid);
    await admin.from("property_authority_checks").delete().eq("packet_id", pid);
    await admin.from("notification_outbox").delete().eq("packet_id", pid);
    await admin.from("registry_entries").delete().eq("packet_id", pid);
    await admin.from("packet_audit_log").delete().eq("packet_id", pid);
    await admin.from("notary_certifications").delete().eq("packet_id", pid);
    await admin.from("notary_attestations").delete().eq("packet_id", pid);
    await admin.from("packet_documents").delete().eq("packet_id", pid);
    await admin.from("notary_review_checklists").delete().eq("packet_id", pid);
    await admin.from("packet_signers").delete().eq("packet_id", pid);
    await admin.from("notary_assignments").delete().eq("packet_id", pid);
    await admin.from("lease_packets").delete().eq("id", pid);
  }

  for (const uid of tracker.authUserIds) {
    await admin.from("notary_monthly_payouts").delete().eq("notary_id", uid);
    await admin.from("notary_payout_rates").delete().eq("notary_id", uid);
    await admin.from("notary_workflow_settings").delete().eq("notary_id", uid);
    await admin.from("profiles").delete().eq("id", uid);
    await admin.auth.admin.deleteUser(uid);
  }
}

// =========================================================================
// Data seed helpers
// =========================================================================

export async function seedPacket(
  admin: SupabaseClient,
  tracker: TestCleanupTracker,
  opts: {
    realtorId: string;
    notaryId: string;
    signerId?: string;
    status?: string;
    workflowVersion?: string;
  },
) {
  const packetId = uuid();
  const packetCode = `TEST-${packetId.slice(0, 8)}`;

  throwOnError(
    await admin.from("lease_packets").insert({
      id: packetId,
      created_by: opts.realtorId,
      packet_code: packetCode,
      status: opts.status ?? "pending_notary",
      property_address: "Av. Test 123",
      district: "Miraflores",
      province: "Lima",
      rental_amount: 1500,
      deposit_amount: 3000,
      lease_start_date: "2026-01-01",
      lease_end_date: "2027-01-01",
      notary_workflow_version: opts.workflowVersion ?? "legacy_v1",
    }),
    `seedPacket(${packetId})`,
  );

  throwOnError(
    await admin.from("notary_assignments").insert({
      packet_id: packetId,
      notary_id: opts.notaryId,
    }),
    `seedPacket assignment(${packetId})`,
  );

  if (opts.signerId) {
    throwOnError(
      await admin.from("packet_signers").insert({
        packet_id: packetId,
        signer_full_name: "Test Signer",
        signer_email: `signer-${uuid().slice(0, 8)}@test.com`,
        signer_whatsapp: "+51999999999",
        signer_dni: "12345678",
        role_in_lease: "landlord",
        status: "complete",
      }),
      `seedPacket signer(${packetId})`,
    );
  }

  tracker.packetIds.push(packetId);
  return { packetId, packetCode };
}

export async function seedNotaryWorkflowSettings(
  admin: SupabaseClient,
  notaryId: string,
  enabled: boolean = true,
) {
  throwOnError(
    await admin.from("notary_workflow_settings").upsert({
      notary_id: notaryId,
      physical_seal_v1_enabled: enabled,
    }),
    `seedNotaryWorkflowSettings(${notaryId})`,
  );
}

export async function seedDocument(
  admin: SupabaseClient,
  packetId: string,
  documentType: string,
  uploadedBy: string,
  opts: {
    status?: string;
    fileHash?: string;
    sourceDocumentId?: string | null;
    certificationId?: string | null;
    pageCount?: number;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const docId = uuid();
  const storagePath = `packets/${packetId}/${documentType}/${docId}.pdf`;

  const { data: maxRows } = await admin
    .from("packet_documents")
    .select("version")
    .eq("packet_id", packetId)
    .eq("document_type", documentType)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = (maxRows && maxRows.length > 0 ? maxRows[0].version : 0) + 1;

  throwOnError(
    await admin.from("packet_documents").insert({
      id: docId,
      packet_id: packetId,
      document_type: documentType,
      storage_path: storagePath,
      file_hash: opts.fileHash ?? `hash-${docId.slice(0, 8)}`,
      uploaded_by: uploadedBy,
      status: opts.status ?? "accepted",
      version: nextVersion,
      source_document_id: opts.sourceDocumentId ?? null,
      certification_id: opts.certificationId ?? null,
      page_count: opts.pageCount ?? 10,
      metadata: opts.metadata ?? {},
    }),
    `seedDocument(${packetId}, ${documentType})`,
  );

  return { docId, storagePath };
}

export async function seedChecklist(
  admin: SupabaseClient,
  packetId: string,
  notaryId: string,
  allChecked: boolean = true,
) {
  const checklistData: Record<string, unknown> = {};
  const keys = [
    "revisarDocumento", "revisarPdfFirmado", "revisarIdentidad",
    "revisarWhatsapp", "revisarConsentimiento", "revisarFirmaIofe",
    "revisarCadena", "revisarTimestamp", "revisarHashes",
    "revisarPropiedad", "revisarRegistro", "revisarSesion",
    "determinacion",
  ];
  for (const key of keys) {
    checklistData[key] = { checked: allChecked, checkedAt: "2026-01-01T00:00:00Z" };
  }

  throwOnError(
    await admin.from("notary_review_checklists").upsert({
      packet_id: packetId,
      notary_id: notaryId,
      checklist_data: checklistData,
      checklist_version: 1,
    }),
    `seedChecklist(${packetId})`,
  );

  return checklistData;
}

export async function seedAttestation(
  admin: SupabaseClient,
  packetId: string,
  notaryId: string,
  scanDocId: string,
  sourceDocId: string,
  scanHash: string,
  sourceHash: string,
) {
  const id = uuid();
  const attestationText = "Declaración notarial de prueba";
  throwOnError(
    await admin.from("notary_attestations").insert({
      id,
      packet_id: packetId,
      notary_id: notaryId,
      notarial_scan_document_id: scanDocId,
      source_signed_document_id: sourceDocId,
      notarial_scan_hash: scanHash,
      source_document_hash: sourceHash,
      attestation_text_version: "v1.0",
      attestation_text: attestationText,
      attestation_text_hash: crypto
        .createHash("sha256")
        .update(attestationText)
        .digest("hex"),
      attested_at: new Date().toISOString(),
      ip_address: "127.0.0.1",
    }),
    `seedAttestation(${packetId})`,
  );
  return id;
}

export async function seedCertification(
  admin: SupabaseClient,
  packetId: string,
  notaryId: string,
  scanDocId: string,
  attestationId: string,
  opts: {
    publicationStatus?: string;
    reportDocId?: string | null;
  } = {},
) {
  const id = uuid();
  throwOnError(
    await admin.from("notary_certifications").insert({
      id,
      packet_id: packetId,
      notary_id: notaryId,
      certification_type: "certified",
      publication_status: opts.publicationStatus ?? "prepared",
      notarial_scan_document_id: scanDocId,
      attestation_id: attestationId,
      checklist_data: {},
      checklist_version: 1,
      certification_report_document_id: opts.reportDocId ?? null,
    }),
    `seedCertification(${packetId})`,
  );
  return id;
}
