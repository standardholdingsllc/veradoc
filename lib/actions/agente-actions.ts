"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSha256 } from "@/lib/utils/document-hash";
import { buildSigningLink } from "@/lib/utils/url";
import { deliverSigningLink } from "@/lib/services/signing-link-delivery";
import {
  findCoveredProvince,
  normalizeCoverageText,
} from "@/lib/coverage/normalize";
import {
  createPacketSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "@/lib/schemas/packet-schemas";
import { notifyPacketSubmittedToNotary } from "@/lib/services/notifications";

type ActionResult<T = null> = { error?: string; data?: T };

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Upload Lease Document
// ---------------------------------------------------------------------------

async function verifyCanonicalUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  expectedHash: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(storagePath);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Objeto no encontrado." };
  }

  const actualHash = computeSha256(Buffer.from(await data.arrayBuffer()));
  if (actualHash !== expectedHash) {
    return { ok: false, error: "El archivo almacenado no coincide con la reserva." };
  }
  return { ok: true };
}

export async function uploadLeaseDocument(
  formData: FormData,
): Promise<ActionResult<{ storagePath: string; fileHash: string; packetId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) return { error: "No autenticado." };

  const file = formData.get("file") as File | null;
  const packetIdValue = formData.get("packetId");
  if (!file) return { error: "Archivo requerido." };
  if (
    typeof packetIdValue !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packetIdValue)
  ) {
    return { error: "Identificador de carga inválido." };
  }

  if (file.type !== "application/pdf") {
    return { error: "Solo se aceptan archivos PDF." };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "El archivo excede el límite de 50 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const header = buffer.subarray(0, 5).toString("ascii");
  if (header !== "%PDF-") {
    return { error: "El archivo no es un PDF válido." };
  }
  const trailer = buffer.subarray(-1024).toString("ascii");
  if (!trailer.includes("%%EOF")) {
    return { error: "El archivo PDF parece estar corrupto o truncado." };
  }

  try {
    await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    return { error: "El archivo PDF está dañado y no se puede procesar." };
  }

  const fileHash = computeSha256(buffer);
  const packetId = packetIdValue;
  const storagePath = `packets/${packetId}/lease_original.pdf`;

  const { error: reservationError } = await supabase.rpc(
    "reserve_lease_packet_upload",
    { p_packet_id: packetId, p_document_hash: fileHash },
  );
  if (reservationError) {
    const conflict = reservationError.message.includes("reservation_conflict");
    return {
      error: conflict
        ? "La reserva de carga entra en conflicto con otro archivo."
        : "No se pudo reservar la carga del documento.",
    };
  }

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  const verification = await verifyCanonicalUpload(
    supabase,
    storagePath,
    fileHash,
  );
  if (!verification.ok) {
    if (uploadError) {
      return { error: `Error al subir: ${uploadError.message}` };
    }
    return { error: verification.error };
  }

  const admin = createAdminClient();
  const { error: stateError } = await admin.rpc("mark_lease_packet_uploaded", {
    p_packet_id: packetId,
    p_actor_id: userId,
    p_document_hash: fileHash,
  });
  if (stateError) {
    return { error: "El documento se cargó, pero no se pudo confirmar. Vuelva a intentarlo." };
  }

  return { data: { storagePath, fileHash, packetId } };
}

// ---------------------------------------------------------------------------
// Create Lease Packet
// ---------------------------------------------------------------------------

export async function createLeasePacket(
  input: unknown,
): Promise<ActionResult<{ packetId: string }>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = createPacketSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = await createClient();
  // Duplicate check
  const { data: dupResult } = await supabase.rpc("check_duplicate_lease", {
    p_property_address: data.property.address,
    p_property_unit: data.property.unit ?? "",
    p_lease_start: data.leaseTerms.startDate,
    p_lease_end: data.leaseTerms.expirationDate,
  });

  if (dupResult && dupResult.length > 0 && dupResult[0].overlap_count > 0) {
    return { error: "Se encontró un arrendamiento activo que se superpone con estas fechas." };
  }

  const { data: coverageRows, error: coverageError } = await supabase
    .from("notary_coverage")
    .select("province")
    .eq("active", true);

  if (coverageError) {
    return { error: "No se pudo validar la cobertura notarial." };
  }

  const coveredProvince = findCoveredProvince(
    data.property.province,
    coverageRows?.map((row) => row.province) ?? [],
  );

  if (!coveredProvince) {
    return { error: "No hay cobertura notarial en esta provincia." };
  }

  const propertyProvince = normalizeCoverageText(coveredProvince);
  const propertyDepartment = normalizeCoverageText(data.property.department);

  const { error: finalizeError } = await supabase.rpc("finalize_lease_packet", {
    p_packet_id: data.packetId,
    p_property_address: data.property.address,
    p_property_unit: data.property.unit ?? "",
    p_district: data.property.district,
    p_province: propertyProvince,
    p_department: propertyDepartment,
    p_rental_amount: data.leaseTerms.monthlyRent,
    p_deposit_amount: data.leaseTerms.depositAmount,
    p_lease_start: data.leaseTerms.startDate,
    p_lease_end: data.leaseTerms.expirationDate,
    p_signers: data.signers.map((signer) => ({
      role_in_lease: signer.roleInLease,
      signer_email: signer.email,
      signer_full_name: signer.fullName,
      signer_dni: signer.dni,
      signer_whatsapp: signer.whatsapp,
    })),
  });

  if (finalizeError) {
    return { error: `Error al finalizar paquete: ${finalizeError.message}` };
  }

  revalidatePath("/agente");
  return { data: { packetId: data.packetId } };
}

// ---------------------------------------------------------------------------
// Confirm Payment
// ---------------------------------------------------------------------------

export async function confirmPacketPayment(
  paymentId: string,
): Promise<ActionResult> {
  const { isDemoPaymentsEnabled } = await import("@/lib/env/server");
  if (!isDemoPaymentsEnabled()) {
    return { error: "Pagos de demostración no están habilitados en este entorno." };
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id, packet_id, realtor_id, amount_centimos, currency, status, payment_provider")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.realtor_id !== userId) return { error: "Pago no encontrado." };
  if (payment.payment_provider !== "demo") {
    return { error: "El pago no es de demostración." };
  }
  if (payment.status === "completed") return {};
  if (payment.status !== "prepared") {
    return { error: `Estado de pago no permite confirmación: ${payment.status}` };
  }
  if (payment.amount_centimos == null) {
    return { error: "El pago no tiene un monto comercial válido." };
  }

  const { data, error } = await admin.rpc("process_commercial_payment_success", {
    p_payment_id: payment.id,
    p_payment_provider: "demo",
    p_provider_payment_id: `demo-${payment.id}`,
    p_provider_amount_centimos: payment.amount_centimos,
    p_provider_currency: payment.currency,
    p_payment_method: "demo",
    p_actor_id: userId,
    p_processing_fee_centimos: 0,
  });

  if (error) {
    console.error("[confirmPacketPayment] Commercial completion failed:", error);
    return { error: "No se pudo registrar el pago de demostración." };
  }
  const outcome = (data as { outcome?: string } | null)?.outcome;
  if (outcome !== "completed" && outcome !== "already_completed_same_payment") {
    return { error: `No se pudo completar el pago: ${outcome ?? "resultado desconocido"}.` };
  }

  revalidatePath("/agente");
  return {};
}

// ---------------------------------------------------------------------------
// Send Signing Links
// ---------------------------------------------------------------------------

export async function sendSigningLinksAction(
  packetId: string,
): Promise<ActionResult<{ links: { name: string; role: string; url: string }[] }>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify ownership and get packet details for delivery templates
  const { data: packet } = await supabase
    .from("lease_packets")
    .select("id, status, property_address, packet_code")
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Paquete no encontrado." };

  // Payment gate: require completed payment before link generation
  const { data: payment, error: paymentErr } = await admin
    .from("payments")
    .select("id, status")
    .eq("packet_id", packetId)
    .eq("status", "completed")
    .maybeSingle();

  if (paymentErr) {
    return { error: "Error al verificar el estado del pago." };
  }
  if (!payment) {
    return { error: "El paquete requiere un pago confirmado antes de enviar los enlaces." };
  }
  if (packet.status !== "draft") {
    return { error: "Los enlaces de firma ya fueron enviados para este paquete." };
  }

  // Get realtor name for the delivery template
  const { data: realtorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const realtorName = realtorProfile?.full_name ?? "Tu agente inmobiliario";

  // Fetch signers (single query with all needed fields)
  const { data: signers } = await supabase
    .from("packet_signers")
    .select("id, signer_full_name, signer_email, signer_whatsapp, signer_dni, role_in_lease")
    .eq("packet_id", packetId);

  if (!signers || signers.length === 0) {
    return { error: "No hay firmantes registrados." };
  }

  // Step 0: Revoke orphaned tokens from a prior failed attempt
  await admin
    .from("signing_tokens")
    .update({ status: "revoked" })
    .eq("packet_id", packetId)
    .eq("status", "pending");

  // Step 1: Generate raw tokens and insert signing_tokens rows
  const signerTokenMap = new Map<string, string>();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

  for (const signer of signers) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const { data: tokenRow } = await admin
      .from("signing_tokens")
      .insert({
        token_hash: tokenHash,
        packet_id: packetId,
        signer_email: signer.signer_email,
        signer_whatsapp: signer.signer_whatsapp,
        signer_dni: signer.signer_dni,
        signer_full_name: signer.signer_full_name,
        role_in_lease: signer.role_in_lease,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (tokenRow) {
      await admin
        .from("packet_signers")
        .update({ signing_token_id: tokenRow.id })
        .eq("id", signer.id);
    }

    signerTokenMap.set(signer.id, rawToken);
  }

  // Step 2: Create FirmEasy document (if configured)
  const { getFirmEasyClient } = await import("@/lib/services/firmeasy");
  const { isFirmEasyConfigured, serverEnv: feEnv } = await import("@/lib/env/server");
  const firmeasyClient = getFirmEasyClient();

  if (!firmeasyClient && isFirmEasyConfigured()) {
    return { error: "Error interno al conectar con el servicio de firma." };
  }

  if (!firmeasyClient) {
    const allowStub =
      process.env.NODE_ENV === "development" || feEnv.FIRMEASY_ALLOW_DEV_STUB;
    if (!allowStub) {
      return { error: "Firma digital no configurada. Contacte al administrador." };
    }
  }

  if (firmeasyClient) {
    const { parseWhatsappForFirmEasy } = await import("@/lib/services/firmeasy/normalize");
    const { buildSigningCompletionUrl } = await import("@/lib/routing/origins");

    // Download the lease PDF from storage
    const { data: leaseDoc } = await admin
      .from("packet_documents")
      .select("storage_path")
      .eq("packet_id", packetId)
      .eq("document_type", "lease_original")
      .single();

    if (!leaseDoc?.storage_path) {
      return { error: "Documento de arrendamiento no encontrado." };
    }

    const { data: pdfData } = await admin.storage
      .from("documents")
      .download(leaseDoc.storage_path);

    if (!pdfData) {
      return { error: "Error al descargar documento de arrendamiento." };
    }

    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer());
    const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const signerParams = signers.map((s) => {
      const rawToken = signerTokenMap.get(s.id)!;
      const { country_code, phone } = parseWhatsappForFirmEasy(s.signer_whatsapp);
      return {
        name: s.signer_full_name,
        email: s.signer_email,
        country_code,
        phone,
        external_id: s.id,
        standard_flow: ["holographic_signature" as const, "otp_whatsapp" as const],
        redirect_link: buildSigningCompletionUrl(rawToken),
      };
    });

    const doc = await firmeasyClient.createDocument({
      name: `Contrato ${packet.packet_code ?? packetId.slice(0, 12)}.pdf`,
      document_pdf_base64: pdfBuffer.toString("base64"),
      external_id: packetId,
      send_automatic_invitations: false,
      disable_signer_notifications: true,
      disable_owner_notifications: true,
      is_rejection_allowed: true,
      signature_deadline: deadlineDate.toISOString(),
      signers: signerParams,
    });

    // Store FirmEasy document token on the packet
    await admin
      .from("lease_packets")
      .update({
        firmeasy_document_token: doc.token,
        firmeasy_document_status: doc.status,
      } as never)
      .eq("id", packetId);

    // Store per-signer FirmEasy tokens/links
    for (const feSigner of doc.signers) {
      await admin
        .from("packet_signers")
        .update({
          firmeasy_signer_token: feSigner.token,
          firmeasy_signer_link: feSigner.link,
          firmeasy_signer_status: feSigner.status,
        } as never)
        .eq("id", feSigner.external_id);
    }
  }

  // Step 3: Deliver signing links (only after FirmEasy succeeds or when unconfigured)
  const links: { name: string; role: string; url: string }[] = [];

  for (const signer of signers) {
    const rawToken = signerTokenMap.get(signer.id)!;
    const signingUrl = buildSigningLink(rawToken);

    deliverSigningLink({
      signerName: signer.signer_full_name,
      signerEmail: signer.signer_email,
      signerWhatsapp: signer.signer_whatsapp,
      signingUrl,
      packetId,
      realtorName,
      propertyAddress: packet.property_address ?? "",
      expiresAt,
    }).catch((err) =>
      console.error("[sendSigningLinksAction] Delivery error:", err),
    );

    links.push({
      name: signer.signer_full_name,
      role: signer.role_in_lease === "landlord" ? "Arrendador" : "Arrendatario",
      url: signingUrl,
    });
  }

  // Step 4: Transition packet status to 'signing'
  const now = new Date().toISOString();
  await admin
    .from("lease_packets")
    .update({ status: "signing", updated_at: now })
    .eq("id", packetId);

  // Audit log
  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: userId,
    action: "signing_links_sent",
    metadata: {
      signer_count: String(signers.length),
      firmeasy_configured: String(!!firmeasyClient),
    },
  });

  revalidatePath("/agente");
  return { data: { links } };
}

// ---------------------------------------------------------------------------
// Submit to Notary
// ---------------------------------------------------------------------------

export async function submitToNotaryAction(
  packetId: string,
): Promise<ActionResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: packet } = await supabase
    .from("lease_packets")
    .select("id, status, province")
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Paquete no encontrado." };
  if (packet.status !== "all_signed") {
    return { error: "El paquete no está listo para enviar al notario." };
  }

  // Check notary coverage with the same normalization used by packet creation.
  const { data: activeCoverage } = await supabase
    .from("notary_coverage")
    .select("province, notary_id")
    .eq("active", true)
    .limit(1000);

  const coverage =
    activeCoverage?.find(
      (row) =>
        findCoveredProvince(packet.province ?? "", [row.province]) !== null,
    ) ?? null;

  if (!coverage) {
    return { error: "No hay cobertura notarial en esta provincia." };
  }

  const now = new Date().toISOString();

  // Insert notary assignment (admin -- admin-only INSERT policy)
  await admin.from("notary_assignments").insert({
    packet_id: packetId,
    notary_id: coverage.notary_id,
    assigned_at: now,
  });

  // Update status
  await admin
    .from("lease_packets")
    .update({
      status: "pending_notary",
      submitted_to_notary_at: now,
      updated_at: now,
    })
    .eq("id", packetId);

  // Audit log
  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: userId,
    action: "submitted_to_notary",
    metadata: { notary_id: coverage.notary_id },
  });

  // Notify assigned notary
  const { data: fullPacket } = await admin
    .from("lease_packets")
    .select("packet_code, property_address")
    .eq("id", packetId)
    .single();

  const { data: notaryProfile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", coverage.notary_id)
    .single();

  const { data: realtorProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  if (notaryProfile?.email && fullPacket) {
    void notifyPacketSubmittedToNotary({
      notaryEmail: notaryProfile.email,
      notaryName: notaryProfile.full_name ?? "",
      packetCode: fullPacket.packet_code ?? "",
      packetId,
      propertyAddress: fullPacket.property_address ?? "",
      realtorName: realtorProfile?.full_name ?? "",
    });
  }

  revalidatePath("/agente");
  revalidatePath(`/agente/paquetes/${packetId}`);
  revalidatePath("/arrendador");
  revalidatePath("/arrendatario");
  return {};
}

// ---------------------------------------------------------------------------
// Generate Evidence Report
// ---------------------------------------------------------------------------

export async function generateEvidenceReportAction(
  packetId: string,
): Promise<ActionResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: packet } = await supabase
    .from("lease_packets")
    .select("id, status")
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Paquete no encontrado." };
  if (packet.status !== "all_signed") {
    return { error: "El paquete no está en el estado correcto." };
  }

  try {
    const { collectEvidenceData } = await import(
      "@/lib/services/evidence-data-collector"
    );
    const { generateAndStoreEvidenceReport } = await import(
      "@/lib/pdf/generate-evidence-report"
    );

    const reportData = await collectEvidenceData(packetId);
    const { storagePath, fileHash } = await generateAndStoreEvidenceReport(
      packetId,
      reportData,
      userId,
    );

    const now = new Date().toISOString();
    await admin
      .from("lease_packets")
      .update({ updated_at: now })
      .eq("id", packetId);

    await admin.from("packet_audit_log").insert({
      packet_id: packetId,
      actor_id: userId,
      action: "evidence_report_generated",
      metadata: {
        storage_path: storagePath,
        file_hash: fileHash,
      },
    });

    revalidatePath(`/agente/paquetes/${packetId}`);
    return {};
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Error al generar informe de evidencia.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Get Document Download URL
// ---------------------------------------------------------------------------

export async function getDocumentDownloadUrl(
  packetId: string,
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  const {
    authorizeDownload,
    UUID_RE,
    PHYSICAL_ARTIFACT_TYPES,
  } = await import("@/lib/domain/download-authorization");

  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  if (!UUID_RE.test(documentId)) {
    return { error: "Se requiere un ID de documento válido." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: doc } = await supabase
    .from("packet_documents")
    .select("id, storage_path, document_type, status, file_hash")
    .eq("id", documentId)
    .eq("packet_id", packetId)
    .single();

  let packetStatus = "";
  let publishedCert: {
    notarial_scan_document_id: string | null;
    certification_report_document_id: string | null;
  } | null = null;

  if (doc && PHYSICAL_ARTIFACT_TYPES.has(doc.document_type)) {
    const { data: packet } = await admin
      .from("lease_packets")
      .select("status")
      .eq("id", packetId)
      .single();
    packetStatus = packet?.status ?? "";

    const { data: cert } = await admin
      .from("notary_certifications")
      .select("id, notarial_scan_document_id, certification_report_document_id")
      .eq("packet_id", packetId)
      .eq("publication_status", "published")
      .maybeSingle();
    publishedCert = cert;
  }

  const authz = authorizeDownload(documentId, doc, packetStatus, publishedCert);

  if (!authz.allowed) {
    const messages: Record<string, string> = {
      invalid_uuid: "Se requiere un ID de documento válido.",
      not_found: "Documento no encontrado.",
      non_distributable: "Tipo de documento no descargable.",
      not_accepted: "Documento no disponible.",
      packet_not_certified: "Documento no disponible hasta que el paquete esté certificado.",
      no_published_cert: "No se encontró certificación publicada.",
      scan_not_matching_cert: "Documento no corresponde a la certificación publicada.",
      report_not_matching_cert: "Documento no corresponde a la certificación publicada.",
    };
    return { error: messages[authz.reason] };
  }

  const { data: signed } = await admin.storage
    .from("documents")
    .createSignedUrl(doc!.storage_path, 300);

  if (!signed?.signedUrl) {
    return { error: "Error al generar URL de descarga." };
  }

  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: userId,
    action: "document_downloaded",
    metadata: {
      document_id: doc!.id,
      document_type: doc!.document_type,
      file_hash: doc!.file_hash,
      storage_path: doc!.storage_path,
    },
  });

  return { data: { url: signed.signedUrl } };
}

// ---------------------------------------------------------------------------
// Update Profile
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      company_name: parsed.data.company_name ?? null,
      ruc: parsed.data.ruc ?? null,
    })
    .eq("id", userId);

  if (error) {
    return { error: `Error al actualizar perfil: ${error.message}` };
  }

  revalidatePath("/agente/perfil");
  revalidatePath("/agente");
  return {};
}

// ---------------------------------------------------------------------------
// Change Password
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword,
    newPassword,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { error: "No autenticado." };

  // Verify current password with a fresh sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    return { error: "Contraseña actual incorrecta." };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: `Error al cambiar contraseña: ${updateError.message}` };
  }

  return {};
}
