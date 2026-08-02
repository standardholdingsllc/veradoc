"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SupabasePacketAdapter,
  SupabaseNotaryAdapter,
} from "@/lib/adapters/supabase-adapter";
import { getDocumentHashTimeline } from "@/lib/utils/document-hash";
import { generateAndStoreCertifiedDocument } from "@/lib/pdf/generate-certified-document";
import type { CertifiedDocumentData } from "@/lib/pdf/types";
import type { Json } from "@/lib/supabase/database.types";
import { requireApproved } from "@/lib/auth/guards";
import {
  notifyPacketCertified,
  notifyPacketNeedsCorrection,
  notifyPacketRejected,
} from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyAssignment(packetId: string, notaryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notary_assignments")
    .select("*")
    .eq("packet_id", packetId)
    .eq("notary_id", notaryId)
    .single();
  if (!data) throw new Error("Not assigned to this packet");
  return data;
}

// ---------------------------------------------------------------------------
// 10.2 — Queue data
// ---------------------------------------------------------------------------

export interface NotaryQueueItem {
  assignmentId: string;
  assignedAt: string;
  reviewStartedAt: string | null;
  decision: string | null;
  decidedAt: string | null;
  observations: string | null;
  packetId: string;
  packetCode: string;
  status: string;
  propertyAddress: string;
  propertyUnit: string | null;
  district: string | null;
  province: string | null;
  submittedAt: string | null;
  realtorName: string;
  realtorEmail: string;
  signerCount: number;
  registryAlert: boolean;
}

export async function getNotaryQueue(
  notaryId: string,
): Promise<NotaryQueueItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notary_assignments")
    .select(
      `
      id, assigned_at, review_started_at, decision, decided_at, observations,
      lease_packets!inner (
        id, packet_code, status, property_address, property_unit, district, province,
        submitted_to_notary_at,
        created_by,
        profiles!lease_packets_created_by_fkey ( full_name, email ),
        packet_signers ( id )
      )
    `,
    )
    .eq("notary_id", notaryId)
    .order("assigned_at", { ascending: false });

  if (error) throw new Error(`Queue fetch failed: ${error.message}`);
  if (!data) return [];

  const admin = createAdminClient();

  const addressSet = new Map<
    string,
    { unit: string | null; start: string | null; end: string | null }
  >();
  for (const row of data) {
    const lp = row.lease_packets as Record<string, unknown>;
    const addr = (lp.property_address as string) ?? "";
    if (!addressSet.has(addr)) {
      addressSet.set(addr, {
        unit: lp.property_unit as string | null,
        start: null,
        end: null,
      });
    }
  }

  const duplicateMap = new Map<string, boolean>();
  for (const [addr, info] of addressSet.entries()) {
    const { data: dup } = await admin.rpc("check_duplicate_lease", {
      p_property_address: addr,
      p_property_unit: info.unit,
      p_lease_start: info.start ?? "1970-01-01",
      p_lease_end: info.end ?? "2099-12-31",
    });
    const overlap = Array.isArray(dup) ? dup[0] : dup;
    duplicateMap.set(addr, (overlap?.overlap_count ?? 0) > 0);
  }

  return data.map((row) => {
    const lp = row.lease_packets as Record<string, unknown>;
    const realtorProfile = (lp.profiles as Record<string, unknown>) ?? {};
    const signers = (lp.packet_signers as unknown[]) ?? [];
    return {
      assignmentId: row.id,
      assignedAt: row.assigned_at!,
      reviewStartedAt: row.review_started_at,
      decision: row.decision,
      decidedAt: row.decided_at,
      observations: row.observations,
      packetId: lp.id as string,
      packetCode: (lp.packet_code as string) ?? "",
      status: lp.status as string,
      propertyAddress: (lp.property_address as string) ?? "",
      propertyUnit: lp.property_unit as string | null,
      district: lp.district as string | null,
      province: lp.province as string | null,
      submittedAt: lp.submitted_to_notary_at as string | null,
      realtorName: (realtorProfile.full_name as string) ?? "",
      realtorEmail: (realtorProfile.email as string) ?? "",
      signerCount: signers.length,
      registryAlert: duplicateMap.get((lp.property_address as string) ?? "") ?? false,
    };
  });
}

// ---------------------------------------------------------------------------
// 10.3 — Evidence review data
// ---------------------------------------------------------------------------

export interface PacketEvidenceData {
  packet: {
    id: string;
    packetCode: string;
    status: string;
    propertyAddress: string;
    propertyUnit: string | null;
    district: string | null;
    province: string | null;
    department: string | null;
    rentalAmount: number | null;
    depositAmount: number | null;
    leaseStartDate: string | null;
    leaseEndDate: string | null;
    documentHash: string | null;
    submittedAt: string | null;
    certifiedAt: string | null;
    createdAt: string;
  };
  assignment: {
    decision: string | null;
    observations: string | null;
    reviewStartedAt: string | null;
    decidedAt: string | null;
  };
  documents: {
    id: string;
    documentType: string;
    storagePath: string;
    fileHash: string | null;
    signedUrl: string | null;
    createdAt: string | null;
  }[];
  signers: {
    id: string;
    fullName: string;
    email: string;
    dni: string | null;
    roleInLease: string;
    status: string;
    evidence: {
      id: string;
      evidenceType: string;
      storagePath: string | null;
      metadata: Record<string, unknown>;
      signedUrl: string | null;
      createdAt: string | null;
    }[];
    signatureRecord: {
      providerName: string | null;
      certificateSubject: string | null;
      certificateIssuer: string | null;
      certificateSerial: string | null;
      certificateValidFrom: string | null;
      certificateValidTo: string | null;
      chainValidationResult: string | null;
      revocationResult: string | null;
      timestampResult: string | null;
      signatureValid: boolean | null;
      pdfIntegrityValid: boolean | null;
      signedDocumentHash: string | null;
      verificationUrl: string | null;
      providerSignedAt: string | null;
      createdAt: string | null;
    } | null;
  }[];
  auditLog: {
    id: string;
    actorId: string | null;
    action: string;
    metadata: Record<string, unknown>;
    ipAddress: string | null;
    createdAt: string | null;
  }[];
  realtor: {
    fullName: string;
    email: string;
    dni: string | null;
    licenseNumber: string | null;
    companyName: string | null;
    ruc: string | null;
    phone: string | null;
  };
  checklist: Record<string, { checked: boolean; checkedAt?: string }>;
  duplicateCheck: {
    overlapCount: number;
    earliestStart: string | null;
    latestEnd: string | null;
  };
}

export async function getPacketEvidenceReview(
  packetId: string,
  notaryId: string,
): Promise<PacketEvidenceData> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Verify assignment + get packet
  const { data: assignmentRow } = await supabase
    .from("notary_assignments")
    .select("*")
    .eq("packet_id", packetId)
    .eq("notary_id", notaryId)
    .single();
  if (!assignmentRow) throw new Error("Not assigned to this packet");

  const { data: packetRow } = await supabase
    .from("lease_packets")
    .select("*")
    .eq("id", packetId)
    .single();
  if (!packetRow) throw new Error("Packet not found");

  // 2. Documents + signed URLs
  const { data: docs } = await supabase
    .from("packet_documents")
    .select("*")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: true });

  const documentsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      let signedUrl: string | null = null;
      if (doc.storage_path) {
        const bucket = doc.document_type === "lease_original"
          || doc.document_type === "signed_pdf"
          || doc.document_type === "certified_lease"
          || doc.document_type === "evidence_report"
          ? "documents"
          : "evidence";
        const { data: urlData } = await admin.storage
          .from(bucket)
          .createSignedUrl(doc.storage_path, 300);
        signedUrl = urlData?.signedUrl ?? null;
      }
      return {
        id: doc.id,
        documentType: doc.document_type ?? "",
        storagePath: doc.storage_path,
        fileHash: doc.file_hash,
        signedUrl,
        createdAt: doc.created_at,
      };
    }),
  );

  // 3. Signers
  const { data: signerRows } = await supabase
    .from("packet_signers")
    .select("*")
    .eq("packet_id", packetId);

  // 4. Evidence + signed URLs for images
  const { data: evidenceRows } = await admin
    .from("signer_evidence")
    .select("*")
    .in(
      "packet_signer_id",
      (signerRows ?? []).map((s) => s.id),
    );

  const imageTypes = new Set(["dni_front", "dni_back", "selfie", "liveness"]);
  const evidenceWithUrls = await Promise.all(
    (evidenceRows ?? []).map(async (ev) => {
      let signedUrl: string | null = null;
      if (ev.storage_path && imageTypes.has(ev.evidence_type ?? "")) {
        const { data: urlData } = await admin.storage
          .from("evidence")
          .createSignedUrl(ev.storage_path, 300);
        signedUrl = urlData?.signedUrl ?? null;
      }
      return { ...ev, signedUrl };
    }),
  );

  // 5. Signature records
  const { data: sigRecords } = await admin
    .from("signature_records")
    .select("*")
    .in(
      "packet_signer_id",
      (signerRows ?? []).map((s) => s.id),
    );

  const sigRecordMap = new Map(
    (sigRecords ?? []).map((r) => [r.packet_signer_id, r]),
  );

  // 6. Audit log
  const { data: auditRows } = await supabase
    .from("packet_audit_log")
    .select("*")
    .eq("packet_id", packetId)
    .order("created_at", { ascending: true });

  // 7. Realtor profile
  const { data: realtorRow } = await admin
    .from("profiles")
    .select("full_name, email, dni, license_number, company_name, ruc, phone")
    .eq("id", packetRow.created_by)
    .single();

  // 8. Checklist (from notary_review_checklists)
  const { data: checklistRow } = await admin
    .from("notary_review_checklists")
    .select("checklist_data")
    .eq("packet_id", packetId)
    .eq("notary_id", notaryId)
    .maybeSingle();

  // 9. Duplicate check via admin client
  const { data: dupResult } = await admin.rpc("check_duplicate_lease", {
    p_property_address: packetRow.property_address ?? "",
    p_property_unit: packetRow.property_unit,
    p_lease_start: packetRow.lease_start_date ?? "1970-01-01",
    p_lease_end: packetRow.lease_end_date ?? "2099-12-31",
  });
  const dupRow = Array.isArray(dupResult) ? dupResult[0] : dupResult;

  // Assemble signers
  const signers = (signerRows ?? []).map((s) => {
    const ev = evidenceWithUrls.filter(
      (e) => e.packet_signer_id === s.id,
    );
    const sigRec = sigRecordMap.get(s.id);
    return {
      id: s.id,
      fullName: s.signer_full_name ?? "",
      email: s.signer_email ?? "",
      dni: s.signer_dni,
      roleInLease: s.role_in_lease ?? "",
      status: s.status ?? "",
      evidence: ev.map((e) => ({
        id: e.id,
        evidenceType: e.evidence_type ?? "",
        storagePath: e.storage_path,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        signedUrl: e.signedUrl,
        createdAt: e.created_at,
      })),
      signatureRecord: sigRec
        ? {
            providerName: sigRec.provider_name,
            certificateSubject: sigRec.certificate_subject,
            certificateIssuer: sigRec.certificate_issuer,
            certificateSerial: sigRec.certificate_serial,
            certificateValidFrom: sigRec.certificate_valid_from,
            certificateValidTo: sigRec.certificate_valid_to,
            chainValidationResult: sigRec.chain_validation_result,
            revocationResult: sigRec.revocation_result,
            timestampResult: sigRec.timestamp_result as string | null,
            signatureValid: sigRec.signature_valid,
            pdfIntegrityValid: sigRec.pdf_integrity_valid,
            signedDocumentHash: sigRec.signed_document_hash,
            verificationUrl: sigRec.verification_url,
            providerSignedAt: sigRec.provider_signed_at,
            createdAt: sigRec.created_at,
          }
        : null,
    };
  });

  return {
    packet: {
      id: packetRow.id,
      packetCode: packetRow.packet_code ?? "",
      status: packetRow.status,
      propertyAddress: packetRow.property_address ?? "",
      propertyUnit: packetRow.property_unit,
      district: packetRow.district,
      province: packetRow.province,
      department: packetRow.department,
      rentalAmount: packetRow.rental_amount,
      depositAmount: packetRow.deposit_amount,
      leaseStartDate: packetRow.lease_start_date,
      leaseEndDate: packetRow.lease_end_date,
      documentHash: packetRow.document_hash,
      submittedAt: packetRow.submitted_to_notary_at,
      certifiedAt: packetRow.certified_at,
      createdAt: packetRow.created_at!,
    },
    assignment: {
      decision: assignmentRow.decision,
      observations: assignmentRow.observations,
      reviewStartedAt: assignmentRow.review_started_at,
      decidedAt: assignmentRow.decided_at,
    },
    documents: documentsWithUrls,
    signers,
    auditLog: (auditRows ?? []).map((a) => ({
      id: a.id,
      actorId: a.actor_id,
      action: a.action,
      metadata: (a.metadata ?? {}) as Record<string, unknown>,
      ipAddress: a.ip_address,
      createdAt: a.created_at,
    })),
    realtor: {
      fullName: realtorRow?.full_name ?? "",
      email: realtorRow?.email ?? "",
      dni: realtorRow?.dni ?? null,
      licenseNumber: realtorRow?.license_number ?? null,
      companyName: realtorRow?.company_name ?? null,
      ruc: realtorRow?.ruc ?? null,
      phone: realtorRow?.phone ?? null,
    },
    checklist: ((checklistRow?.checklist_data as Record<string, { checked: boolean; checkedAt?: string }>) ?? {}),
    duplicateCheck: {
      overlapCount: Number(dupRow?.overlap_count ?? 0),
      earliestStart: dupRow?.earliest_start ?? null,
      latestEnd: dupRow?.latest_end ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// 10.4 — Checklist toggle
// ---------------------------------------------------------------------------

export async function toggleChecklistItemAction(
  packetId: string,
  itemKey: string,
  checked: boolean,
) {
  const profile = await requireApproved("notary");
  await verifyAssignment(packetId, profile.id);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("notary_review_checklists")
    .select("id, checklist_data")
    .eq("packet_id", packetId)
    .eq("notary_id", profile.id)
    .maybeSingle();

  const currentData = (existing?.checklist_data ?? {}) as Record<
    string,
    { checked: boolean; checkedAt?: string }
  >;
  currentData[itemKey] = checked
    ? { checked: true, checkedAt: now }
    : { checked: false };

  if (existing) {
    await admin
      .from("notary_review_checklists")
      .update({
        checklist_data: currentData as unknown as Json,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("notary_review_checklists").insert({
      packet_id: packetId,
      notary_id: profile.id,
      checklist_data: currentData as unknown as Json,
      updated_at: now,
    });
  }

  revalidatePath(`/notario/paquetes/${packetId}`);
}

// ---------------------------------------------------------------------------
// 10.5 — Review actions
// ---------------------------------------------------------------------------

export async function startReviewAction(packetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await verifyAssignment(packetId, user.id);

  const packetAdapter = new SupabasePacketAdapter();
  const notaryAdapter = new SupabaseNotaryAdapter();

  await packetAdapter.updateStatus(
    packetId,
    "under_review",
    user.id,
    "notary_started_review",
  );
  await notaryAdapter.startReview(packetId);

  revalidatePath("/notario");
  revalidatePath(`/notario/paquetes/${packetId}`);
  revalidatePath("/agente");
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");
}

export async function certifyAction(
  packetId: string,
  _checklistData?: Record<string, unknown>,
  observations?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await verifyAssignment(packetId, user.id);

  const packetAdapter = new SupabasePacketAdapter();
  const notaryAdapter = new SupabaseNotaryAdapter();
  const admin = createAdminClient();

  // Fetch the authoritative checklist from the database
  const { data: checklistRow } = await admin
    .from("notary_review_checklists")
    .select("checklist_data")
    .eq("packet_id", packetId)
    .eq("notary_id", user.id)
    .maybeSingle();

  const checklistData: Record<string, unknown> =
    (checklistRow?.checklist_data as Record<string, unknown>) ?? {};

  const certType = observations
    ? "certified_with_observations"
    : "certified";

  await packetAdapter.updateStatus(
    packetId,
    "certified",
    user.id,
    "notary_certified",
  );
  await notaryAdapter.updateDecision(packetId, certType, observations);
  await notaryAdapter.createCertification({
    packetId,
    notaryId: user.id,
    type: certType,
    observations,
    checklistData,
  });

  // Set certified_at on lease_packets
  await admin
    .from("lease_packets")
    .update({ certified_at: new Date().toISOString() })
    .eq("id", packetId);

  // Create registry entry
  const { data: packet } = await admin
    .from("lease_packets")
    .select(
      "packet_code, property_address, property_unit, district, province, lease_start_date, lease_end_date, certified_at",
    )
    .eq("id", packetId)
    .single();

  const { data: signers } = await admin
    .from("packet_signers")
    .select("signer_full_name, signer_dni, role_in_lease")
    .eq("packet_id", packetId);

  const landlordDni =
    signers?.find((s) => s.role_in_lease === "landlord")?.signer_dni ?? "";
  const renterDni =
    signers?.find((s) => s.role_in_lease === "renter")?.signer_dni ?? "";

  if (packet) {
    await admin.from("registry_entries").insert({
      packet_id: packetId,
      property_address: packet.property_address ?? "",
      property_unit: packet.property_unit,
      district: packet.district,
      province: packet.province,
      landlord_dni: landlordDni,
      renter_dni: renterDni,
      lease_start_date: packet.lease_start_date ?? "",
      lease_end_date: packet.lease_end_date ?? "",
      certified_at: packet.certified_at,
      status: "active",
    });
  }

  // Generate certified document PDF
  const { data: notaryProfile } = await admin
    .from("profiles")
    .select("full_name, accreditation_number")
    .eq("id", user.id)
    .single();

  const landlordNames = (signers ?? [])
    .filter((s) => s.role_in_lease === "landlord")
    .map((s) => s.signer_full_name ?? "");
  const renterNames = (signers ?? [])
    .filter((s) => s.role_in_lease === "renter")
    .map((s) => s.signer_full_name ?? "");

  const documentHashes = await getDocumentHashTimeline(packetId, admin);

  const boolChecklist: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(checklistData)) {
    const entry = val as { checked?: boolean } | boolean;
    boolChecklist[key] = typeof entry === "object" && entry !== null
      ? Boolean(entry.checked)
      : Boolean(entry);
  }

  const now = new Date().toISOString();
  const certData: CertifiedDocumentData = {
    packetCode: packet?.packet_code ?? packetId.slice(0, 12),
    packetId,
    notaryName: notaryProfile?.full_name ?? "Notario",
    accreditationNumber: notaryProfile?.accreditation_number ?? null,
    certifiedAt: packet?.certified_at ?? now,
    certificationType: certType as
      | "certified"
      | "certified_with_observations",
    observations,
    checklistSummary: boolChecklist,
    documentHashes: documentHashes.map((h) => ({
      stage: h.stage,
      algorithm: h.algorithm,
      hash: h.hash,
      timestamp: h.timestamp,
      actorId: h.actorId,
    })),
    propertyAddress: packet?.property_address ?? "",
    propertyUnit: packet?.property_unit ?? undefined,
    district: packet?.district ?? undefined,
    province: packet?.province ?? undefined,
    landlordNames,
    renterNames,
    leaseStartDate: packet?.lease_start_date ?? undefined,
    leaseEndDate: packet?.lease_end_date ?? undefined,
  };

  await generateAndStoreCertifiedDocument(packetId, certData, user.id);

  // Notify all parties (realtor + signers) that the packet was certified
  const { data: packetForNotify } = await admin
    .from("lease_packets")
    .select("created_by")
    .eq("id", packetId)
    .single();

  const recipients: Array<{ email: string; name: string; role: "realtor" | "landlord" | "renter" }> = [];

  if (packetForNotify?.created_by) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", packetForNotify.created_by)
      .single();

    if (ownerProfile?.email) {
      recipients.push({
        email: ownerProfile.email,
        name: ownerProfile.full_name ?? "",
        role: "realtor",
      });
    }
  }

  const { data: allPacketSigners } = await admin
    .from("packet_signers")
    .select("signer_email, signer_full_name, role_in_lease")
    .eq("packet_id", packetId);

  for (const s of allPacketSigners ?? []) {
    if (s.signer_email) {
      recipients.push({
        email: s.signer_email,
        name: s.signer_full_name ?? "",
        role: (s.role_in_lease as "landlord" | "renter") ?? "renter",
      });
    }
  }

  if (recipients.length > 0) {
    void notifyPacketCertified({
      recipients,
      packetCode: packet?.packet_code ?? "",
      packetId,
      propertyAddress: packet?.property_address ?? "",
    });
  }

  revalidatePath("/notario");
  revalidatePath(`/agente/paquetes/${packetId}`);
  revalidatePath("/agente");
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");

  return { success: true };
}

export async function certifyWithObservationsAction(
  packetId: string,
  _checklistData: Record<string, unknown>,
  observations: string,
) {
  return certifyAction(packetId, undefined, observations);
}

export async function returnForCorrectionAction(
  packetId: string,
  reason: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await verifyAssignment(packetId, user.id);

  const packetAdapter = new SupabasePacketAdapter();
  const notaryAdapter = new SupabaseNotaryAdapter();
  const admin = createAdminClient();

  await packetAdapter.updateStatus(
    packetId,
    "needs_correction",
    user.id,
    "notary_returned_for_correction",
  );
  await notaryAdapter.updateDecision(packetId, "needs_correction", reason);

  // Notify realtor
  const { data: pkt } = await admin
    .from("lease_packets")
    .select("created_by, packet_code, property_address")
    .eq("id", packetId)
    .single();

  if (pkt?.created_by) {
    const { data: realtorProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", pkt.created_by)
      .single();

    const { data: signers } = await admin
      .from("packet_signers")
      .select("signer_full_name, signer_email")
      .eq("packet_id", packetId);

    const parties = (signers ?? [])
      .filter((s) => s.signer_email)
      .map((s) => ({ email: s.signer_email!, name: s.signer_full_name ?? "" }));

    if (realtorProfile?.email) {
      void notifyPacketNeedsCorrection({
        realtorEmail: realtorProfile.email,
        realtorName: realtorProfile.full_name ?? "",
        packetCode: pkt.packet_code ?? "",
        packetId,
        propertyAddress: pkt.property_address ?? "",
        reason,
        parties,
      });
    }
  }

  revalidatePath("/notario");
  revalidatePath("/agente");
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");
  return { success: true };
}

export async function rejectAction(packetId: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await verifyAssignment(packetId, user.id);

  const packetAdapter = new SupabasePacketAdapter();
  const notaryAdapter = new SupabaseNotaryAdapter();
  const admin = createAdminClient();

  await packetAdapter.updateStatus(
    packetId,
    "rejected",
    user.id,
    "notary_rejected",
  );
  await notaryAdapter.updateDecision(packetId, "rejected", reason);

  // Notify realtor
  const { data: pkt } = await admin
    .from("lease_packets")
    .select("created_by, packet_code, property_address")
    .eq("id", packetId)
    .single();

  if (pkt?.created_by) {
    const { data: realtorProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", pkt.created_by)
      .single();

    const { data: signers } = await admin
      .from("packet_signers")
      .select("signer_full_name, signer_email")
      .eq("packet_id", packetId);

    const parties = (signers ?? [])
      .filter((s) => s.signer_email)
      .map((s) => ({ email: s.signer_email!, name: s.signer_full_name ?? "" }));

    if (realtorProfile?.email) {
      void notifyPacketRejected({
        realtorEmail: realtorProfile.email,
        realtorName: realtorProfile.full_name ?? "",
        packetCode: pkt.packet_code ?? "",
        packetId,
        propertyAddress: pkt.property_address ?? "",
        reason,
        parties,
      });
    }
  }

  revalidatePath("/notario");
  revalidatePath("/agente");
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 10.6 — Earnings data
// ---------------------------------------------------------------------------

export interface EarningsMonth {
  month: string;
  certifiedCount: number;
  withObservationsCount: number;
}

export async function getNotaryEarnings(
  notaryId: string,
): Promise<EarningsMonth[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notary_certifications")
    .select("certified_at, certification_type")
    .eq("notary_id", notaryId)
    .order("certified_at", { ascending: false });

  if (error) throw new Error(`Earnings fetch failed: ${error.message}`);
  if (!data) return [];

  const monthMap = new Map<
    string,
    { total: number; withObs: number }
  >();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  for (const row of data) {
    const d = new Date(row.certified_at!);
    if (d < cutoff) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key) ?? { total: 0, withObs: 0 };
    entry.total += 1;
    if (row.certification_type === "certified_with_observations") {
      entry.withObs += 1;
    }
    monthMap.set(key, entry);
  }

  return Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, counts]) => ({
      month,
      certifiedCount: counts.total,
      withObservationsCount: counts.withObs,
    }));
}
