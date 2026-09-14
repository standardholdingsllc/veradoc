import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { generateAndStoreCertifiedDocument } from "@/lib/pdf/generate-certified-document";
import { getDocumentHashTimeline } from "@/lib/utils/document-hash";
import type { CertifiedDocumentData } from "@/lib/pdf/types";

const MAX_ATTEMPTS = 5;

type ClaimedJob = {
  id: string;
  packet_id: string;
  certification_id: string | null;
  job_type: string;
  payload: Json;
  attempt_count: number;
  claim_token: string;
};

function retryDelayMs(attemptCount: number): number {
  return Math.min(5_000 * Math.pow(2, Math.max(0, attemptCount - 1)), 30 * 60_000);
}

export async function processNotaryWorkflowJobBatch(
  admin: SupabaseClient<Database>,
  batchSize = 5,
): Promise<{ completed: number; failed: number }> {
  const { data, error } = await admin.rpc("claim_notary_workflow_jobs", {
    p_limit: batchSize,
  });

  if (error) {
    throw new Error(`Unable to claim notary workflow jobs: ${error.message}`);
  }

  const jobs = (data ?? []) as ClaimedJob[];
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await dispatchJob(admin, job);
      completed += 1;
    } catch (errorCaught) {
      const message = errorCaught instanceof Error
        ? errorCaught.message
        : String(errorCaught);
      const terminal = job.attempt_count >= MAX_ATTEMPTS;

      const { error: updateError } = await admin
        .from("notary_workflow_jobs")
        .update({
          status: terminal ? "failed" : "pending",
          last_error: message.slice(0, 1000),
          available_at: new Date(
            Date.now() + retryDelayMs(job.attempt_count),
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("claim_token", job.claim_token);

      if (updateError) {
        throw new Error(
          `Notary job failed (${message}) and could not be released: ${updateError.message}`,
        );
      }
      failed += 1;
    }
  }

  return { completed, failed };
}

async function dispatchJob(
  admin: SupabaseClient<Database>,
  job: ClaimedJob,
): Promise<void> {
  if (job.job_type === "generate_legacy_certificate") {
    await generateLegacyCertificate(admin, job);
    return;
  }

  if (job.job_type === "create_registry_entry") {
    if (!job.certification_id) {
      throw new Error("Registry job has no certification_id");
    }
    const { error } = await admin.rpc("finalize_legacy_certification_job", {
      p_job_id: job.id,
      p_claim_token: job.claim_token,
      p_certification_id: job.certification_id,
    });
    if (error) {
      throw new Error(`Unable to finalize legacy certification: ${error.message}`);
    }
    return;
  }

  if (job.job_type === "prepare_physical_certificate") {
    await preparePhysicalCertificate(admin, job);
    return;
  }

  if (job.job_type === "finalize_physical_certification") {
    await finalizePhysicalCertification(admin, job);
    return;
  }

  throw new Error(`Unsupported notary workflow job: ${job.job_type}`);
}

function jobPayload(job: ClaimedJob): Record<string, Json | undefined> {
  if (!job.payload || Array.isArray(job.payload) || typeof job.payload !== "object") {
    throw new Error(`Invalid payload for notary job ${job.id}`);
  }
  return job.payload as Record<string, Json | undefined>;
}

async function completeClaimedJob(
  admin: SupabaseClient<Database>,
  job: ClaimedJob,
  result: Record<string, Json | undefined>,
): Promise<void> {
  const { data: completedRows, error } = await admin
    .from("notary_workflow_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("claim_token", job.claim_token)
    .select("id");

  if (error || !completedRows?.length) {
    throw new Error(error?.message ?? "Notary job claim became stale before completion");
  }
}

async function preparePhysicalCertificate(
  admin: SupabaseClient<Database>,
  job: ClaimedJob,
): Promise<void> {
  const payload = jobPayload(job);
  const actorId = payload.actor_id;
  const scanDocumentId = payload.notarial_scan_document_id;
  if (typeof actorId !== "string" || typeof scanDocumentId !== "string") {
    throw new Error(`Physical preparation job ${job.id} is missing its actor or scan`);
  }

  const { data, error } = await admin.rpc("prepare_notarized_certification", {
    p_packet_id: job.packet_id,
    p_notary_id: actorId,
    p_notarial_scan_document_id: scanDocumentId,
    p_observations: typeof payload.observations === "string"
      ? payload.observations
      : undefined,
  });
  if (error) {
    throw new Error(`Unable to prepare physical certification: ${error.message}`);
  }

  const prepared = data as {
    certification_id?: string;
    newly_prepared?: boolean;
  };
  if (!prepared.certification_id) {
    throw new Error(`Physical preparation job ${job.id} returned no certification`);
  }

  const { generateAndStoreCertificationReport } = await import(
    "@/lib/pdf/generate-certification-report"
  );
  const report = await generateAndStoreCertificationReport(
    job.packet_id,
    prepared.certification_id,
    actorId,
    admin,
  );

  await completeClaimedJob(admin, job, {
    certification_id: prepared.certification_id,
    newly_prepared: Boolean(prepared.newly_prepared),
    report_document_id: report.documentId,
    storage_path: report.storagePath,
    file_hash: report.fileHash,
  });
}

async function finalizePhysicalCertification(
  admin: SupabaseClient<Database>,
  job: ClaimedJob,
): Promise<void> {
  if (!job.certification_id) {
    throw new Error(`Physical finalization job ${job.id} has no certification`);
  }
  const actorId = jobPayload(job).actor_id;
  if (typeof actorId !== "string") {
    throw new Error(`Physical finalization job ${job.id} has no actor`);
  }

  const { data, error } = await admin.rpc("finalize_notarized_certification", {
    p_packet_id: job.packet_id,
    p_notary_id: actorId,
    p_certification_id: job.certification_id,
  });
  if (error) {
    throw new Error(`Unable to finalize physical certification: ${error.message}`);
  }

  const finalized = data as {
    newly_finalized?: boolean;
    certification_id?: string;
    registry_entry_id?: string;
  };
  await completeClaimedJob(admin, job, {
    certification_id: finalized.certification_id ?? job.certification_id,
    registry_entry_id: finalized.registry_entry_id ?? null,
    newly_finalized: Boolean(finalized.newly_finalized),
  });
}

async function generateLegacyCertificate(
  admin: SupabaseClient<Database>,
  job: ClaimedJob,
): Promise<void> {
  if (!job.certification_id) {
    throw new Error("Certificate job has no certification_id");
  }

  const [{ data: certification }, { data: packet }, { data: signers }] =
    await Promise.all([
      admin
        .from("notary_certifications")
        .select(
          "id, packet_id, notary_id, certification_type, observations, checklist_data, prepared_at, publication_status",
        )
        .eq("id", job.certification_id)
        .single(),
      admin
        .from("lease_packets")
        .select(
          "id, packet_code, property_address, property_unit, district, province, lease_start_date, lease_end_date",
        )
        .eq("id", job.packet_id)
        .single(),
      admin
        .from("packet_signers")
        .select("signer_full_name, role_in_lease")
        .eq("packet_id", job.packet_id),
    ]);

  if (!certification || certification.packet_id !== job.packet_id) {
    throw new Error(`Certification not found for job ${job.id}`);
  }
  if (!packet) {
    throw new Error(`Packet not found for job ${job.id}`);
  }

  const { data: notaryProfile } = await admin
    .from("profiles")
    .select("full_name, accreditation_number")
    .eq("id", certification.notary_id)
    .single();

  const checklistSummary: Record<string, boolean> = {};
  const checklist = (certification.checklist_data ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(checklist)) {
    const item = value as { checked?: boolean } | boolean;
    checklistSummary[key] = typeof item === "object" && item !== null
      ? Boolean(item.checked)
      : Boolean(item);
  }

  const documentHashes = await getDocumentHashTimeline(job.packet_id, admin);
  const certificationData: CertifiedDocumentData = {
    packetCode: packet.packet_code ?? job.packet_id.slice(0, 12),
    packetId: job.packet_id,
    notaryName: notaryProfile?.full_name ?? "Notario",
    accreditationNumber: notaryProfile?.accreditation_number ?? null,
    certifiedAt: certification.prepared_at ?? new Date().toISOString(),
    certificationType: certification.certification_type as
      | "certified"
      | "certified_with_observations",
    observations: certification.observations ?? undefined,
    checklistSummary,
    documentHashes: documentHashes.map((hash) => ({
      stage: hash.stage,
      algorithm: hash.algorithm,
      hash: hash.hash,
      timestamp: hash.timestamp,
      actorId: hash.actorId,
    })),
    propertyAddress: packet.property_address ?? "",
    propertyUnit: packet.property_unit ?? undefined,
    district: packet.district ?? undefined,
    province: packet.province ?? undefined,
    landlordNames: (signers ?? [])
      .filter((signer) => signer.role_in_lease === "landlord")
      .map((signer) => signer.signer_full_name ?? ""),
    renterNames: (signers ?? [])
      .filter((signer) => signer.role_in_lease === "renter")
      .map((signer) => signer.signer_full_name ?? ""),
    leaseStartDate: packet.lease_start_date ?? undefined,
    leaseEndDate: packet.lease_end_date ?? undefined,
  };

  const document = await generateAndStoreCertifiedDocument(
    job.packet_id,
    certificationData,
    certification.notary_id,
  );

  const { error: nextJobError } = await admin
    .from("notary_workflow_jobs")
    .insert({
      packet_id: job.packet_id,
      certification_id: job.certification_id,
      job_type: "create_registry_entry",
      idempotency_key: `legacy-registry:${job.certification_id}`,
      payload: { certificate_document_id: document.documentId },
    });

  if (nextJobError && nextJobError.code !== "23505") {
    throw new Error(`Unable to enqueue registry job: ${nextJobError.message}`);
  }

  await completeClaimedJob(admin, job, {
    document_id: document.documentId,
    storage_path: document.storagePath,
    file_hash: document.fileHash,
  });
}
