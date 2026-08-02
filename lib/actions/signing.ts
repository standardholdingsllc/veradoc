"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SupabaseSignerAdapter, SupabasePacketAdapter } from "@/lib/adapters/supabase-adapter";
import { getWhatsAppProvider } from "@/lib/services/whatsapp-service";
import {
  enforceTokenLookupRateLimit,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { assembleSignedDocument } from "@/lib/services/document-assembly-service";
import type { Json } from "@/lib/supabase/database.types";
import {
  notifySignerCompletion,
  notifyAllSignersComplete,
} from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  const bytes = crypto.randomBytes(3);
  const num = (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

async function resolveSignerFromToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const admin = createAdminClient();

  const { data: tokenRows, error } = await admin.rpc("lookup_signing_context", {
    p_token_hash: tokenHash,
  });
  if (error || !tokenRows || tokenRows.length === 0) {
    throw new Error("Enlace de firma inválido o expirado.");
  }
  const tokenRow = tokenRows[0];

  const { data: signerRow } = await admin
    .from("packet_signers")
    .select("id, status, profile_id")
    .eq("packet_id", tokenRow.packet_id)
    .eq("signer_email", tokenRow.signer_email)
    .single();

  if (!signerRow) {
    throw new Error("Firmante no encontrado.");
  }

  return {
    tokenId: tokenRow.token_id,
    tokenHash,
    packetId: tokenRow.packet_id,
    signerEmail: tokenRow.signer_email,
    signerName: tokenRow.signer_full_name,
    roleInLease: tokenRow.role_in_lease,
    signerId: signerRow.id as string,
    signerStatus: signerRow.status as string,
    profileId: (signerRow.profile_id as string) ?? undefined,
    signerWhatsapp: (tokenRow as Record<string, unknown>).signer_whatsapp as string | undefined,
    signerDni: (tokenRow as Record<string, unknown>).signer_dni as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Open link / landing data
// ---------------------------------------------------------------------------

export type OpenLinkResult =
  | {
      data: {
        tokenId: string;
        packetId: string;
        signerEmail: string;
        signerName: string;
        roleInLease: string;
        tokenStatus: string;
      };
    }
  | { error: "expired" | "used" | "rate_limited" | "invalid"; message: string };

export async function openLinkAction(
  rawToken: string,
): Promise<OpenLinkResult> {
  const tokenHash = hashToken(rawToken);

  try {
    enforceTokenLookupRateLimit(tokenHash);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        error: "rate_limited",
        message:
          "Demasiados intentos. Por favor, intenta de nuevo en unos minutos.",
      };
    }
    throw err;
  }

  const adapter = new SupabaseSignerAdapter();
  const context = await adapter.lookupByTokenHash(tokenHash);

  if (!context) {
    return {
      error: "expired",
      message: "Este enlace ha expirado o no es válido.",
    };
  }

  if (
    context.tokenStatus === "expired" ||
    context.tokenStatus === "revoked"
  ) {
    return {
      error: "expired",
      message: "Este enlace ha expirado.",
    };
  }

  if (context.tokenStatus === "account_created") {
    return {
      error: "used",
      message: "Este enlace ya fue utilizado.",
    };
  }

  return { data: context };
}

// ---------------------------------------------------------------------------
// Step 2: WhatsApp OTP
// ---------------------------------------------------------------------------

export async function sendOtpAction(
  rawToken: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const admin = createAdminClient();

    // Rate limit: max 3 OTP sends in 10-minute window
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("signing_token_id", signer.tokenId)
      .gte("created_at", tenMinutesAgo);

    if ((count ?? 0) >= 3) {
      return { error: "Ha excedido el límite de envíos. Espere 10 minutos." };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await admin.from("otp_codes").insert({
      signing_token_id: signer.tokenId,
      otp_hash: otpHash,
    });

    const whatsapp = getWhatsAppProvider();
    const phone = signer.signerWhatsapp ?? "";
    const { messageId } = await whatsapp.sendOtp(phone, otp);

    const signerAdapter = new SupabaseSignerAdapter();
    await signerAdapter.insertEvidence(signer.signerId, {
      type: "whatsapp_otp",
      metadata: {
        phone,
        sentAt: new Date().toISOString(),
        messageId,
      },
    });

    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar OTP.";
    return { error: message };
  }
}

export async function verifyOtpSubmission(
  rawToken: string,
  submittedOtp: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const admin = createAdminClient();

    // Find the most recent non-expired, non-verified OTP
    const { data: codes } = await admin
      .from("otp_codes")
      .select("id, otp_hash, expires_at")
      .eq("signing_token_id", signer.tokenId)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (!codes || codes.length === 0) {
      return { error: "Código expirado o no encontrado. Solicite uno nuevo." };
    }

    const latestCode = codes[0];
    const submittedHash = hashOtp(submittedOtp);

    if (submittedHash !== latestCode.otp_hash) {
      return { error: "Código incorrecto. Intente nuevamente." };
    }

    await admin
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", latestCode.id);

    // Advance signing_tokens status
    const signerAdapter = new SupabaseSignerAdapter();
    await signerAdapter.verifyOtp(signer.tokenHash);

    // Advance packet_signers status
    await signerAdapter.advanceStatus(signer.signerId, "otp_verified");

    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al verificar OTP.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 3: Advance signer status (generic)
// ---------------------------------------------------------------------------

export async function advanceSignerAction(
  signerId: string,
  newStatus: string,
  profileId?: string,
) {
  const adapter = new SupabaseSignerAdapter();
  await adapter.advanceStatus(signerId, newStatus, profileId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Step 4: Record consent
// ---------------------------------------------------------------------------

export async function recordConsentAction(
  rawToken: string,
  userAgent: string,
  consentVersion: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const signerAdapter = new SupabaseSignerAdapter();

    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      "unknown";

    await signerAdapter.insertEvidence(signer.signerId, {
      type: "consent_record",
      metadata: {
        consentVersion,
        ipAddress,
        userAgent,
        acceptedAt: new Date().toISOString(),
      },
    });

    await signerAdapter.advanceStatus(
      signer.signerId,
      "consent_given",
      signer.profileId,
    );

    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al registrar consentimiento.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 5: Identity upload
// ---------------------------------------------------------------------------

export async function uploadIdentityDocument(
  signerId: string,
  formData: FormData,
  docType: "dni_front" | "dni_back" | "selfie",
): Promise<{ storagePath?: string; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { error: "No se proporcionó archivo." };

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return { error: "Formato no válido. Use JPEG, PNG o WebP." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { error: "El archivo es demasiado grande (máximo 10 MB)." };
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `signers/${signerId}/${docType}.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      return { error: `Error al subir archivo: ${uploadError.message}` };
    }

    const signerAdapter = new SupabaseSignerAdapter();
    await signerAdapter.insertEvidence(signerId, {
      type: docType,
      storagePath,
    });

    return { storagePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al subir documento.";
    return { error: message };
  }
}

export async function completeIdentityUpload(
  rawToken: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const admin = createAdminClient();

    // Verify all 3 required evidence types exist
    const requiredTypes = ["dni_front", "dni_back", "selfie"];
    const { data: evidence } = await admin
      .from("signer_evidence")
      .select("evidence_type")
      .eq("packet_signer_id", signer.signerId)
      .in("evidence_type", requiredTypes);

    const uploadedTypes = new Set((evidence ?? []).map((e) => e.evidence_type));
    const missing = requiredTypes.filter((t) => !uploadedTypes.has(t));

    if (missing.length > 0) {
      return { error: `Faltan documentos: ${missing.join(", ")}` };
    }

    const signerAdapter = new SupabaseSignerAdapter();
    await signerAdapter.advanceStatus(
      signer.signerId,
      "identity_verified",
      signer.profileId,
    );

    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al completar verificación.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 6: Lease review
// ---------------------------------------------------------------------------

export async function getSignedDocumentUrl(
  packetId: string,
  documentType: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("packet_documents")
      .select("storage_path")
      .eq("packet_id", packetId)
      .eq("document_type", documentType)
      .single();

    if (!doc?.storage_path) {
      return { error: "Documento no encontrado." };
    }

    const supabase = await createClient();
    const { data: signedUrl } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 300);

    if (!signedUrl?.signedUrl) {
      return { error: "No se pudo generar enlace al documento." };
    }

    return { url: signedUrl.signedUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al obtener documento.";
    return { error: message };
  }
}

export async function recordLeaseReviewAction(
  rawToken: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const packetAdapter = new SupabasePacketAdapter();
    await packetAdapter.insertAuditEvent(
      signer.packetId,
      signer.profileId ?? signer.signerId,
      "lease_reviewed",
      { signerName: signer.signerName, reviewedAt: new Date().toISOString() },
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al registrar revisión.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 7: Digital signature
// ---------------------------------------------------------------------------

export async function initiateSignatureAction(
  rawToken: string,
): Promise<{ sessionId?: string; embedUrl?: string; error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const admin = createAdminClient();

    // Look up the signer's FirmEasy link (columns added in migration 00014)
    const { data: signerRow } = await admin
      .from("packet_signers")
      .select("firmeasy_signer_link, firmeasy_signer_token" as never)
      .eq("id", signer.signerId)
      .single();

    const feRow = signerRow as { firmeasy_signer_link?: string; firmeasy_signer_token?: string } | null;
    if (feRow?.firmeasy_signer_link) {
      return {
        sessionId: feRow.firmeasy_signer_token ?? undefined,
        embedUrl: feRow.firmeasy_signer_link,
      };
    }

    // Fallback: dev stub ONLY in development or with explicit opt-in
    const { isFirmEasyConfigured, serverEnv } = await import("@/lib/env/server");
    if (!isFirmEasyConfigured()) {
      const allowStub =
        process.env.NODE_ENV === "development" || serverEnv.FIRMEASY_ALLOW_DEV_STUB;
      if (allowStub) {
        return {
          sessionId: `stub-session-${Date.now()}`,
          embedUrl: undefined,
        };
      }
      return { error: "Firma digital no configurada. Contacte al administrador." };
    }

    return { error: "Enlace de firma no disponible. Contacte a su agente." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al iniciar firma.";
    return { error: message };
  }
}

export async function completeSignatureAction(
  rawToken: string,
  sessionId: string,
): Promise<{ error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);

    // If already signed/complete (e.g. via FirmEasy webhook), return success
    if (signer.signerStatus === "signed" || signer.signerStatus === "complete") {
      return {};
    }

    // Dev stub path: ONLY when FirmEasy is not configured AND explicitly allowed
    const { isFirmEasyConfigured, serverEnv } = await import("@/lib/env/server");
    if (!isFirmEasyConfigured()) {
      const allowStub =
        process.env.NODE_ENV === "development" || serverEnv.FIRMEASY_ALLOW_DEV_STUB;
      if (!allowStub) {
        return { error: "Firma digital no configurada. Contacte al administrador." };
      }

      const signerAdapter = new SupabaseSignerAdapter();

      await signerAdapter.insertEvidence(signer.signerId, {
        type: "digital_signature",
        metadata: {
          sessionId,
          signedAt: new Date().toISOString(),
          provider: "dev-stub",
        },
      });

      await signerAdapter.advanceStatus(
        signer.signerId,
        "signed",
        signer.profileId,
      );

      return {};
    }

    // In production, signing completion is driven by FirmEasy webhook.
    // If the signer reaches this point but isn't signed yet, they should wait.
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al completar firma.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Step 8: Completion
// ---------------------------------------------------------------------------

export async function completeSigningAction(
  rawToken: string,
): Promise<{ allComplete?: boolean; error?: string }> {
  try {
    const signer = await resolveSignerFromToken(rawToken);
    const admin = createAdminClient();
    const signerAdapter = new SupabaseSignerAdapter();

    await signerAdapter.advanceStatus(
      signer.signerId,
      "complete",
      signer.profileId,
    );

    // Check if all signers for this packet are complete
    const { data: allSigners } = await admin
      .from("packet_signers")
      .select("status")
      .eq("packet_id", signer.packetId);

    const allComplete = (allSigners ?? []).every(
      (s) => s.status === "complete",
    );

    // Notify the signer who just completed
    const { data: signerRow } = await admin
      .from("packet_signers")
      .select("signer_full_name, signer_email, role_in_lease")
      .eq("id", signer.signerId)
      .single();

    const { data: packetRow } = await admin
      .from("lease_packets")
      .select("property_address, packet_code, created_by")
      .eq("id", signer.packetId)
      .single();

    if (signerRow?.signer_email && packetRow) {
      void notifySignerCompletion({
        email: signerRow.signer_email,
        signerName: signerRow.signer_full_name ?? "",
        propertyAddress: packetRow.property_address ?? "",
        roleInLease: (signerRow.role_in_lease as "landlord" | "renter") ?? "renter",
      });
    }

    if (allComplete) {
      const packetAdapter = new SupabasePacketAdapter();
      await packetAdapter.updateStatus(
        signer.packetId,
        "all_signed",
        signer.profileId ?? signer.signerId,
        "all_signers_complete",
      );

      // Notify realtor that all signers completed
      if (packetRow?.created_by) {
        const { data: realtorProfile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", packetRow.created_by)
          .single();

        if (realtorProfile?.email) {
          void notifyAllSignersComplete({
            realtorEmail: realtorProfile.email,
            realtorName: realtorProfile.full_name ?? "",
            packetCode: packetRow.packet_code ?? "",
            packetId: signer.packetId,
            propertyAddress: packetRow.property_address ?? "",
          });
        }
      }
    }

    revalidatePath("/arrendador");
    revalidatePath("/arrendatario");
    revalidatePath("/arrendador/contratos");
    revalidatePath("/arrendatario/contratos");

    return { allComplete };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al completar proceso.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Manual signed-PDF upload (MVP — admin or packet owner)
// ---------------------------------------------------------------------------

type ActionResult<T = null> = { error?: string; data?: T };

export async function uploadSignedDocumentAction(
  packetId: string,
  formData: FormData,
): Promise<ActionResult<{ storagePath: string; fileHash: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: packet } = await supabase
    .from("lease_packets")
    .select("id, status, created_by")
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Paquete no encontrado." };
  if (packet.status !== "signing") {
    return { error: "El paquete no está en estado de firma." };
  }

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Archivo requerido." };
  if (file.type !== "application/pdf") {
    return { error: "Solo se aceptan archivos PDF." };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "El archivo excede el límite de 50 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    return { error: "El archivo PDF está dañado y no se puede procesar." };
  }

  try {
    const result = await assembleSignedDocument(packetId, buffer, user.id);

    const admin = createAdminClient();
    await admin.rpc("transition_packet_status", {
      p_packet_id: packetId,
      p_new_status: "all_signed",
      p_actor_id: user.id,
      p_action: "signed_document_uploaded",
      p_metadata: {
        storage_path: result.storagePath,
        file_hash: result.fileHash,
      },
    });

    revalidatePath(`/agente/paquetes/${packetId}`);
    revalidatePath("/agente");
    revalidatePath("/arrendador");
    revalidatePath("/arrendatario");
    revalidatePath("/arrendador/contratos");
    revalidatePath("/arrendatario/contratos");
    return { data: result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al procesar documento firmado.";
    return { error: message };
  }
}
