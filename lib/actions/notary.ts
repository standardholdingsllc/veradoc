"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { requireApproved } from "@/lib/auth/guards";
import { isNotarySealWorkflowGloballyEnabled } from "@/lib/env/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CorrectionScope, NotaryWorkflowVersion } from "@/lib/domain/types";
import type { SealWorkflowState } from "@/lib/domain/notary-seal-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveNotaryWorkflowVersion(
  notaryId: string,
  admin: SupabaseClient<Database>,
): Promise<NotaryWorkflowVersion> {
  if (!isNotarySealWorkflowGloballyEnabled()) {
    return "legacy_v1";
  }
  const { data } = await admin
    .from("notary_workflow_settings")
    .select("physical_seal_v1_enabled")
    .eq("notary_id", notaryId)
    .maybeSingle();

  if (data?.physical_seal_v1_enabled) {
    return "physical_seal_v1";
  }
  return "legacy_v1";
}

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
  priority: "urgent" | "high" | "normal" | "low";
  priorityReason: string | null;
  payoutParticipationPercent: number | null;
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
      priority, priority_reason,
      lease_packets!inner (
        id, packet_code, status, property_address, property_unit, district, province,
        submitted_to_notary_at, lease_start_date, lease_end_date,
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

  const addressSet = new Map<string, {
    address: string;
    unit: string | null;
    start: string;
    end: string;
  }>();
  for (const row of data) {
    const lp = row.lease_packets as Record<string, unknown>;
    const addr = (lp.property_address as string) ?? "";
    const unit = lp.property_unit as string | null;
    const start = lp.lease_start_date as string | null;
    const end = lp.lease_end_date as string | null;
    if (!addr || !start || !end) continue;
    const key = `${addr}\u0000${unit ?? ""}\u0000${start}\u0000${end}`;
    if (!addressSet.has(key)) {
      addressSet.set(key, {
        address: addr,
        unit: lp.property_unit as string | null,
        start,
        end,
      });
    }
  }

  const duplicateMap = new Map<string, boolean>();
  await Promise.all(
    Array.from(addressSet.entries()).map(async ([key, info]) => {
      const { data: dup } = await admin.rpc("check_duplicate_lease", {
        p_property_address: info.address,
        p_property_unit: info.unit ?? "",
        p_lease_start: info.start,
        p_lease_end: info.end,
      });
      const overlap = Array.isArray(dup) ? dup[0] : dup;
      duplicateMap.set(key, (overlap?.overlap_count ?? 0) > 0);
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeRate } = await admin
    .from("notary_payout_rates")
    .select("participation_bps")
    .eq("notary_id", notaryId)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data.map((row) => {
    const lp = row.lease_packets as Record<string, unknown>;
    const realtorProfile = (lp.profiles as Record<string, unknown>) ?? {};
    const signers = (lp.packet_signers as unknown[]) ?? [];
    const start = lp.lease_start_date as string | null;
    const end = lp.lease_end_date as string | null;
    const duplicateKey = start && end
      ? `${(lp.property_address as string) ?? ""}\u0000${(lp.property_unit as string | null) ?? ""}\u0000${start}\u0000${end}`
      : null;
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
      registryAlert: duplicateKey ? duplicateMap.get(duplicateKey) ?? false : false,
      priority: (row.priority ?? "normal") as NotaryQueueItem["priority"],
      priorityReason: row.priority_reason,
      payoutParticipationPercent: activeRate
        ? Number(activeRate.participation_bps) / 100
        : null,
    };
  }).sort((a, b) => {
    const rank: Record<NotaryQueueItem["priority"], number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    return rank[a.priority] - rank[b.priority]
      || new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
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
    notaryWorkflowVersion: string | null;
  };
  assignment: {
    decision: string | null;
    observations: string | null;
    reviewStartedAt: string | null;
    decidedAt: string | null;
    correctionScope: string | null;
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
  propertyAuthorityChecks: {
    id: string;
    provider: string;
    titleNumber: string;
    registryZone: string | null;
    registryOffice: string | null;
    queryReference: string | null;
    verificationStatus: "verified" | "observation" | "not_found";
    ownerNames: string[];
    checkedAt: string;
    checkedBy: string;
    sourceUrl: string | null;
    notes: string | null;
  }[];
  evidenceSummary: {
    completenessPercent: number;
    completedChecks: number;
    totalChecks: number;
    identityImages: number;
    validSignatures: number;
    signerCount: number;
    evidenceReportAvailable: boolean;
    generatedAt: string | null;
  };
  systemFlags: {
    code: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
  }[];
  decisionJob: {
    status: string;
    jobType: string;
    lastError: string | null;
  } | null;
  sealWorkflowState: SealWorkflowState | null;
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

  const isPhysicalFlow = packetRow.notary_workflow_version === "physical_seal_v1";

  const documentsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc) => {
      let signedUrl: string | null = null;

      const suppressUrl = isPhysicalFlow && doc.document_type === "signed_pdf";

      if (doc.storage_path && !suppressUrl) {
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

  const previewTypes = new Set([
    "dni_front",
    "dni_back",
    "selfie",
    "liveness",
    "property_authority",
  ]);
  const evidenceWithUrls = await Promise.all(
    (evidenceRows ?? []).map(async (ev) => {
      let signedUrl: string | null = null;
      if (ev.storage_path && previewTypes.has(ev.evidence_type ?? "")) {
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

  const [{ data: authorityRows }, { data: decisionJobRow }] = await Promise.all([
    admin
      .from("property_authority_checks")
      .select(
        "id, provider, title_number, registry_zone, registry_office, query_reference, verification_status, owner_names, checked_at, checked_by, source_url, notes",
      )
      .eq("packet_id", packetId)
      .order("checked_at", { ascending: false }),
    admin
      .from("notary_workflow_jobs")
      .select("status, job_type, last_error")
      .eq("packet_id", packetId)
      .in("status", ["pending", "processing", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // 9. Duplicate check via admin client
  const { data: dupResult } = packetRow.lease_start_date && packetRow.lease_end_date
    ? await admin.rpc("check_duplicate_lease", {
        p_property_address: packetRow.property_address ?? "",
        p_property_unit: packetRow.property_unit ?? "",
        p_lease_start: packetRow.lease_start_date,
        p_lease_end: packetRow.lease_end_date,
      })
    : { data: null };
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

  const evidenceReport = documentsWithUrls.find(
    (document) => document.documentType === "evidence_report",
  );
  const requiredIdentityTypes = ["dni_front", "dni_back", "selfie"];
  const identityImages = signers.reduce(
    (count, signer) => count + signer.evidence.filter((evidence) =>
      requiredIdentityTypes.includes(evidence.evidenceType)
    ).length,
    0,
  );
  const validSignatures = signers.filter(
    (signer) => signer.signatureRecord?.signatureValid === true
      && signer.signatureRecord.pdfIntegrityValid === true,
  ).length;
  const consentCount = signers.filter((signer) =>
    signer.evidence.some((evidence) => evidence.evidenceType === "consent_record")
  ).length;
  const signedDocumentAvailable = documentsWithUrls.some(
    (document) => document.documentType === "signed_pdf",
  );
  const latestAuthorityCheck = authorityRows?.[0];
  const totalChecks = Math.max(1, signers.length * 5 + 4);
  const completedChecks = Math.min(
    totalChecks,
    identityImages
      + validSignatures
      + consentCount
      + Number(signedDocumentAvailable)
      + Number(Boolean(evidenceReport))
      + Number(Boolean(packetRow.document_hash))
      + Number(latestAuthorityCheck?.verification_status === "verified"),
  );

  const systemFlags: PacketEvidenceData["systemFlags"] = [];
  if (!evidenceReport) {
    systemFlags.push({
      code: "evidence_report_missing",
      severity: "critical",
      title: "Informe de evidencia no disponible",
      detail: "El PDF consolidado de evidencia no está registrado para este paquete.",
    });
  }
  if (!signedDocumentAvailable) {
    systemFlags.push({
      code: "signed_document_missing",
      severity: "critical",
      title: "Documento firmado no disponible",
      detail: "No se encontró un PDF firmado aceptado para la revisión notarial.",
    });
  }
  for (const signer of signers) {
    const evidenceTypes = new Set(signer.evidence.map((evidence) => evidence.evidenceType));
    const missingIdentity = requiredIdentityTypes.filter((type) => !evidenceTypes.has(type));
    if (missingIdentity.length > 0) {
      systemFlags.push({
        code: "identity_evidence_incomplete",
        severity: "critical",
        title: `Identidad incompleta: ${signer.fullName}`,
        detail: `Falta evidencia: ${missingIdentity.join(", ")}.`,
      });
    }
    if (!evidenceTypes.has("consent_record")) {
      systemFlags.push({
        code: "consent_missing",
        severity: "warning",
        title: `Consentimiento faltante: ${signer.fullName}`,
        detail: "No se encontró el registro de consentimiento del firmante.",
      });
    }
    if (!signer.signatureRecord) {
      systemFlags.push({
        code: "signature_validation_missing",
        severity: "critical",
        title: `Validación de firma faltante: ${signer.fullName}`,
        detail: "FirmEasy no registró resultados verificables para esta firma.",
      });
    } else if (
      signer.signatureRecord.signatureValid !== true
      || signer.signatureRecord.pdfIntegrityValid !== true
    ) {
      systemFlags.push({
        code: "signature_validation_failed",
        severity: "critical",
        title: `Firma requiere revisión: ${signer.fullName}`,
        detail: "La firma o la integridad del PDF no tiene un resultado válido.",
      });
    } else if (
      signer.signatureRecord.certificateValidTo
      && new Date(signer.signatureRecord.certificateValidTo).getTime() < Date.now()
    ) {
      systemFlags.push({
        code: "signature_certificate_expired",
        severity: "warning",
        title: `Certificado vencido: ${signer.fullName}`,
        detail: `La vigencia terminó el ${signer.signatureRecord.certificateValidTo}.`,
      });
    }
  }
  if ((dupRow?.overlap_count ?? 0) > 0) {
    systemFlags.push({
      code: "duplicate_lease_overlap",
      severity: "warning",
      title: "Superposición registral detectada",
      detail: `Hay ${Number(dupRow?.overlap_count ?? 0)} arrendamiento(s) activo(s) superpuesto(s).`,
    });
  }
  if (!latestAuthorityCheck) {
    systemFlags.push({
      code: "property_authority_missing",
      severity: "warning",
      title: "Verificación SUNARP pendiente",
      detail: "Aún no se registró una consulta de autoridad sobre la propiedad.",
    });
  } else if (latestAuthorityCheck.verification_status !== "verified") {
    systemFlags.push({
      code: "property_authority_observation",
      severity: latestAuthorityCheck.verification_status === "not_found"
        ? "critical"
        : "warning",
      title: "Resultado SUNARP requiere atención",
      detail: latestAuthorityCheck.notes
        ?? `Estado: ${latestAuthorityCheck.verification_status}.`,
    });
  }

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
      notaryWorkflowVersion: packetRow.notary_workflow_version,
    },
    assignment: {
      decision: assignmentRow.decision,
      observations: assignmentRow.observations,
      reviewStartedAt: assignmentRow.review_started_at,
      decidedAt: assignmentRow.decided_at,
      correctionScope: assignmentRow.correction_scope,
    },
    documents: documentsWithUrls,
    signers,
    auditLog: (auditRows ?? []).map((a) => ({
      id: a.id,
      actorId: a.actor_id,
      action: a.action,
      metadata: (a.metadata ?? {}) as Record<string, unknown>,
      ipAddress: a.ip_address as string | null,
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
    propertyAuthorityChecks: (authorityRows ?? []).map((check) => ({
      id: check.id,
      provider: check.provider,
      titleNumber: check.title_number,
      registryZone: check.registry_zone,
      registryOffice: check.registry_office,
      queryReference: check.query_reference,
      verificationStatus: check.verification_status as
        | "verified"
        | "observation"
        | "not_found",
      ownerNames: check.owner_names ?? [],
      checkedAt: check.checked_at,
      checkedBy: check.checked_by,
      sourceUrl: check.source_url,
      notes: check.notes,
    })),
    evidenceSummary: {
      completenessPercent: Math.round((completedChecks / totalChecks) * 100),
      completedChecks,
      totalChecks,
      identityImages,
      validSignatures,
      signerCount: signers.length,
      evidenceReportAvailable: Boolean(evidenceReport),
      generatedAt: evidenceReport?.createdAt ?? null,
    },
    systemFlags,
    decisionJob: decisionJobRow
      ? {
          status: decisionJobRow.status,
          jobType: decisionJobRow.job_type,
          lastError: decisionJobRow.last_error,
        }
      : null,
    sealWorkflowState: isPhysicalFlow
      ? await getSealWorkflowState(packetId, notaryId)
      : null,
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

  const requestHeaders = await headers();
  const context: Json = {
    source: "notary_dashboard",
    route: `/notario/paquetes/${packetId}`,
    ip_address: requestHeaders.get("x-real-ip")
      ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? null,
    user_agent: requestHeaders.get("user-agent"),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_notary_checklist_item", {
    p_packet_id: packetId,
    p_item_key: itemKey,
    p_checked: checked,
    p_context: context,
  });

  if (error) {
    throw new Error(`No se pudo actualizar la lista: ${error.message}`);
  }

  revalidatePath(`/notario/paquetes/${packetId}`);
}

export type NotaryPriority = "urgent" | "high" | "normal" | "low";

export async function setNotaryPriorityAction(
  packetId: string,
  priority: NotaryPriority,
  reason?: string,
) {
  await requireApproved("notary");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notary_assignment_priority", {
    p_packet_id: packetId,
    p_priority: priority,
    p_reason: reason?.trim() || undefined,
  });
  if (error) throw new Error(`No se pudo cambiar la prioridad: ${error.message}`);
  revalidatePath("/notario");
}

export interface PropertyAuthorityCheckInput {
  titleNumber: string;
  verificationStatus: "verified" | "observation" | "not_found";
  checkedAt: string;
  registryZone?: string;
  registryOffice?: string;
  queryReference?: string;
  ownerNames?: string[];
  sourceUrl?: string;
  notes?: string;
}

export async function recordPropertyAuthorityCheckAction(
  packetId: string,
  input: PropertyAuthorityCheckInput,
) {
  await requireApproved("notary");
  if (!input.titleNumber.trim()) throw new Error("Ingrese el número de partida SUNARP");
  if (!Number.isFinite(new Date(input.checkedAt).getTime())) {
    throw new Error("La fecha de consulta SUNARP no es válida");
  }
  if (input.sourceUrl?.trim()) {
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(input.sourceUrl.trim());
    } catch {
      throw new Error("El enlace de respaldo SUNARP no es válido");
    }
    if (sourceUrl.protocol !== "https:") {
      throw new Error("El enlace de respaldo SUNARP debe usar HTTPS");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_property_authority_check", {
    p_packet_id: packetId,
    p_title_number: input.titleNumber.trim(),
    p_verification_status: input.verificationStatus,
    p_checked_at: new Date(input.checkedAt).toISOString(),
    p_registry_zone: input.registryZone?.trim() || undefined,
    p_registry_office: input.registryOffice?.trim() || undefined,
    p_query_reference: input.queryReference?.trim() || undefined,
    p_owner_names: input.ownerNames?.map((name) => name.trim()).filter(Boolean) ?? [],
    p_source_url: input.sourceUrl?.trim() || undefined,
    p_notes: input.notes?.trim() || undefined,
    p_metadata: { source: "notary_dashboard" },
  });
  if (error) throw new Error(`No se pudo registrar la consulta SUNARP: ${error.message}`);
  revalidatePath(`/notario/paquetes/${packetId}`);
}

// ---------------------------------------------------------------------------
// 10.5 — Review actions
// ---------------------------------------------------------------------------

export async function startReviewAction(packetId: string) {
  const user = await requireApproved("notary");
  const admin = createAdminClient();
  const workflowVersion = await resolveNotaryWorkflowVersion(user.id, admin);
  const supabase = await createClient();

  const { error } = await supabase.rpc("start_notary_review", {
    p_packet_id: packetId,
    p_workflow_version: workflowVersion,
  });

  if (error) {
    throw new Error(`Error al iniciar revisión: ${error.message}`);
  }

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
  return submitNotaryDecisionAction(
    packetId,
    observations ? "certified_with_observations" : "certified",
    observations,
  );
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
  correctionScope: CorrectionScope = "notary_observation",
) {
  return submitNotaryDecisionAction(
    packetId,
    "needs_correction",
    reason,
    correctionScope,
  );
}

export async function rejectAction(packetId: string, reason: string) {
  return submitNotaryDecisionAction(packetId, "rejected", reason);
}

type PersistedNotaryDecision =
  | "certified"
  | "certified_with_observations"
  | "needs_correction"
  | "rejected";

async function submitNotaryDecisionAction(
  packetId: string,
  decision: PersistedNotaryDecision,
  observations?: string,
  correctionScope?: CorrectionScope,
) {
  await requireApproved("notary");
  const reason = observations?.trim();
  if (
    ["certified_with_observations", "needs_correction", "rejected"].includes(decision)
    && !reason
  ) {
    throw new Error("Se requiere un motivo u observación detallada");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_notary_decision", {
    p_packet_id: packetId,
    p_decision: decision,
    p_observations: reason || undefined,
    p_correction_scope: correctionScope,
  });
  if (error) throw new Error(`No se pudo registrar la decisión: ${error.message}`);

  revalidateNotaryDecisionPaths(packetId);
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    success: true,
    queued: result.queued === true,
    certificationId: result.certification_id as string | undefined,
  };
}

function revalidateNotaryDecisionPaths(packetId: string) {
  revalidatePath("/notario");
  revalidatePath(`/notario/paquetes/${packetId}`);
  revalidatePath(`/agente/paquetes/${packetId}`);
  revalidatePath("/agente");
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");
}

// ---------------------------------------------------------------------------
// 10.6 — Earnings data
// ---------------------------------------------------------------------------

export interface EarningsMonth {
  month: string;
  certifiedCount: number;
  withObservationsCount: number;
  estimatedPayoutPen: number;
  pendingCalculationCount: number;
  payoutStatus: "estimated" | "prepared" | "confirmed" | "paid" | "void";
  confirmedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
}

export async function getNotaryEarnings(
  notaryId: string,
): Promise<EarningsMonth[]> {
  const admin = createAdminClient();

  const [certificationsResult, payoutsResult] = await Promise.all([
    admin
      .from("notary_certifications")
      .select("certified_at, published_at, certification_type, publication_status")
      .eq("notary_id", notaryId)
      .eq("publication_status", "published")
      .order("certified_at", { ascending: false }),
    admin
      .from("notary_monthly_payouts")
      .select(
        "period_month, certification_count, gross_amount, notary_igv_centimos, status, confirmed_at, paid_at, payment_reference",
      )
      .eq("notary_id", notaryId)
      .order("period_month", { ascending: false }),
  ]);

  if (certificationsResult.error) {
    throw new Error(`Earnings fetch failed: ${certificationsResult.error.message}`);
  }
  if (payoutsResult.error) {
    throw new Error(`Payout fetch failed: ${payoutsResult.error.message}`);
  }

  const monthMap = new Map<string, {
    total: number;
    withObs: number;
    estimated: number;
    unconfigured: number;
  }>();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);

  for (const row of certificationsResult.data ?? []) {
    const occurredAt = row.published_at ?? row.certified_at;
    if (!occurredAt) continue;
    const d = new Date(occurredAt);
    if (d < cutoff) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key) ?? {
      total: 0,
      withObs: 0,
      estimated: 0,
      unconfigured: 0,
    };
    entry.total += 1;
    if (row.certification_type === "certified_with_observations") {
      entry.withObs += 1;
    }
    // MND depends on the actual tax-exclusive receipt and reconciled processor
    // fee. Do not fabricate a fixed per-document estimate before monthly close.
    entry.unconfigured += 1;
    monthMap.set(key, entry);
  }

  const payoutMap = new Map(
    (payoutsResult.data ?? []).map((payout) => [payout.period_month.slice(0, 7), payout]),
  );

  for (const [month, payout] of payoutMap.entries()) {
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        total: payout.certification_count,
        withObs: 0,
        estimated: Number(payout.gross_amount) + payout.notary_igv_centimos / 100,
        unconfigured: 0,
      });
    }
  }

  return Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, counts]) => {
      const payout = payoutMap.get(month);
      return {
        month,
        certifiedCount: payout?.certification_count ?? counts.total,
        withObservationsCount: counts.withObs,
        estimatedPayoutPen: payout
          ? Number(payout.gross_amount) + payout.notary_igv_centimos / 100
          : counts.estimated,
        pendingCalculationCount: payout ? 0 : counts.unconfigured,
        payoutStatus: (payout?.status ?? "estimated") as EarningsMonth["payoutStatus"],
        confirmedAt: payout?.confirmed_at ?? null,
        paidAt: payout?.paid_at ?? null,
        paymentReference: payout?.payment_reference ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// Seal workflow state loader (authoritative server state)
// ---------------------------------------------------------------------------

export async function getSealWorkflowState(
  packetId: string,
  notaryId: string,
): Promise<SealWorkflowState> {
  const admin = createAdminClient();

  const printDownloadAudit = await admin
    .from("packet_audit_log")
    .select("id")
    .eq("packet_id", packetId)
    .eq("action", "notary_print_download_url_issued")
    .limit(1);

  const printDownloadIssued = (printDownloadAudit.data?.length ?? 0) > 0;

  const { data: signedDoc } = await admin
    .from("packet_documents")
    .select("id, file_hash, page_count")
    .eq("packet_id", packetId)
    .eq("document_type", "signed_pdf")
    .eq("status", "accepted")
    .maybeSingle();

  const { data: scanDoc } = await admin
    .from("packet_documents")
    .select("id, file_hash, page_count, metadata")
    .eq("packet_id", packetId)
    .eq("document_type", "notarial_scan")
    .eq("status", "accepted")
    .maybeSingle();

  let attestation: SealWorkflowState["attestation"] = null;
  if (scanDoc) {
    const { data: att } = await admin
      .from("notary_attestations")
      .select("id, attestation_text_version, attested_at, notarial_scan_document_id")
      .eq("notarial_scan_document_id", scanDoc.id)
      .eq("notary_id", notaryId)
      .maybeSingle();

    if (att) {
      attestation = {
        id: att.id,
        textVersion: att.attestation_text_version,
        attestedAt: att.attested_at,
        scanId: att.notarial_scan_document_id,
      };
    }
  }

  let preparedCertification: SealWorkflowState["preparedCertification"] = null;
  const { data: cert } = await admin
    .from("notary_certifications")
    .select("id, certification_report_document_id, notarial_scan_document_id")
    .eq("packet_id", packetId)
    .eq("publication_status", "prepared")
    .maybeSingle();

  if (cert) {
    let reportDocumentId: string | null = null;

    if (cert.certification_report_document_id) {
      const { data: reportDoc } = await admin
        .from("packet_documents")
        .select("id, status, certification_id, source_document_id")
        .eq("id", cert.certification_report_document_id)
        .maybeSingle();

      if (
        reportDoc &&
        reportDoc.status === "accepted" &&
        reportDoc.certification_id === cert.id &&
        reportDoc.source_document_id === cert.notarial_scan_document_id
      ) {
        reportDocumentId = reportDoc.id;
      }
    }

    preparedCertification = {
      id: cert.id,
      reportDocumentId,
      scanId: cert.notarial_scan_document_id,
    };
  }

  return {
    printDownloadIssued,
    signedDocument: signedDoc
      ? { id: signedDoc.id, hash: signedDoc.file_hash ?? "", pageCount: signedDoc.page_count }
      : null,
    acceptedScan: scanDoc
      ? {
          id: scanDoc.id,
          hash: scanDoc.file_hash ?? "",
          pageCount: scanDoc.page_count,
          metadata: (scanDoc.metadata ?? {}) as Record<string, unknown>,
        }
      : null,
    attestation,
    preparedCertification,
  };
}
