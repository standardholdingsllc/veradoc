import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getDocumentHashTimeline } from "@/lib/utils/document-hash";
import type { EvidenceReportData } from "@/lib/pdf/types";

export async function collectEvidenceData(
  packetId: string,
): Promise<EvidenceReportData> {
  const admin = createAdminClient();

  const { data: packet, error: packetError } = await admin
    .from("lease_packets")
    .select("*")
    .eq("id", packetId)
    .single();

  if (packetError || !packet) {
    throw new Error(`Paquete no encontrado: ${packetId}`);
  }

  const [
    { data: signers },
    { data: auditLog },
    hashTimeline,
    dupResult,
  ] = await Promise.all([
    admin
      .from("packet_signers")
      .select(
        "*, signer_evidence(*), signature_records(*)",
      )
      .eq("packet_id", packetId)
      .order("created_at"),
    admin
      .from("packet_audit_log")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at"),
    getDocumentHashTimeline(packetId, admin),
    admin.rpc("check_duplicate_lease", {
      p_property_address: packet.property_address ?? "",
      p_property_unit: packet.property_unit ?? null,
      p_lease_start: packet.lease_start_date ?? "",
      p_lease_end: packet.lease_end_date ?? "",
    }),
  ]);

  const signerRows = signers ?? [];
  const auditRows = auditLog ?? [];
  const dupRow = (dupResult.data as Record<string, unknown>[])?.[0];
  const overlapCount = (dupRow?.overlap_count as number) ?? 0;

  const signerEvidenceSummaries = signerRows.map((s) => {
    const evidenceTypes = new Set(
      ((s.signer_evidence as Record<string, unknown>[]) ?? []).map(
        (e) => e.evidence_type as string,
      ),
    );
    const hasIdentity =
      evidenceTypes.has("dni_front") &&
      evidenceTypes.has("dni_back") &&
      evidenceTypes.has("selfie");
    const sigRecord = (s.signature_records as Record<string, unknown>[])?.[0];
    const hasSigned = sigRecord?.signature_valid === true;
    const hasConsent = evidenceTypes.has("consent_record");

    return {
      signerName: s.signer_full_name,
      signerDni: s.signer_dni,
      roleInLease: s.role_in_lease === "landlord" ? "Arrendador" : "Arrendatario",
      identityStatus: hasIdentity ? "verified" : "pending",
      signatureStatus: hasSigned ? "valid" : s.status === "signed" ? "signed" : "pending",
      consentStatus: hasConsent ? "accepted" : "pending",
    };
  });

  const otpRecords = signerRows.map((s) => {
    const otpEvidence = ((s.signer_evidence as Record<string, unknown>[]) ?? []).find(
      (e) => e.evidence_type === "whatsapp_otp",
    );
    const meta = (otpEvidence?.metadata ?? {}) as Record<string, string>;
    return {
      signerName: s.signer_full_name,
      channel: "WhatsApp",
      sentAt: meta.sentAt ?? s.created_at ?? new Date().toISOString(),
      verifiedAt:
        s.status !== "invited"
          ? meta.verifiedAt ?? s.created_at ?? null
          : null,
    };
  });

  const consentRecords = signerRows.map((s) => {
    const consentEvidence = ((s.signer_evidence as Record<string, unknown>[]) ?? []).find(
      (e) => e.evidence_type === "consent_record",
    );
    const meta = (consentEvidence?.metadata ?? {}) as Record<string, string>;
    return {
      signerName: s.signer_full_name,
      consentType: "arrendamiento_digital",
      acceptedAt: meta.acceptedAt ?? s.created_at ?? new Date().toISOString(),
      ip: meta.ipAddress ?? "N/A",
      device: meta.userAgent ?? "N/A",
    };
  });

  const signatureValidationResults = signerRows
    .filter(
      (s) =>
        (s.signature_records as Record<string, unknown>[])?.length > 0,
    )
    .map((s) => {
      const rec = (s.signature_records as Record<string, unknown>[])[0];
      return {
        signerName: s.signer_full_name,
        certificateSubject: (rec.certificate_subject as string) ?? null,
        certificateIssuer: (rec.certificate_issuer as string) ?? null,
        certificateSerial: (rec.certificate_serial as string) ?? null,
        certificateValidFrom: (rec.certificate_valid_from as string) ?? null,
        certificateValidTo: (rec.certificate_valid_to as string) ?? null,
        chainValidationResult: (rec.chain_validation_result as string) ?? null,
        revocationResult: (rec.revocation_result as string) ?? null,
        timestampResult: (rec.timestamp_result as string) ?? null,
        signatureValid: (rec.signature_valid as boolean) ?? null,
        pdfIntegrityValid: (rec.pdf_integrity_valid as boolean) ?? null,
        signedDocumentHash: (rec.signed_document_hash as string) ?? null,
        signedAt: (rec.created_at as string) ?? null,
        providerName: (rec.provider_name as string) ?? undefined,
        verificationUrl: (rec.verification_url as string) ?? undefined,
        providerSignedAt: (rec.provider_signed_at as string) ?? undefined,
      };
    });

  const sessionLogs = signerRows.map((s) => {
    const signerEvents = auditRows
      .filter((a) => {
        const meta = a.metadata as Record<string, unknown> | null;
        return (
          meta?.signer_id === s.id ||
          meta?.signerName === s.signer_full_name
        );
      })
      .map((a) => ({
        type: a.action,
        timestamp: a.created_at ?? new Date().toISOString(),
        metadata: a.metadata as Record<string, unknown> | undefined,
      }));
    return {
      signerName: s.signer_full_name,
      events: signerEvents,
    };
  });

  const systemFlags: string[] = [];
  if (overlapCount > 0) {
    systemFlags.push("duplicate_address_warning");
  }

  const allSigned = signerRows.every(
    (s) => s.status === "signed" || s.status === "complete",
  );
  const allIdentityOk = signerEvidenceSummaries.every(
    (s) => s.identityStatus === "verified",
  );
  const allSignaturesValid = signatureValidationResults.every(
    (s) => s.signatureValid === true,
  );

  let summaryForNotary: string;
  if (allSigned && allIdentityOk && allSignaturesValid) {
    summaryForNotary =
      "Expediente de evidencia completo. Identidades verificadas, firmas digitales válidas, integridad documental intacta.";
  } else {
    const parts = ["Expediente de evidencia generado."];
    if (!allIdentityOk) {
      parts.push("Revisar verificación de identidad de uno o más firmantes.");
    }
    if (!allSignaturesValid) {
      parts.push("Revisar validación de firmas digitales.");
    }
    summaryForNotary = parts.join(" ");
  }

  return {
    packetId,
    packetCode: packet.packet_code ?? packetId.slice(0, 12),
    generatedAt: new Date().toISOString(),
    propertyAddress: packet.property_address ?? "",
    propertyUnit: packet.property_unit ?? undefined,
    district: packet.district ?? undefined,
    province: packet.province ?? undefined,
    documentHashHistory: hashTimeline.map((h) => ({
      stage: h.stage,
      algorithm: h.algorithm,
      hash: h.hash,
      timestamp: h.timestamp,
      actorId: h.actorId,
    })),
    signerEvidenceSummaries,
    otpRecords,
    consentRecords,
    signatureValidationResults,
    sessionLogs,
    propertyAuthorityEvidence: "Verificación pendiente de integración SUNARP",
    duplicateRentalCheck: {
      checked: true,
      matchFound: overlapCount > 0,
      overlapCount,
      details:
        overlapCount > 0
          ? `Se encontraron ${overlapCount} arrendamiento(s) activo(s) superpuesto(s)`
          : undefined,
    },
    systemFlags,
    summaryForNotary,
  };
}
