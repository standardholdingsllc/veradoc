"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSha256 } from "@/lib/utils/document-hash";
import { validateNotarialScan } from "@/lib/services/notary-scan-validation";
import {
  ATTESTATION_TEXT_VERSION,
  ATTESTATION_TEXT_ES,
} from "@/lib/domain/notary-seal-types";
import type { NotaryAttestationData } from "@/lib/domain/notary-seal-types";
import type { Json } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Shared guard: every physical-sello action runs this first
// ---------------------------------------------------------------------------

async function requirePhysicalSealContext(
  packetId: string,
  expectedStatus: string | string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const admin = createAdminClient();

  // Active notary profile check
  const { data: profile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "notary" || profile.status !== "active") {
    throw new Error("No tiene permiso como notario activo");
  }

  const { data: assignment } = await admin
    .from("notary_assignments")
    .select("notary_id")
    .eq("packet_id", packetId)
    .maybeSingle();

  if (!assignment || assignment.notary_id !== user.id) {
    throw new Error("No está asignado como notario para este paquete");
  }

  const { data: packet } = await admin
    .from("lease_packets")
    .select("status, notary_workflow_version")
    .eq("id", packetId)
    .single();

  if (!packet) throw new Error("Paquete no encontrado");

  if (packet.notary_workflow_version !== "physical_seal_v1") {
    throw new Error("Este paquete no usa el flujo de certificación física");
  }

  const allowedStatuses = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];

  if (!allowedStatuses.includes(packet.status)) {
    throw new Error(
      `Estado del paquete inválido: ${packet.status}. ` +
      `Se requiere: ${allowedStatuses.join(" o ")}`,
    );
  }

  return { user, admin, packet };
}

// ---------------------------------------------------------------------------
// 1. Approve evidence for physical seal
// ---------------------------------------------------------------------------

export async function approveEvidenceForSealAction(packetId: string) {
  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "under_review",
  );

  const { error } = await admin.rpc("approve_evidence_for_seal", {
    p_packet_id: packetId,
    p_actor_id: user.id,
  });

  if (error) throw new Error(`Error al aprobar evidencia: ${error.message}`);

  revalidatePath("/notario");
  revalidatePath(`/notario/paquetes/${packetId}`);
  revalidatePath("/agente");

  return { success: true };
}

// ---------------------------------------------------------------------------
// 2. Audited download of signed PDF for printing
// ---------------------------------------------------------------------------

export async function retrieveSignedPdfForPrintingAction(packetId: string) {
  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "awaiting_notary_seal",
  );

  const { data: doc } = await admin
    .from("packet_documents")
    .select("id, storage_path, file_hash, page_count")
    .eq("packet_id", packetId)
    .eq("document_type", "signed_pdf")
    .eq("status", "accepted")
    .maybeSingle();

  if (!doc) throw new Error("No se encontró el PDF firmado para este paquete");

  const { data: signed } = await admin.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300);

  if (!signed?.signedUrl) {
    throw new Error("Error al generar URL de descarga");
  }

  const { error: auditError } = await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: user.id,
    action: "notary_print_download_url_issued",
    metadata: {
      document_id: doc.id,
      document_hash: doc.file_hash,
      page_count: doc.page_count,
      url_expires_seconds: 300,
    },
  });

  if (auditError) {
    throw new Error("Error al registrar evento de descarga");
  }

  return {
    url: signed.signedUrl,
    documentId: doc.id,
    fileHash: doc.file_hash,
    pageCount: doc.page_count,
  };
}

// ---------------------------------------------------------------------------
// 3. Upload notarial scan
// ---------------------------------------------------------------------------

export async function uploadNotarialScanAction(
  packetId: string,
  formData: FormData,
  declaredAddedPages: number = 0,
) {
  if (
    !Number.isInteger(declaredAddedPages) ||
    declaredAddedPages < 0 ||
    declaredAddedPages > 20
  ) {
    return { error: "Páginas adicionales debe ser un entero entre 0 y 20." };
  }

  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "awaiting_notary_seal",
  );

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Archivo requerido");

  if (file.type !== "application/pdf") {
    return { error: "Solo se aceptan archivos PDF." };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "El archivo excede el límite de 50 MB." };
  }

  const { data: sourceDoc } = await admin
    .from("packet_documents")
    .select("id, file_hash, page_count")
    .eq("packet_id", packetId)
    .eq("document_type", "signed_pdf")
    .eq("status", "accepted")
    .maybeSingle();

  if (!sourceDoc) {
    return { error: "No se encontró el PDF firmado original para este paquete." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const validation = await validateNotarialScan(
    buffer,
    sourceDoc.id,
    sourceDoc.file_hash ?? "",
    sourceDoc.page_count,
    declaredAddedPages,
  );

  if (!validation.valid) {
    return { error: validation.errors.join(" ") };
  }

  const documentId = crypto.randomUUID();
  const storagePath = `packets/${packetId}/notarial_scans/${documentId}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Error al subir archivo: ${uploadError.message}` };
  }

  const sanitizedFilename = file.name
    .replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]/g, "_")
    .slice(0, 255);

  try {
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "replace_packet_document",
      {
        p_packet_id: packetId,
        p_document_type: "notarial_scan",
        p_storage_path: storagePath,
        p_file_hash: validation.file_hash,
        p_uploaded_by: user.id,
        p_file_size_bytes: validation.file_size_bytes,
        p_page_count: validation.page_count ?? undefined,
        p_original_filename: sanitizedFilename,
        p_metadata: {
          validation_result: {
            pdf_header_ok: validation.pdf_header_ok,
            pdf_structure_ok: validation.pdf_structure_ok,
            not_encrypted: validation.not_encrypted,
            declared_added_pages: validation.declared_added_pages,
            validator_version: validation.validator_version,
            warnings: validation.warnings,
          },
        },
        p_source_document_id: sourceDoc.id,
        p_document_id: documentId,
      },
    );

    if (rpcError) {
      await admin.storage.from("documents").remove([storagePath]);
      return { error: `Error al registrar documento: ${rpcError.message}` };
    }

    const result = rpcResult as {
      old_document_id: string | null;
      new_document_id: string;
      idempotent: boolean;
    };

    if (result.idempotent) {
      await admin.storage.from("documents").remove([storagePath]);
    }
  } catch (err) {
    await admin.storage.from("documents").remove([storagePath]);
    throw err;
  }

  revalidatePath(`/notario/paquetes/${packetId}`);

  return {
    data: {
      documentId,
      fileHash: validation.file_hash,
      pageCount: validation.page_count,
      fileSizeBytes: validation.file_size_bytes,
      warnings: validation.warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Submit notary attestation
// ---------------------------------------------------------------------------

export async function submitNotaryAttestationAction(
  packetId: string,
  notarialScanDocumentId: string,
  attestationData: NotaryAttestationData,
) {
  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "awaiting_notary_seal",
  );

  if (
    !attestationData.page_count_matches ||
    !attestationData.all_pages_legible ||
    !attestationData.sello_applied ||
    !attestationData.physical_signature_applied ||
    !attestationData.no_content_altered
  ) {
    throw new Error("Todos los campos de la atestación son requeridos");
  }

  const { data: scanDoc } = await admin
    .from("packet_documents")
    .select("id, file_hash, packet_id, document_type, status, source_document_id, page_count, metadata")
    .eq("id", notarialScanDocumentId)
    .single();

  if (!scanDoc) throw new Error("Documento de escaneo no encontrado");
  if (scanDoc.packet_id !== packetId) {
    throw new Error("El documento no pertenece a este paquete");
  }
  if (scanDoc.document_type !== "notarial_scan") {
    throw new Error("El documento no es un escaneo notarial");
  }
  if (scanDoc.status !== "accepted") {
    throw new Error("El documento de escaneo debe estar aceptado");
  }

  const { data: sourceDoc } = await admin
    .from("packet_documents")
    .select("id, file_hash, document_type, status, page_count")
    .eq("id", scanDoc.source_document_id!)
    .single();

  if (!sourceDoc || sourceDoc.document_type !== "signed_pdf" || sourceDoc.status !== "accepted") {
    throw new Error("El documento fuente debe ser el PDF firmado aceptado");
  }

  // Exact page equality: scan = source + declared_added_pages
  const scanMeta = (scanDoc.metadata ?? {}) as Record<string, unknown>;
  const validationResult = (scanMeta.validation_result ?? {}) as Record<string, unknown>;
  const declAddedPages = Number(validationResult.declared_added_pages ?? 0);

  if (sourceDoc.page_count != null && scanDoc.page_count != null) {
    const expectedPages = sourceDoc.page_count + declAddedPages;
    if (scanDoc.page_count !== expectedPages) {
      throw new Error(
        `Reconciliación de páginas fallida: escaneo tiene ${scanDoc.page_count} páginas, ` +
        `se esperaban ${expectedPages} (${sourceDoc.page_count} del original + ${declAddedPages} adicionales). ` +
        `Corrija el valor de páginas adicionales y vuelva a subir.`,
      );
    }
  }

  const reqHeaders = await headers();
  const ipAddress =
    reqHeaders.get("x-real-ip") ??
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const userAgent = reqHeaders.get("user-agent") ?? null;

  const attestationTextHash = computeSha256(Buffer.from(ATTESTATION_TEXT_ES, "utf-8"));

  const { error } = await admin.from("notary_attestations").insert({
    packet_id: packetId,
    notary_id: user.id,
    source_signed_document_id: sourceDoc.id,
    notarial_scan_document_id: scanDoc.id,
    source_document_hash: sourceDoc.file_hash ?? "",
    notarial_scan_hash: scanDoc.file_hash ?? "",
    attestation_data: attestationData as unknown as Json,
    attestation_text_version: ATTESTATION_TEXT_VERSION,
    attestation_text: ATTESTATION_TEXT_ES,
    attestation_text_hash: attestationTextHash,
    ip_address: ipAddress ?? undefined,
    user_agent: userAgent ?? undefined,
  });

  if (error) {
    if (error.message?.includes("idx_notary_attestations_one_per_scan")) {
      throw new Error("Ya existe una atestación para este escaneo");
    }
    throw new Error(`Error al registrar atestación: ${error.message}`);
  }

  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: user.id,
    action: "notary_attestation_submitted",
    metadata: {
      notarial_scan_document_id: scanDoc.id,
      source_signed_document_id: sourceDoc.id,
      attestation_text_version: ATTESTATION_TEXT_VERSION,
      notarial_scan_hash: scanDoc.file_hash,
      source_document_hash: sourceDoc.file_hash,
    },
  });

  revalidatePath(`/notario/paquetes/${packetId}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// 5. Prepare certification (creates report + prepared certification record)
// ---------------------------------------------------------------------------

export async function prepareNotarizedCertificationAction(
  packetId: string,
  notarialScanDocumentId: string,
  observations?: string,
) {
  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "awaiting_notary_seal",
  );

  const { error } = await admin.from("notary_workflow_jobs").insert({
    packet_id: packetId,
    job_type: "prepare_physical_certificate",
    idempotency_key: `physical-prepare:${packetId}:${notarialScanDocumentId}`,
    payload: {
      actor_id: user.id,
      notarial_scan_document_id: notarialScanDocumentId,
      observations: observations ?? null,
    },
  });

  if (error && error.code !== "23505") {
    throw new Error(`Error al encolar la preparación: ${error.message}`);
  }

  revalidatePath(`/notario/paquetes/${packetId}`);

  return { queued: true };
}

// ---------------------------------------------------------------------------
// 6. Finalize and publish
// ---------------------------------------------------------------------------

export async function finalizeNotarizedCertificationAction(
  packetId: string,
  certificationId: string,
) {
  const { user, admin } = await requirePhysicalSealContext(
    packetId,
    "awaiting_notary_seal",
  );

  const { error } = await admin.from("notary_workflow_jobs").insert({
    packet_id: packetId,
    certification_id: certificationId,
    job_type: "finalize_physical_certification",
    idempotency_key: `physical-finalize:${certificationId}`,
    payload: { actor_id: user.id },
  });

  if (error && error.code !== "23505") {
    throw new Error(`Error al encolar la publicación: ${error.message}`);
  }

  revalidatePath("/notario");
  revalidatePath(`/notario/paquetes/${packetId}`);
  revalidatePath("/agente");
  revalidatePath(`/agente/paquetes/${packetId}`);
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  revalidatePath("/arrendador/contratos");
  revalidatePath("/arrendatario/contratos");

  return { queued: true };
}

// ---------------------------------------------------------------------------
// Correction / rejection from awaiting_notary_seal
// ---------------------------------------------------------------------------

export async function returnForCorrectionFromSealAction(
  packetId: string,
  reason: string,
  correctionScope: import("@/lib/domain/types").CorrectionScope = "notary_observation",
) {
  const { returnForCorrectionAction } = await import("@/lib/actions/notary");
  return returnForCorrectionAction(packetId, reason, correctionScope);
}

export async function rejectFromSealAction(
  packetId: string,
  reason: string,
) {
  const { rejectAction } = await import("@/lib/actions/notary");
  return rejectAction(packetId, reason);
}
