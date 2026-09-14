import "server-only";
import type {
  LeasePacket,
  Signer,
  AuditEvent,
  RegistryEntry,
  User,
  Property,
  LeaseTerms,
  Payment,
  DocumentHashEntry,
  NotaryReview,
  IdentityEvidence,
} from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";
import { dbPacketStatusToDomain, dbSignerStatusToDomain } from "./status-maps";

type PacketRow = Database["public"]["Tables"]["lease_packets"]["Row"];
type SignerRow = Database["public"]["Tables"]["packet_signers"]["Row"];
type DocumentRow = Database["public"]["Tables"]["packet_documents"]["Row"];

function mapPaymentStatus(dbStatus: string | undefined | null): Payment["status"] {
  switch (dbStatus) {
    case "completed": return "paid";
    case "refunded": return "refunded";
    default: return "pending";
  }
}
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type AuditRow = Database["public"]["Tables"]["packet_audit_log"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["notary_assignments"]["Row"];
type CertificationRow = Database["public"]["Tables"]["notary_certifications"]["Row"];
type RegistryRow = Database["public"]["Tables"]["registry_entries"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function toDomainUser(row: ProfileRow): User {
  return {
    id: row.id,
    role: row.role as User["role"],
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    dni: row.dni ?? "",
    companyName: row.company_name ?? undefined,
    ruc: row.ruc ?? undefined,
    licenseNumber: row.license_number ?? undefined,
    accreditationNumber: row.accreditation_number ?? undefined,
    profileStatus: row.status === "active" ? "active" : row.status === "suspended" ? "suspended" : "pending",
  };
}

export function toDomainSigner(row: SignerRow): Signer {
  const defaultIdentity: IdentityEvidence = {
    dniFrontStatus: "pending",
    dniBackStatus: "pending",
    selfieLivenessStatus: "pending",
    reviewStatus: "pending",
  };

  return {
    id: row.id,
    roleInLease: row.role_in_lease as Signer["roleInLease"],
    fullName: row.signer_full_name,
    email: row.signer_email,
    whatsapp: row.signer_whatsapp,
    dni: row.signer_dni,
    status: dbSignerStatusToDomain(row.status),
    secureLinkToken: "",
    otpStatus: row.status === "invited" ? "pending" : "verified",
    accountCreated: ["account_created", "identity_verified", "consent_given", "signed", "complete"].includes(row.status),
    consentAccepted: ["consent_given", "signed", "complete"].includes(row.status),
    consentTimestamp: undefined,
    identityEvidence: defaultIdentity,
    signatureEvidence: undefined,
    auditEvents: [],
  };
}

export function toDomainPacket(
  row: PacketRow,
  signerRows: SignerRow[],
  documentRows: DocumentRow[],
  paymentRows: PaymentRow[],
  auditRows: AuditRow[],
  assignment: AssignmentRow | null,
  certification: CertificationRow | null,
): LeasePacket {
  const payment = paymentRows[0];
  const allSignersComplete = signerRows.every((s) => s.status === "complete");

  const domainStatus = dbPacketStatusToDomain(row.status, {
    hasPaymentPending: payment?.status === "pending",
    hasPaymentCompleted: payment?.status === "completed",
    signingTokensSent: signerRows.some((s: { signing_token_id?: string | null }) => s.signing_token_id !== null),
    allSignersComplete,
    submittedToNotaryAt: row.submitted_to_notary_at,
    certificationType: certification?.certification_type ?? null,
    leaseEndDate: row.lease_end_date,
    hasChildPacket: false,
  });

  const property: Property = {
    address: row.property_address ?? "",
    district: row.district ?? "",
    province: row.province ?? "",
    department: row.department ?? "",
    unit: row.property_unit ?? undefined,
    normalizedAddressKey: `${row.property_address ?? ""}|${row.property_unit ?? ""}|${row.district ?? ""}`.toLowerCase(),
  };

  const leaseTerms: LeaseTerms = {
    monthlyRent: Number(row.rental_amount) || 0,
    depositAmount: Number(row.deposit_amount) || 0,
    currency: "PEN",
    startDate: row.lease_start_date ?? "",
    expirationDate: row.lease_end_date ?? "",
    durationMonths: 0,
    useType: "residential",
  };

  const domainPayment: Payment = {
    status: mapPaymentStatus(payment?.status),
    amount: Number(payment?.amount) || 0,
    currency: "PEN",
    paidAt: payment?.paid_at ?? undefined,
    paymentMethodPlaceholder: "Transferencia bancaria",
  };

  const documentHashes: DocumentHashEntry[] = documentRows
    .filter((d) => d.file_hash)
    .map((d) => ({
      hash: d.file_hash!,
      stage: d.document_type === "lease_original" ? "initial_upload" as const
        : d.document_type === "signed_pdf" ? "post_signatures" as const
        : "final_certified" as const,
      algorithm: "SHA-256" as const,
      timestamp: d.created_at ?? new Date().toISOString(),
    }));

  const auditEvents: AuditEvent[] = auditRows.map((a) => ({
    id: a.id,
    packetId: a.packet_id,
    actorId: a.actor_id ?? "system",
    actorRole: "system",
    eventType: a.action,
    eventLabel: a.action,
    timestamp: a.created_at ?? new Date().toISOString(),
    ipAddressPlaceholder: (a.ip_address as string | null) ?? "server",
    devicePlaceholder: "server",
    metadata: (a.metadata as Record<string, string>) ?? undefined,
  }));

  const notaryReview: NotaryReview | undefined = assignment
    ? {
        status: assignment.decision ? "complete" : assignment.review_started_at ? "in_progress" : "pending",
        reviewStartedAt: assignment.review_started_at ?? undefined,
        reviewCompletedAt: assignment.decided_at ?? undefined,
        reviewChecklist: certification?.checklist_data
          ? (certification.checklist_data as NotaryReview["reviewChecklist"])
          : [],
        observations: assignment.observations ?? undefined,
        decision: assignment.decision as NotaryReview["decision"],
      }
    : undefined;

  return {
    id: row.id,
    packetCode: row.packet_code ?? `PKT-${new Date(row.created_at ?? "").getFullYear()}-0000`,
    version: 1,
    status: domainStatus,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    createdByRealtorId: row.created_by,
    assignedNotaryId: assignment?.notary_id ?? undefined,
    leaseDocument: {
      fileName: documentRows.find((d) => d.document_type === "lease_original")?.storage_path ?? "contract.pdf",
      uploadedAt: documentRows.find((d) => d.document_type === "lease_original")?.created_at ?? row.created_at ?? "",
      initialHash: row.document_hash ?? "",
    },
    property,
    leaseTerms,
    signers: signerRows.map(toDomainSigner),
    payment: domainPayment,
    documentHashes,
    notaryReview,
    registryCheck: { status: "pending", matchFound: false },
    auditEvents,
    renewalEligibility: { eligible: false },
  };
}

export function toPacketInsert(packet: LeasePacket): Database["public"]["Tables"]["lease_packets"]["Insert"] {
  return {
    created_by: packet.createdByRealtorId,
    status: "draft",
    property_address: packet.property.address,
    property_unit: packet.property.unit ?? null,
    district: packet.property.district,
    province: packet.property.province,
    department: packet.property.department,
    rental_amount: packet.leaseTerms.monthlyRent,
    deposit_amount: packet.leaseTerms.depositAmount,
    lease_start_date: packet.leaseTerms.startDate,
    lease_end_date: packet.leaseTerms.expirationDate,
    document_hash: packet.leaseDocument.initialHash,
  };
}

export function toDomainRegistry(row: RegistryRow): RegistryEntry {
  return {
    id: row.id,
    propertyKey: `${row.property_address}|${row.property_unit ?? ""}`.toLowerCase(),
    packetId: row.packet_id,
    propertyAddress: row.property_address,
    landlordNames: [row.landlord_dni],
    renterNames: [row.renter_dni],
    leaseStartDate: row.lease_start_date,
    leaseExpirationDate: row.lease_end_date,
    certificationStatus: "certified",
    active: row.status === "active",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}
