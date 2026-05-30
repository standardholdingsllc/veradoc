import type {
  AuditEvent,
  LeasePacket,
  LeaseTerms,
  PacketStatus,
  Property,
  Signer,
} from "@/lib/domain/types";
import {
  canTransition,
  transition,
  type PacketTransitionEvent,
} from "@/lib/domain/packet-machine";
import {
  getPacketAdapter,
  getUserAdapter,
} from "@/lib/adapters/mock-adapter";
import { generateReport } from "./evidence-service";

export interface CreateSignerInput {
  roleInLease: "landlord" | "renter";
  fullName: string;
  email: string;
  whatsapp: string;
  dni: string;
}

export interface CreatePacketInput {
  property: Property;
  leaseTerms: LeaseTerms;
  leaseDocument: LeasePacket["leaseDocument"];
  signers: CreateSignerInput[];
  paymentAmount?: number;
}

const DEVICE = "Chrome 120 / Windows 11 / Lima, Perú";

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
    ipAddressPlaceholder: "192.168.1.10",
    devicePlaceholder: DEVICE,
    metadata,
  };
}

function applyTransition(
  packetId: string,
  event: PacketTransitionEvent,
  eventLabel: string,
  extraUpdates?: Partial<LeasePacket>,
  metadata?: Record<string, string>,
): LeasePacket {
  const adapter = getPacketAdapter();
  const userAdapter = getUserAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  if (!canTransition(packet.status, event)) {
    throw new Error(
      `Cannot transition packet ${packetId} from ${packet.status} with event ${event.type}`,
    );
  }

  const actor = userAdapter.getCurrentUser();
  const actorId = actor?.id ?? event.actor;
  const actorRole = actor?.role ?? event.actor;
  const newStatus = transition(packet.status, event);
  const audit = createAuditEvent(
    packetId,
    actorId,
    actorRole,
    event.type,
    eventLabel,
    metadata,
  );

  adapter.update(packetId, {
    status: newStatus,
    auditEvents: [...packet.auditEvents, audit],
    ...extraUpdates,
  });

  return adapter.getById(packetId)!;
}

export function getPackets(): LeasePacket[] {
  return getPacketAdapter().getAll();
}

export function getPacketById(id: string): LeasePacket | undefined {
  return getPacketAdapter().getById(id);
}

export function getPacketsByStatus(status: PacketStatus): LeasePacket[] {
  return getPacketAdapter().getByStatus(status);
}

export function createPacket(data: CreatePacketInput): LeasePacket {
  const adapter = getPacketAdapter();
  const userAdapter = getUserAdapter();
  const realtor = userAdapter.getCurrentUser();

  if (!realtor) {
    throw new Error("No current realtor user found");
  }

  const now = new Date().toISOString();
  const packetId = nextId("pkt");
  const year = new Date().getFullYear();
  const sequence = adapter.getAll().length + 1;
  const packetCode = `PKT-${year}-${String(sequence).padStart(3, "0")}`;

  const signers: Signer[] = data.signers.map((input, index) => ({
    id: nextId(`sig-${index}`),
    roleInLease: input.roleInLease,
    fullName: input.fullName,
    email: input.email,
    whatsapp: input.whatsapp,
    dni: input.dni,
    status: "link_sent",
    secureLinkToken: nextId(`tok-${input.dni.slice(-4)}`),
    otpStatus: "pending",
    accountCreated: false,
    consentAccepted: false,
    identityEvidence: {
      dniFrontStatus: "pending",
      dniBackStatus: "pending",
      selfieLivenessStatus: "pending",
      reviewStatus: "pending",
    },
    auditEvents: [],
  }));

  const packet: LeasePacket = {
    id: packetId,
    packetCode,
    version: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdByRealtorId: realtor.id,
    leaseDocument: data.leaseDocument,
    property: data.property,
    leaseTerms: data.leaseTerms,
    signers,
    payment: {
      status: "pending",
      amount: data.paymentAmount ?? 149,
      currency: "PEN",
      paymentMethodPlaceholder: "Pendiente",
      invoiceStatus: "pending",
    },
    documentHashes: [
      {
        hash: data.leaseDocument.initialHash,
        stage: "initial_upload",
        algorithm: "SHA-256",
        timestamp: data.leaseDocument.uploadedAt,
        actorId: realtor.id,
      },
    ],
    registryCheck: { status: "pending", matchFound: false },
    auditEvents: [
      createAuditEvent(
        packetId,
        realtor.id,
        realtor.role,
        "packet_created",
        "Paquete creado",
      ),
    ],
    renewalEligibility: { eligible: false },
  };

  adapter.create(packet);

  return applyTransition(
    packetId,
    { type: "packet_form_complete", actor: "realtor" },
    "Formulario completado, pendiente de pago",
  );
}

export function confirmPayment(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const now = new Date().toISOString();

  adapter.update(packetId, {
    payment: {
      ...packet.payment,
      status: "paid",
      paidAt: now,
      paymentMethodPlaceholder: "Tarjeta Visa •••• 4242",
      invoiceStatus: "issued",
    },
    factura: {
      status: "issued",
      numberPlaceholder: `F001-${String(Date.now()).slice(-8)}`,
      issuedAt: now,
      downloadUrlPlaceholder: `/demo/facturas/F001-${String(Date.now()).slice(-8)}.pdf`,
    },
  });

  return applyTransition(
    packetId,
    { type: "payment_confirmed", actor: "system" },
    "Pago confirmado",
  );
}

export function sendSigningLinks(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  if (packet.signers.length === 0) {
    throw new Error("Packet has no signers");
  }

  const updatedSigners = packet.signers.map((signer) => ({
    ...signer,
    status: "link_sent" as const,
    otpStatus: "sent" as const,
    auditEvents: [
      ...signer.auditEvents,
      createAuditEvent(
        packetId,
        signer.id,
        signer.roleInLease,
        "otp_sent",
        "OTP enviado por WhatsApp",
      ),
    ],
  }));

  adapter.update(packetId, { signers: updatedSigners });

  return applyTransition(
    packetId,
    { type: "send_to_signers", actor: "realtor" },
    "Enlaces enviados a firmantes",
  );
}

export function generateEvidenceReport(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const report = generateReport(packetId);

  adapter.update(packetId, { evidenceReport: report });

  return applyTransition(
    packetId,
    { type: "evidence_report_generated", actor: "system" },
    "Expediente de evidencia generado",
    { evidenceReport: { ...report, status: "generated" } },
  );
}

export function submitToNotary(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const evidenceReport = packet.evidenceReport ?? generateReport(packetId);

  adapter.update(packetId, {
    evidenceReport: { ...evidenceReport, status: "submitted" },
  });

  return applyTransition(
    packetId,
    { type: "submit_to_notary", actor: "realtor" },
    "Enviado al notario",
    { evidenceReport: { ...evidenceReport, status: "submitted" } },
  );
}

export function resubmitAfterCorrection(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const scope = packet.notaryReview?.correctionScope;
  if (!scope) {
    throw new Error("No correction scope defined on packet");
  }

  if (scope === "identity_recheck" || scope === "contract_revision") {
    return applyTransition(
      packetId,
      {
        type: "resubmit_to_signers",
        actor: "realtor",
        correctionScope: scope,
      },
      "Reenviado a firmantes tras corrección",
    );
  }

  return applyTransition(
    packetId,
    {
      type: "resubmit_to_notary",
      actor: "realtor",
      correctionScope: scope,
    },
    "Reenviado al notario tras corrección",
  );
}

export function createRenewalPacket(sourcePacketId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const source = adapter.getById(sourcePacketId);

  if (!source) {
    throw new Error(`Packet not found: ${sourcePacketId}`);
  }

  const now = new Date().toISOString();
  const packetId = nextId("pkt-ren");
  const year = new Date().getFullYear();
  const sequence = adapter.getAll().length + 1;
  const packetCode = `REN-${year}-${String(sequence).padStart(3, "0")}`;
  const newStart = source.leaseTerms.expirationDate;
  const newExpiration = new Date(source.leaseTerms.expirationDate);
  newExpiration.setMonth(newExpiration.getMonth() + source.leaseTerms.durationMonths);
  const initialHash = `${source.leaseDocument.initialHash.slice(0, 56)}${String(Date.now()).slice(-8)}`;

  const signers: Signer[] = source.signers.map((signer, index) => ({
    ...signer,
    id: nextId(`sig-ren-${index}`),
    status: "link_sent",
    secureLinkToken: nextId(`tok-ren-${signer.dni.slice(-4)}`),
    otpStatus: "sent",
    accountCreated: true,
    consentAccepted: false,
    consentTimestamp: undefined,
    identityEvidence: {
      dniFrontStatus: "pending",
      dniBackStatus: "pending",
      selfieLivenessStatus: "pending",
      reviewStatus: "pending",
    },
    signatureEvidence: undefined,
    auditEvents: [
      createAuditEvent(
        packetId,
        signer.id,
        signer.roleInLease,
        "renewal_link_sent",
        "Enlace de renovación enviado",
        { sourcePacketId },
      ),
    ],
  }));

  const packet: LeasePacket = {
    ...source,
    id: packetId,
    packetCode,
    version: source.version + 1,
    status: "sent_to_signers",
    createdAt: now,
    updatedAt: now,
    leaseDocument: {
      fileName: source.leaseDocument.fileName.replace(".pdf", "-renovacion.pdf"),
      uploadedAt: now,
      initialHash,
    },
    finalSignedDocument: undefined,
    certifiedDocument: undefined,
    leaseTerms: {
      ...source.leaseTerms,
      startDate: newStart,
      expirationDate: newExpiration.toISOString().slice(0, 10),
    },
    signers,
    payment: {
      status: "paid",
      amount: source.payment.amount,
      currency: "PEN",
      paidAt: now,
      paymentMethodPlaceholder: "Renovación demo",
      invoiceStatus: "issued",
    },
    documentHashes: [
      {
        hash: initialHash,
        stage: "initial_upload",
        algorithm: "SHA-256",
        timestamp: now,
        actorId: source.signers.find((signer) => signer.roleInLease === "landlord")?.id,
      },
    ],
    evidenceReport: undefined,
    notaryReview: undefined,
    registryCheck: { status: "checked", matchFound: false },
    auditEvents: [
      createAuditEvent(
        packetId,
        source.signers.find((signer) => signer.roleInLease === "landlord")?.id ??
          "landlord",
        "landlord",
        "renewal_created",
        "Renovación iniciada por arrendador",
        { sourcePacketId },
      ),
      createAuditEvent(
        packetId,
        "system",
        "system",
        "send_to_signers",
        "Enlaces enviados a firmantes",
      ),
    ],
    factura: {
      status: "issued",
      numberPlaceholder: `F001-${String(Date.now()).slice(-8)}`,
      issuedAt: now,
      downloadUrlPlaceholder: `/demo/facturas/F001-${String(Date.now()).slice(-8)}.pdf`,
    },
    renewalEligibility: { eligible: false },
  };

  adapter.create(packet);
  return packet;
}
