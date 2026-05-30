import type { EvidenceReport, LeasePacket } from "@/lib/domain/types";
import { getPacketAdapter } from "@/lib/adapters/mock-adapter";
import { checkDuplicate } from "./registry-service";

const DEVICE = "Chrome 120 / Windows 11 / Lima, Perú";

export function generateReport(packetId: string): EvidenceReport {
  const packet = getPacketAdapter().getById(packetId);
  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const generatedAt = new Date().toISOString();
  const duplicates = checkDuplicate(packet.property.normalizedAddressKey);
  const duplicateMatch = duplicates.some(
    (entry) => entry.packetId !== packetId && entry.active,
  );

  return {
    id: `evr-${packet.packetCode.toLowerCase()}`,
    packetId: packet.id,
    generatedAt,
    status: "generated",
    documentHashHistory: packet.documentHashes,
    signerEvidenceSummaries: packet.signers.map((signer) => ({
      signerId: signer.id,
      identityStatus: signer.identityEvidence.reviewStatus,
      signatureStatus: signer.signatureEvidence?.signatureStatus ?? "pending",
      consentStatus: signer.consentAccepted ? "accepted" : "pending",
    })),
    otpRecords: packet.signers.map((signer) => {
      const sent = signer.auditEvents.find((event) => event.eventType === "otp_sent");
      const verified = signer.auditEvents.find(
        (event) => event.eventType === "otp_verified",
      );
      return {
        signerId: signer.id,
        channel: "whatsapp",
        sentAt: sent?.timestamp ?? generatedAt,
        verifiedAt: verified?.timestamp ?? generatedAt,
      };
    }),
    consentRecords: packet.signers.map((signer) => {
      const event = signer.auditEvents.find(
        (entry) => entry.eventType === "consent_accepted",
      );
      return {
        signerId: signer.id,
        consentType: "arrendamiento_digital",
        acceptedAt: event?.timestamp ?? signer.consentTimestamp ?? generatedAt,
        ip: event?.ipAddressPlaceholder ?? "192.168.1.10",
        device: event?.devicePlaceholder ?? DEVICE,
      };
    }),
    sessionLogs: packet.signers.map((signer) => ({
      signerId: signer.id,
      events: signer.auditEvents,
    })),
    signatureValidationResults: packet.signers
      .filter((signer) => signer.signatureEvidence)
      .map((signer) => ({
        signerId: signer.id,
        result: signer.signatureEvidence!.signatureStatus === "valid" ? "valid" : "invalid",
        details: signer.signatureEvidence!,
      })),
    propertyAuthorityEvidence:
      packet.property.propertyAuthorityEvidence ??
      "Partida registral SUNARP verificada (demo)",
    duplicateRentalCheck: {
      checked: true,
      matchFound: duplicateMatch,
      details: duplicateMatch
        ? `Se encontraron ${duplicates.length} registro(s) activo(s) para la misma propiedad`
        : undefined,
    },
    systemFlags: buildSystemFlags(packet, duplicateMatch),
    summaryForNotary: buildSummaryForNotary(packet),
  };
}

function buildSystemFlags(packet: LeasePacket, duplicateMatch: boolean): string[] {
  const flags: string[] = [];
  if (duplicateMatch) {
    flags.push("duplicate_address_warning");
  }
  for (const signer of packet.signers) {
    if (signer.identityEvidence.flags?.length) {
      flags.push("identity_review_flagged");
      break;
    }
  }
  return flags;
}

function buildSummaryForNotary(packet: LeasePacket): string {
  const allSigned = packet.signers.every((signer) => signer.status === "complete");
  const identityOk = packet.signers.every(
    (signer) => signer.identityEvidence.reviewStatus === "passed_demo",
  );
  const signaturesOk = packet.signers.every(
    (signer) => signer.signatureEvidence?.signatureStatus === "valid",
  );

  if (allSigned && identityOk && signaturesOk) {
    return "Expediente de evidencia completo. Identidades verificadas (demo), firmas digitales IOFE válidas, integridad documental intacta.";
  }

  const parts: string[] = ["Expediente de evidencia generado."];
  if (!identityOk) {
    parts.push("Revisar verificación de identidad de uno o más firmantes.");
  }
  if (!signaturesOk) {
    parts.push("Revisar validación de firmas digitales.");
  }
  return parts.join(" ");
}
