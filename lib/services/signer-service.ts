import type {
  AuditEvent,
  CorrectionScope,
  LeasePacket,
  SignatureEvidence,
  Signer,
  SignerStatus,
} from "@/lib/domain/types";
import {
  canTransition,
  transition,
  type PacketTransitionEvent,
} from "@/lib/domain/packet-machine";
import {
  canTransitionSigner,
  transitionSigner,
  type SignerTransitionEvent,
} from "@/lib/domain/signer-machine";
import {
  getPacketAdapter,
  getSignerAdapter,
} from "@/lib/adapters/mock-adapter";

const DEVICE_MOBILE = "Safari 17 / iPhone 15 / Lima, Perú";
const DEMO_OTP = "123456";

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAuditEvent(
  packetId: string,
  actorId: string,
  actorRole: string,
  eventType: string,
  eventLabel: string,
  metadata?: Record<string, string>,
): AuditEvent {
  return {
    id: nextId("aud"),
    packetId,
    actorId,
    actorRole,
    eventType,
    eventLabel,
    timestamp: new Date().toISOString(),
    ipAddressPlaceholder: "192.168.2.88",
    devicePlaceholder: DEVICE_MOBILE,
    metadata,
  };
}

function getSignerContext(
  signerId: string,
  packetId: string,
): { packet: LeasePacket; signer: Signer; signerIndex: number } {
  const packet = getPacketAdapter().getById(packetId);
  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const signerIndex = packet.signers.findIndex((entry) => entry.id === signerId);
  if (signerIndex === -1) {
    throw new Error(`Signer not found: ${signerId}`);
  }

  return { packet, signer: packet.signers[signerIndex], signerIndex };
}

function updateSigner(
  packetId: string,
  signerId: string,
  updates: Partial<Signer>,
): Signer {
  const adapter = getPacketAdapter();
  const { packet, signerIndex } = getSignerContext(signerId, packetId);

  const updatedSigner = { ...packet.signers[signerIndex], ...updates };
  const signers = packet.signers.map((entry, index) =>
    index === signerIndex ? updatedSigner : entry,
  );

  adapter.update(packetId, { signers });
  return updatedSigner;
}

function applySignerTransition(
  signerId: string,
  packetId: string,
  event: SignerTransitionEvent,
  eventLabel: string,
  extraUpdates?: Partial<Signer>,
  metadata?: Record<string, string>,
): Signer {
  const { signer } = getSignerContext(signerId, packetId);

  if (!canTransitionSigner(signer.status, event)) {
    throw new Error(
      `Cannot transition signer ${signerId} from ${signer.status} with event ${event.type}`,
    );
  }

  const newStatus = transitionSigner(signer.status, event);
  const audit = createAuditEvent(
    packetId,
    signerId,
    signer.roleInLease,
    event.type,
    eventLabel,
    metadata,
  );

  return updateSigner(packetId, signerId, {
    status: newStatus,
    auditEvents: [...signer.auditEvents, audit],
    ...extraUpdates,
  });
}

function applyPacketTransition(
  packetId: string,
  event: PacketTransitionEvent,
  eventLabel: string,
): void {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet || !canTransition(packet.status, event)) {
    return;
  }

  const newStatus = transition(packet.status, event);
  const audit = createAuditEvent(packetId, "system", "system", event.type, eventLabel);

  adapter.update(packetId, {
    status: newStatus,
    auditEvents: [...packet.auditEvents, audit],
  });
}

function syncPacketSignerProgress(packetId: string): void {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet) {
    return;
  }

  const completed = packet.signers.filter((signer) => signer.status === "complete").length;
  const total = packet.signers.length;
  const allComplete = completed === total && total > 0;
  const someComplete = completed > 0;

  if (
    allComplete &&
    canTransition(packet.status, { type: "signer_complete", actor: "system" }) &&
    packet.status === "sent_to_signers"
  ) {
    applyPacketTransition(
      packetId,
      { type: "signer_complete", actor: "system" },
      "Firma de firmante completada",
    );
  }

  const refreshed = adapter.getById(packetId);
  if (!refreshed) {
    return;
  }

  if (
    allComplete &&
    canTransition(refreshed.status, { type: "all_signers_complete", actor: "system" })
  ) {
    const hash =
      refreshed.documentHashes[refreshed.documentHashes.length - 1]?.hash ??
      refreshed.leaseDocument.initialHash;
    const now = new Date().toISOString();

    applyPacketTransition(
      packetId,
      { type: "all_signers_complete", actor: "system" },
      "Todas las firmas completadas",
    );

    adapter.update(packetId, {
      finalSignedDocument: {
        fileName: refreshed.leaseDocument.fileName.replace(".pdf", "-firmado.pdf"),
        hash,
        generatedAt: now,
      },
      documentHashes: [
        ...refreshed.documentHashes,
        {
          hash,
          stage: "post_signatures",
          algorithm: "SHA-256",
          timestamp: now,
          actorId: "system",
        },
      ],
    });
    return;
  }

  if (
    someComplete &&
    canTransition(refreshed.status, { type: "signer_complete", actor: "system" })
  ) {
    applyPacketTransition(
      packetId,
      { type: "signer_complete", actor: "system" },
      "Firma de firmante completada",
    );
  }
}

function buildSignatureEvidence(
  signer: Signer,
  packet: LeasePacket,
): SignatureEvidence {
  const signedAt = new Date().toISOString();
  const documentHash =
    packet.finalSignedDocument?.hash ??
    packet.documentHashes[packet.documentHashes.length - 1]?.hash ??
    packet.leaseDocument.initialHash;

  return {
    providerName: "IOFE Certificado Digital",
    signatureStatus: "valid",
    certificateSubject: `CN=${signer.fullName}, SERIALNUMBER=DNI-${signer.dni}, O=Persona Natural, C=PE`,
    certificateIssuer:
      "CN=IOFE CA Producción, O=Instituto de Ofimática Empresarial S.A., C=PE",
    certificateSerial: `IOFE-${signer.dni.slice(0, 4)}-${Date.parse(signedAt).toString(36).toUpperCase()}`,
    certificateValidityStart: "2023-06-01T00:00:00.000Z",
    certificateValidityEnd: "2025-06-01T23:59:59.000Z",
    certificateChainResult: "valid",
    revocationResult: "good",
    timestampResult: "valid",
    pdfIntegrityResult: "intact",
    signedAt,
    finalDocumentHash: documentHash,
  };
}

export function getSignerByToken(
  token: string,
): { packet: LeasePacket; signer: Signer; signerIndex: number } | undefined {
  const result = getSignerAdapter().getByToken(token);
  if (!result) {
    return undefined;
  }

  return {
    packet: result.packet,
    signer: result.packet.signers[result.signerIndex],
    signerIndex: result.signerIndex,
  };
}

export function openLink(signerId: string, packetId: string): Signer {
  return applySignerTransition(
    signerId,
    packetId,
    { type: "open_link" },
    "Enlace de firma abierto",
  );
}

export function verifyOtp(
  signerId: string,
  packetId: string,
  code: string,
): Signer {
  if (code !== DEMO_OTP) {
    throw new Error("Invalid OTP code");
  }

  return applySignerTransition(
    signerId,
    packetId,
    { type: "verify_otp" },
    "OTP verificado",
    { otpStatus: "verified" },
  );
}

export function createAccount(signerId: string, packetId: string): Signer {
  return applySignerTransition(
    signerId,
    packetId,
    { type: "create_account" },
    "Cuenta creada",
    { accountCreated: true },
  );
}

export function acceptConsent(signerId: string, packetId: string): Signer {
  const now = new Date().toISOString();

  return applySignerTransition(
    signerId,
    packetId,
    { type: "accept_consent" },
    "Consentimiento aceptado",
    {
      consentAccepted: true,
      consentTimestamp: now,
    },
  );
}

export function uploadIdentity(signerId: string, packetId: string): Signer {
  const { signer } = getSignerContext(signerId, packetId);
  const now = new Date().toISOString();

  return applySignerTransition(
    signerId,
    packetId,
    { type: "upload_identity" },
    "Documentos de identidad cargados",
    {
      identityEvidence: {
        ...signer.identityEvidence,
        dniFrontStatus: "uploaded",
        dniBackStatus: "uploaded",
        selfieLivenessStatus: "pending",
        reviewStatus: "pending",
        uploadedAt: now,
      },
    },
  );
}

export function completeLiveness(signerId: string, packetId: string): Signer {
  const { signer } = getSignerContext(signerId, packetId);

  return applySignerTransition(
    signerId,
    packetId,
    { type: "verify_identity_demo" },
    "Identidad verificada (demo)",
    {
      identityEvidence: {
        ...signer.identityEvidence,
        dniFrontStatus: "verified_demo",
        dniBackStatus: "verified_demo",
        selfieLivenessStatus: "verified_demo",
        reviewStatus: "passed_demo",
      },
    },
  );
}

export function reviewLease(signerId: string, packetId: string): Signer {
  return applySignerTransition(
    signerId,
    packetId,
    { type: "review_lease" },
    "Contrato revisado",
  );
}

export function simulateSignature(signerId: string, packetId: string): Signer {
  const { packet, signer } = getSignerContext(signerId, packetId);

  applySignerTransition(
    signerId,
    packetId,
    { type: "start_signature" },
    "Firma digital iniciada",
  );

  const signatureEvidence = buildSignatureEvidence(signer, packet);

  applySignerTransition(
    signerId,
    packetId,
    { type: "complete_signature" },
    "Firma digital aplicada",
    { signatureEvidence },
  );

  const completed = applySignerTransition(
    signerId,
    packetId,
    { type: "confirm_signature" },
    "Firma confirmada",
  );

  syncPacketSignerProgress(packetId);
  return completed;
}

export function advanceSignerToCompleteDemo(
  signerId: string,
  packetId: string,
): Signer {
  let status: SignerStatus = getSignerContext(signerId, packetId).signer.status;
  let completedSigner = getSignerContext(signerId, packetId).signer;

  while (status !== "complete") {
    switch (status) {
      case "link_sent":
        completedSigner = openLink(signerId, packetId);
        break;
      case "link_opened":
        completedSigner = verifyOtp(signerId, packetId, DEMO_OTP);
        break;
      case "otp_verified":
        completedSigner = createAccount(signerId, packetId);
        break;
      case "account_created":
        completedSigner = acceptConsent(signerId, packetId);
        break;
      case "consent_accepted":
        completedSigner = uploadIdentity(signerId, packetId);
        break;
      case "identity_uploaded":
        completedSigner = completeLiveness(signerId, packetId);
        break;
      case "identity_verified_demo":
        completedSigner = reviewLease(signerId, packetId);
        break;
      case "lease_reviewed":
        completedSigner = applySignerTransition(
          signerId,
          packetId,
          { type: "start_signature" },
          "Firma digital iniciada",
        );
        break;
      case "signature_started": {
        const { packet, signer } = getSignerContext(signerId, packetId);
        completedSigner = applySignerTransition(
          signerId,
          packetId,
          { type: "complete_signature" },
          "Firma digital aplicada",
          { signatureEvidence: buildSignatureEvidence(signer, packet) },
        );
        break;
      }
      case "signed":
        completedSigner = applySignerTransition(
          signerId,
          packetId,
          { type: "confirm_signature" },
          "Firma confirmada",
        );
        syncPacketSignerProgress(packetId);
        break;
      case "needs_correction":
        throw new Error("Cannot auto-advance signer while correction is needed");
      default:
        throw new Error(`Unsupported signer demo status: ${status}`);
    }

    status = completedSigner.status;
  }

  return completedSigner;
}

export function resumeAfterCorrection(
  signerId: string,
  packetId: string,
  correctionScope: "identity_recheck" | "contract_revision" = "identity_recheck",
): Signer {
  return applySignerTransition(
    signerId,
    packetId,
    { type: "resume_after_correction", correctionScope },
    "Reanudado tras corrección",
  );
}

export function completeSigner(signerId: string, packetId: string): Signer {
  const { signer } = getSignerContext(signerId, packetId);

  if (signer.status !== "signed") {
    throw new Error(`Signer must be in signed status, currently ${signer.status}`);
  }

  const completed = applySignerTransition(
    signerId,
    packetId,
    { type: "confirm_signature" },
    "Proceso de firma completado",
  );

  syncPacketSignerProgress(packetId);
  return completed;
}
