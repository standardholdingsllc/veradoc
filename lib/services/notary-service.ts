import type { AuditEvent, CorrectionScope, LeasePacket } from "@/lib/domain/types";
import {
  canTransition,
  transition,
  type PacketTransitionEvent,
} from "@/lib/domain/packet-machine";
import {
  getPacketAdapter,
  getUserAdapter,
} from "@/lib/adapters/mock-adapter";
import { CHECKLIST } from "@/lib/i18n/labels";
import { createEntry } from "./registry-service";

const NOTARY_CHECKLIST = Object.entries(CHECKLIST).map(([itemKey, label]) => ({
  itemKey,
  label,
}));

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
    ipAddressPlaceholder: "192.168.10.5",
    devicePlaceholder: DEVICE,
    metadata,
  };
}

function getNotaryActor(): { id: string; role: string } {
  const user = getUserAdapter().getCurrentUser();
  return {
    id: user?.id ?? "usr-notary",
    role: user?.role ?? "notary",
  };
}

function ensureNotaryReview(packet: LeasePacket) {
  if (packet.notaryReview) {
    return packet.notaryReview;
  }

  return {
    status: "pending" as const,
    reviewChecklist: NOTARY_CHECKLIST.map((item) => ({
      ...item,
      checked: false,
    })),
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
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  if (!canTransition(packet.status, event)) {
    throw new Error(
      `Cannot transition packet ${packetId} from ${packet.status} with event ${event.type}`,
    );
  }

  const actor = getNotaryActor();
  const newStatus = transition(packet.status, event);
  const audit = createAuditEvent(
    packetId,
    actor.id,
    actor.role,
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

export function startReview(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  if (packet.status === "under_notary_review") {
    return packet;
  }

  const now = new Date().toISOString();
  const notaryReview = {
    ...ensureNotaryReview(packet),
    status: "in_progress" as const,
    reviewStartedAt: now,
  };

  adapter.update(packetId, { notaryReview });

  return applyTransition(
    packetId,
    { type: "start_review", actor: "notary" },
    "Revisión notarial iniciada",
    { notaryReview },
  );
}

export function toggleChecklistItem(
  packetId: string,
  itemKey: string,
): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const notaryReview = ensureNotaryReview(packet);
  const now = new Date().toISOString();

  const reviewChecklist = notaryReview.reviewChecklist.map((item) => {
    if (item.itemKey !== itemKey) {
      return item;
    }

    const checked = !item.checked;
    return {
      ...item,
      checked,
      checkedAt: checked ? now : undefined,
    };
  });

  adapter.update(packetId, {
    notaryReview: {
      ...notaryReview,
      reviewChecklist,
    },
  });

  return adapter.getById(packetId)!;
}

function assertChecklistComplete(packet: LeasePacket): void {
  const checklist = packet.notaryReview?.reviewChecklist ?? [];
  const allChecked = checklist.length > 0 && checklist.every((item) => item.checked);

  if (!allChecked) {
    throw new Error("All checklist items must be checked before certification");
  }
}

function finalizeCertification(
  packetId: string,
  eventType: "certify" | "certify_with_observations",
  observations?: string,
): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  assertChecklistComplete(packet);

  const now = new Date().toISOString();
  const hash =
    packet.finalSignedDocument?.hash ??
    packet.documentHashes[packet.documentHashes.length - 1]?.hash ??
    packet.leaseDocument.initialHash;

  const notaryReview = {
    ...ensureNotaryReview(packet),
    status: "complete" as const,
    reviewCompletedAt: now,
    certifiedAt: now,
    decision:
      eventType === "certify"
        ? ("certify" as const)
        : ("certify_with_observations" as const),
    observations,
    certificationTextPlaceholder:
      "Certifico que el presente contrato de arrendamiento ha sido suscrito digitalmente por las partes, conforme a la normativa vigente.",
  };

  adapter.update(packetId, {
    notaryReview,
    certifiedDocument: {
      fileName: packet.leaseDocument.fileName.replace(".pdf", "-certificado.pdf"),
      hash,
      certifiedAt: now,
    },
    documentHashes: [
      ...packet.documentHashes,
      {
        hash,
        stage: "final_certified",
        algorithm: "SHA-256",
        timestamp: now,
        actorId: getNotaryActor().id,
      },
    ],
    evidenceReport: packet.evidenceReport
      ? { ...packet.evidenceReport, status: "under_review" as const }
      : packet.evidenceReport,
  });

  const certified = applyTransition(
    packetId,
    { type: eventType, actor: "notary" },
    eventType === "certify"
      ? "Contrato certificado"
      : "Contrato certificado con observaciones",
    { notaryReview },
    observations ? { observations } : undefined,
  );

  createEntry(packetId);
  return certified;
}

export function certify(packetId: string): LeasePacket {
  return finalizeCertification(packetId, "certify");
}

export function certifyWithObservations(
  packetId: string,
  observations: string,
): LeasePacket {
  return finalizeCertification(packetId, "certify_with_observations", observations);
}

export function returnForCorrection(
  packetId: string,
  reason: string,
  scope: CorrectionScope,
): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const now = new Date().toISOString();
  const notaryReview = {
    ...ensureNotaryReview(packet),
    status: "complete" as const,
    reviewCompletedAt: now,
    decision: "return_for_correction" as const,
    correctionScope: scope,
    correctionReason: reason,
  };

  adapter.update(packetId, { notaryReview });

  return applyTransition(
    packetId,
    { type: "return_for_correction", actor: "notary" },
    "Devuelto para corrección",
    { notaryReview },
    { reason, scope },
  );
}

export function reject(packetId: string, reason: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);

  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  const now = new Date().toISOString();
  const notaryReview = {
    ...ensureNotaryReview(packet),
    status: "complete" as const,
    reviewCompletedAt: now,
    decision: "reject" as const,
    rejectionReason: reason,
  };

  adapter.update(packetId, { notaryReview });

  return applyTransition(
    packetId,
    { type: "reject", actor: "notary" },
    "Contrato rechazado",
    { notaryReview },
    { reason },
  );
}
