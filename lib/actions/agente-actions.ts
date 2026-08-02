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

function normalizeAddressKey(
  address: string,
  unit: string | undefined,
  district: string,
): string {
  return [address, unit, district]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Upload Lease Document
// ---------------------------------------------------------------------------

export async function uploadLeaseDocument(
  formData: FormData,
): Promise<ActionResult<{ storagePath: string; fileHash: string; packetId: string }>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Archivo requerido." };

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
  const packetId = crypto.randomUUID();
  const storagePath = `packets/${packetId}/lease_original.pdf`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Error al subir: ${uploadError.message}` };
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
  const admin = createAdminClient();

  // Duplicate check
  const { data: dupResult } = await supabase.rpc("check_duplicate_lease", {
    p_property_address: data.property.address,
    p_property_unit: data.property.unit ?? null,
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

  // Insert lease_packets (session client -- RLS: created_by = auth.uid())
  const { error: packetError } = await supabase.from("lease_packets").insert({
    id: data.packetId,
    created_by: userId,
    status: "draft",
    property_address: data.property.address,
    property_unit: data.property.unit ?? null,
    district: data.property.district,
    province: propertyProvince,
    department: propertyDepartment,
    rental_amount: data.leaseTerms.monthlyRent,
    deposit_amount: data.leaseTerms.depositAmount,
    lease_start_date: data.leaseTerms.startDate,
    lease_end_date: data.leaseTerms.expirationDate,
    document_hash: data.fileHash,
  });

  if (packetError) {
    return { error: `Error al crear paquete: ${packetError.message}` };
  }

  // Insert signers (session client -- RLS: packet_id in own packets)
  const signerRows = data.signers.map((s) => ({
    packet_id: data.packetId,
    role_in_lease: s.roleInLease,
    signer_email: s.email,
    signer_full_name: s.fullName,
    signer_dni: s.dni,
    signer_whatsapp: s.whatsapp,
    status: "invited",
  }));

  const { error: signerError } = await supabase
    .from("packet_signers")
    .insert(signerRows);

  if (signerError) {
    return { error: `Error al agregar firmantes: ${signerError.message}` };
  }

  // Insert document record (session client)
  await supabase.from("packet_documents").insert({
    packet_id: data.packetId,
    document_type: "lease_original",
    storage_path: data.storagePath,
    file_hash: data.fileHash,
    uploaded_by: userId,
  });

  // Audit log (admin client -- service_role only)
  await admin.from("packet_audit_log").insert({
    packet_id: data.packetId,
    actor_id: userId,
    action: "packet_created",
    metadata: {
      property_address: data.property.address,
      normalized_key: normalizeAddressKey(
        data.property.address,
        data.property.unit,
        data.property.district,
      ),
    },
  });

  await admin.from("packet_audit_log").insert({
    packet_id: data.packetId,
    actor_id: userId,
    action: "document_hash_recorded",
    metadata: {
      stage: "initial_upload",
      algorithm: "SHA-256",
      hash: data.fileHash,
      storage_path: data.storagePath,
      document_type: "lease_original",
    },
  });

  revalidatePath("/agente");
  return { data: { packetId: data.packetId } };
}

// ---------------------------------------------------------------------------
// Confirm Payment
// ---------------------------------------------------------------------------

export async function confirmPacketPayment(
  packetId: string,
): Promise<ActionResult> {
  const { isDemoPaymentsEnabled } = await import("@/lib/env/server");
  if (!isDemoPaymentsEnabled()) {
    return { error: "Pagos de demostración no están habilitados en este entorno." };
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify ownership
  const { data: packet } = await supabase
    .from("lease_packets")
    .select("id, status")
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Paquete no encontrado." };
  if (packet.status !== "draft") {
    return { error: "El paquete ya no está en borrador." };
  }

  const now = new Date().toISOString();

  // Insert payment (admin -- service_role only)
  await admin.from("payments").insert({
    packet_id: packetId,
    realtor_id: userId,
    amount: 89.0,
    currency: "PEN",
    status: "completed",
    payment_provider_ref: "stub-payment",
    paid_at: now,
  });

  // Update status (admin -- beyond draft transitions need admin)
  await admin
    .from("lease_packets")
    .update({ status: "draft", updated_at: now })
    .eq("id", packetId);

  // Audit log
  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: userId,
    action: "payment_confirmed",
    metadata: { amount: "89.00", currency: "PEN" },
  });

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
    const { serverEnv } = await import("@/lib/env/server");
    const baseUrl = serverEnv.SITE_URL;

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
        redirect_link: `${baseUrl}/firma/${rawToken}/completado`,
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
  documentType: string,
): Promise<ActionResult<{ url: string }>> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("packet_documents")
    .select("storage_path")
    .eq("packet_id", packetId)
    .eq("document_type", documentType)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!doc) return { error: "Documento no encontrado." };

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300);

  if (!signed?.signedUrl) {
    return { error: "Error al generar URL de descarga." };
  }

  await admin.from("packet_audit_log").insert({
    packet_id: packetId,
    actor_id: userId,
    action: "document_downloaded",
    metadata: {
      document_type: documentType,
      storage_path: doc.storage_path,
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
