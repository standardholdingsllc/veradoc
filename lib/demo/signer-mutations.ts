import type {
  AuditEvent,
  LeasePacket,
  SignatureEvidence,
  Signer,
} from "@/lib/domain/types";
import { canTransition, transition } from "@/lib/domain/packet-machine";
import { canTransitionSigner, transitionSigner } from "@/lib/domain/signer-machine";
import type { DemoSignerAction, DemoSnapshot } from "./types";

const DEVICE = "Demo compartida / navegador aislado";

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
function audit(packetId: string, signer: Signer, eventType: string, eventLabel: string): AuditEvent {
  return {
    id: nextId("aud"),
    packetId,
    actorId: signer.id,
    actorRole: signer.roleInLease,
    eventType,
    eventLabel,
    timestamp: new Date().toISOString(),
    ipAddressPlaceholder: "demo-redacted",
    devicePlaceholder: DEVICE,
  };
}

function signatureEvidence(signer: Signer, packet: LeasePacket): SignatureEvidence {
  const signedAt = new Date().toISOString();
  const documentHash =
    packet.finalSignedDocument?.hash ??
    packet.documentHashes.at(-1)?.hash ??
    packet.leaseDocument.initialHash;
  return {
    providerName: "Firma simulada VeraDoc Demo",
    signatureStatus: "valid",
    certificateSubject: `CN=${signer.fullName}, SERIALNUMBER=DEMO-${signer.dni}`,
    certificateIssuer: "CN=VeraDoc Demo CA, O=VeraDoc Demo, C=PE",
    certificateSerial: `DEMO-${crypto.randomUUID()}`,
    certificateValidityStart: "2024-01-01T00:00:00.000Z",
    certificateValidityEnd: "2030-01-01T00:00:00.000Z",
    certificateChainResult: "valid",
    revocationResult: "good",
    timestampResult: "valid",
    pdfIntegrityResult: "intact",
    signedAt,
    finalDocumentHash: documentHash,
  };
}

function transitionSignerState(
  packet: LeasePacket,
  signerIndex: number,
  event: Parameters<typeof transitionSigner>[1],
  label: string,
  updates: Partial<Signer> = {},
): void {
  const signer = packet.signers[signerIndex];
  if (!canTransitionSigner(signer.status, event)) {
    throw new Error("DEMO_SIGNER_INVALID_TRANSITION");
  }
  packet.signers[signerIndex] = {
    ...signer,
    ...updates,
    status: transitionSigner(signer.status, event),
    auditEvents: [...signer.auditEvents, audit(packet.id, signer, event.type, label)],
  };
  packet.updatedAt = new Date().toISOString();
}

function transitionPacket(
  packet: LeasePacket,
  event: Parameters<typeof transition>[1],
  label: string,
): void {
  if (!canTransition(packet.status, event)) return;
  packet.status = transition(packet.status, event);
  packet.auditEvents = [
    ...packet.auditEvents,
    {
      id: nextId("aud"),
      packetId: packet.id,
      actorId: "system",
      actorRole: "system",
      eventType: event.type,
      eventLabel: label,
      timestamp: new Date().toISOString(),
      ipAddressPlaceholder: "demo-redacted",
      devicePlaceholder: DEVICE,
    },
  ];
  packet.updatedAt = new Date().toISOString();
}

function syncPacket(packet: LeasePacket): void {
  const complete = packet.signers.filter((signer) => signer.status === "complete").length;
  if (complete > 0 && packet.status === "sent_to_signers") {
    transitionPacket(packet, { type: "signer_complete", actor: "system" }, "Firma completada");
  }
  if (complete !== packet.signers.length || complete === 0) return;
  transitionPacket(packet, { type: "all_signers_complete", actor: "system" }, "Todas las firmas completadas");
  const hash = packet.documentHashes.at(-1)?.hash ?? packet.leaseDocument.initialHash;
  const now = new Date().toISOString();
  packet.finalSignedDocument = {
    fileName: packet.leaseDocument.fileName.replace(".pdf", "-firmado.pdf"),
    hash,
    generatedAt: now,
  };
  if (!packet.documentHashes.some((entry) => entry.stage === "post_signatures")) {
    packet.documentHashes.push({
      hash,
      stage: "post_signatures",
      algorithm: "SHA-256",
      timestamp: now,
      actorId: "system",
    });
  }
}

export function applyDemoSignerAction(
  input: DemoSnapshot,
  packetId: string,
  signerId: string,
  action: DemoSignerAction,
): DemoSnapshot {
  const snapshot = structuredClone(input);
  const packet = snapshot.packets.find((entry) => entry.id === packetId);
  if (!packet) throw new Error("DEMO_PACKET_NOT_FOUND");
  const signerIndex = packet.signers.findIndex((entry) => entry.id === signerId);
  if (signerIndex < 0) throw new Error("DEMO_SIGNER_NOT_FOUND");
  const signer = packet.signers[signerIndex];

  switch (action.type) {
    case "open_link":
      if (signer.status !== "link_sent") return snapshot;
      transitionSignerState(packet, signerIndex, { type: "open_link" }, "Enlace de firma abierto");
      break;
    case "verify_otp":
      if (action.code !== "123456") throw new Error("DEMO_OTP_INVALID");
      transitionSignerState(packet, signerIndex, { type: "verify_otp" }, "OTP demo verificado", {
        otpStatus: "verified",
      });
      break;
    case "create_account":
      transitionSignerState(packet, signerIndex, { type: "create_account" }, "Cuenta demo creada", {
        accountCreated: true,
      });
      break;
    case "accept_consent":
      transitionSignerState(packet, signerIndex, { type: "accept_consent" }, "Consentimiento demo aceptado", {
        consentAccepted: true,
        consentTimestamp: new Date().toISOString(),
      });
      break;
    case "upload_identity":
      transitionSignerState(packet, signerIndex, { type: "upload_identity" }, "Identidad sintética cargada", {
        identityEvidence: {
          ...signer.identityEvidence,
          dniFrontStatus: "uploaded",
          dniBackStatus: "uploaded",
          selfieLivenessStatus: "pending",
          reviewStatus: "pending",
          uploadedAt: new Date().toISOString(),
        },
      });
      break;
    case "complete_liveness":
      transitionSignerState(packet, signerIndex, { type: "verify_identity_demo" }, "Identidad verificada (demo)", {
        identityEvidence: {
          ...signer.identityEvidence,
          dniFrontStatus: "verified_demo",
          dniBackStatus: "verified_demo",
          selfieLivenessStatus: "verified_demo",
          reviewStatus: "passed_demo",
        },
      });
      break;
    case "review_lease":
      transitionSignerState(packet, signerIndex, { type: "review_lease" }, "Contrato demo revisado");
      break;
    case "simulate_signature": {
      transitionSignerState(packet, signerIndex, { type: "start_signature" }, "Firma demo iniciada");
      const started = packet.signers[signerIndex];
      transitionSignerState(packet, signerIndex, { type: "complete_signature" }, "Firma demo aplicada", {
        signatureEvidence: signatureEvidence(started, packet),
      });
      transitionSignerState(packet, signerIndex, { type: "confirm_signature" }, "Firma demo confirmada");
      syncPacket(packet);
      break;
    }
    case "resume_after_correction":
      transitionSignerState(
        packet,
        signerIndex,
        { type: "resume_after_correction", correctionScope: action.scope },
        "Proceso demo reanudado",
      );
      break;
  }
  return snapshot;
}
