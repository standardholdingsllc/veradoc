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
  const user = getUserAdapter().getByRole("notary")[0];
  return {
    id: user?.id ?? "usr-notary",
    role: "notary",
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

export function recordDemoAuthorityCheck(
  packetId: string,
  check: Pick<NonNullable<LeasePacket["demoAuthorityCheck"]>, "titleNumber" | "result" | "ownerNames" | "notes">,
): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet || packet.status !== "under_notary_review") throw new Error("La revisión no está activa");
  if (!check.titleNumber.trim() || !check.ownerNames.trim()) throw new Error("Indique partida y titulares");
  if (check.result !== "verified" && !check.notes.trim()) throw new Error("Describa la observación o ausencia de coincidencia");
  const actor = getNotaryActor();
  adapter.update(packetId, {
    demoAuthorityCheck: {
      ...check,
      titleNumber: check.titleNumber.trim(),
      ownerNames: check.ownerNames.trim(),
      notes: check.notes.trim(),
      checkedAt: new Date().toISOString(),
    },
    auditEvents: [...packet.auditEvents, createAuditEvent(packetId, actor.id, actor.role,
      "demo_authority_check", "Consulta de autoridad de propiedad simulada", { result: check.result })],
  });
  return adapter.getById(packetId)!;
}

export function setDemoNotaryPriority(packetId: string, priority: NonNullable<LeasePacket["demoNotaryPriority"]>): void {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet) throw new Error("Paquete no encontrado");
  if (!["urgent", "high", "normal", "low"].includes(priority)) throw new Error("Prioridad inválida");
  adapter.update(packetId, { demoNotaryPriority: priority });
}

export function approveDemoEvidenceForSeal(packetId: string): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet) throw new Error("Paquete no encontrado");
  assertChecklistComplete(packet);
  if (!packet.demoAuthorityCheck) throw new Error("Registre la verificación de autoridad de propiedad");
  if (packet.demoAuthorityCheck.result === "not_found") throw new Error("La autoridad de propiedad no fue encontrada; devuelva o rechace el expediente");
  const now = new Date().toISOString();
  const notaryReview = {
    ...ensureNotaryReview(packet),
    status: "complete" as const,
    reviewCompletedAt: now,
    decision: packet.demoAuthorityCheck.result === "observation" ? "certify_with_observations" as const : "certify" as const,
    observations: packet.demoAuthorityCheck.result === "observation" ? packet.demoAuthorityCheck.notes : undefined,
  };
  return applyTransition(packetId, { type: "approve_evidence_for_seal", actor: "notary" },
    "Evidencia aprobada para certificación simulada", { notaryReview, demoSealWorkflow: {} });
}

type DemoNotarialScan = NonNullable<NonNullable<LeasePacket["demoSealWorkflow"]>["notarialScan"]>;

export function advanceDemoSeal(
  packetId: string,
  step: "prepare_document" | "upload_scan" | "attest" | "prepare_report" | "publish",
  scan?: DemoNotarialScan,
): LeasePacket {
  const adapter = getPacketAdapter();
  const packet = adapter.getById(packetId);
  if (!packet || packet.status !== "awaiting_notary_seal") throw new Error("Paquete no pendiente de sello");
  const workflow = packet.demoSealWorkflow ?? {};
  const now = new Date().toISOString();
  if (step === "prepare_document") {
    adapter.update(packetId, { demoSealWorkflow: { ...workflow, signedDocumentPreparedAt: now } });
  } else if (step === "upload_scan" && workflow.signedDocumentPreparedAt && scan) {
    if (
      !scan.fileName.toLowerCase().endsWith(".pdf") ||
      !Number.isInteger(scan.fileSizeBytes) || scan.fileSizeBytes <= 0 ||
      !Number.isInteger(scan.pageCount) || scan.pageCount < 1 || scan.pageCount > 500 ||
      !Number.isInteger(scan.additionalCertificationPages) ||
      scan.additionalCertificationPages < 0 || scan.additionalCertificationPages > 20 ||
      !/^[a-f0-9]{64}$/.test(scan.sha256)
    ) throw new Error("El escaneo PDF no es válido para la simulación");
    adapter.update(packetId, {
      demoSealWorkflow: { ...workflow, scanUploadedAt: now, notarialScan: scan },
      documentHashes: [...packet.documentHashes, {
        hash: scan.sha256,
        stage: "notarial_scan",
        algorithm: "SHA-256",
        timestamp: now,
        actorId: getNotaryActor().id,
      }],
    });
  } else if (step === "attest" && workflow.scanUploadedAt && workflow.notarialScan) {
    adapter.update(packetId, { demoSealWorkflow: { ...workflow, attestedAt: now } });
  } else if (step === "prepare_report" && workflow.attestedAt) {
    adapter.update(packetId, { demoSealWorkflow: { ...workflow, reportPreparedAt: now } });
  } else if (step === "publish" && workflow.reportPreparedAt) {
    const hash = packet.finalSignedDocument?.hash ?? packet.leaseDocument.initialHash;
    const notaryReview = { ...ensureNotaryReview(packet), certifiedAt: now };
    const certifiedDocument = {
      fileName: packet.leaseDocument.fileName.replace(/\.pdf$/i, "-certificado-demo.pdf"),
      hash,
      certifiedAt: now,
    };
    const published = applyTransition(packetId, { type: "finalize_certification", actor: "notary" },
      "Documento certificado simulado publicado a las partes", {
        notaryReview,
        certifiedDocument,
        demoSealWorkflow: { ...workflow, publishedAt: now },
        documentHashes: [...packet.documentHashes, {
          hash, stage: "final_certified", algorithm: "SHA-256", timestamp: now,
          actorId: getNotaryActor().id,
        }],
      });
    createEntry(packetId);
    return published;
  } else {
    throw new Error("Complete el paso anterior");
  }
  const updated = adapter.getById(packetId)!;
  const actor = getNotaryActor();
  adapter.update(packetId, { auditEvents: [...updated.auditEvents, createAuditEvent(packetId, actor.id,
    actor.role, `demo_seal_${step}`, "Paso de certificación simulado completado")] });
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
