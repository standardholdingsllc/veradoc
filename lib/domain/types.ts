// Packet lifecycle statuses
export type PacketStatus =
  | "draft"
  | "awaiting_payment"
  | "ready_to_send"
  | "sent_to_signers"
  | "partially_signed"
  | "all_signers_complete"
  | "evidence_report_generated"
  | "ready_for_notary"
  | "under_notary_review"
  | "certified"
  | "certified_with_observations"
  | "needs_correction"
  | "rejected"
  | "archived"
  | "renewal_available"
  | "renewal_in_progress";

// Signer statuses (8-step flow)
export type SignerStatus =
  | "link_sent"
  | "link_opened"
  | "otp_verified"
  | "account_created"
  | "consent_accepted"
  | "identity_uploaded"
  | "identity_verified_demo"
  | "lease_reviewed"
  | "signature_started"
  | "signed"
  | "complete"
  | "needs_correction";

export type NotaryDecision =
  | "certify"
  | "certify_with_observations"
  | "return_for_correction"
  | "reject";

export type CorrectionScope =
  | "identity_recheck"
  | "contract_revision"
  | "document_metadata"
  | "notary_observation";

export type UserRole = "notary" | "realtor" | "landlord" | "renter";

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string;
  dni: string;
  companyName?: string;
  ruc?: string;
  licenseNumber?: string;
  accreditationNumber?: string;
  profileStatus: "active" | "pending" | "suspended";
}

export interface LeasePacket {
  id: string;
  packetCode: string;
  version: number;
  status: PacketStatus;
  createdAt: string;
  updatedAt: string;
  createdByRealtorId: string;
  assignedNotaryId?: string;
  leaseDocument: { fileName: string; uploadedAt: string; initialHash: string };
  finalSignedDocument?: { fileName: string; hash: string; generatedAt: string };
  certifiedDocument?: { fileName: string; hash: string; certifiedAt: string };
  property: Property;
  leaseTerms: LeaseTerms;
  signers: Signer[];
  payment: Payment;
  documentHashes: DocumentHashEntry[];
  evidenceReport?: EvidenceReport;
  notaryReview?: NotaryReview;
  registryCheck: { status: string; matchFound: boolean; matchDetails?: string };
  auditEvents: AuditEvent[];
  factura?: Factura;
  renewalEligibility: { eligible: boolean; availableAfter?: string };
}

export interface DocumentHashEntry {
  hash: string;
  stage: "initial_upload" | "post_signatures" | "final_certified";
  algorithm: "SHA-256";
  timestamp: string;
  actorId?: string;
}

export interface Property {
  address: string;
  district: string;
  province: string;
  department: string;
  unit?: string;
  reference?: string;
  sunarpRecordPlaceholder?: string;
  propertyAuthorityEvidence?: string;
  normalizedAddressKey: string;
}

export interface LeaseTerms {
  monthlyRent: number;
  depositAmount: number;
  currency: "PEN";
  startDate: string;
  expirationDate: string;
  durationMonths: number;
  useType: "residential" | "commercial";
  notes?: string;
}

export interface Signer {
  id: string;
  roleInLease: "landlord" | "renter";
  fullName: string;
  email: string;
  whatsapp: string;
  dni: string;
  status: SignerStatus;
  secureLinkToken: string;
  otpStatus: "pending" | "sent" | "verified";
  accountCreated: boolean;
  consentAccepted: boolean;
  consentTimestamp?: string;
  identityEvidence: IdentityEvidence;
  signatureEvidence?: SignatureEvidence;
  auditEvents: AuditEvent[];
}

export interface IdentityEvidence {
  dniFrontStatus: "pending" | "uploaded" | "verified_demo";
  dniBackStatus: "pending" | "uploaded" | "verified_demo";
  selfieLivenessStatus: "pending" | "completed" | "verified_demo";
  reviewStatus: "pending" | "passed_demo" | "needs_review";
  uploadedAt?: string;
  flags?: string[];
}

export interface SignatureEvidence {
  providerName: string;
  signatureStatus: "valid" | "invalid" | "pending";
  certificateSubject: string;
  certificateIssuer: string;
  certificateSerial: string;
  certificateValidityStart: string;
  certificateValidityEnd: string;
  certificateChainResult: "valid" | "invalid" | "unknown";
  revocationResult: "good" | "revoked" | "unknown";
  timestampResult: "valid" | "invalid" | "missing";
  pdfIntegrityResult: "intact" | "modified" | "unknown";
  signedAt: string;
  finalDocumentHash: string;
}

export interface EvidenceReport {
  id: string;
  packetId: string;
  generatedAt: string;
  status: "generated" | "submitted" | "under_review";
  documentHashHistory: DocumentHashEntry[];
  signerEvidenceSummaries: {
    signerId: string;
    identityStatus: string;
    signatureStatus: string;
    consentStatus: string;
  }[];
  otpRecords: {
    signerId: string;
    channel: string;
    sentAt: string;
    verifiedAt: string;
  }[];
  consentRecords: {
    signerId: string;
    consentType: string;
    acceptedAt: string;
    ip: string;
    device: string;
  }[];
  sessionLogs: { signerId: string; events: AuditEvent[] }[];
  signatureValidationResults: {
    signerId: string;
    result: string;
    details: SignatureEvidence;
  }[];
  propertyAuthorityEvidence: string;
  duplicateRentalCheck: {
    checked: boolean;
    matchFound: boolean;
    details?: string;
  };
  systemFlags: string[];
  summaryForNotary: string;
}

export interface NotaryReview {
  status: "pending" | "in_progress" | "complete";
  reviewStartedAt?: string;
  reviewCompletedAt?: string;
  reviewChecklist: {
    itemKey: string;
    label: string;
    checked: boolean;
    checkedAt?: string;
  }[];
  observations?: string;
  decision?: NotaryDecision;
  correctionScope?: CorrectionScope;
  certificationTextPlaceholder?: string;
  certifiedAt?: string;
  rejectionReason?: string;
  correctionReason?: string;
}

export interface RegistryEntry {
  id: string;
  propertyKey: string;
  packetId: string;
  propertyAddress: string;
  landlordNames: string[];
  renterNames: string[];
  leaseStartDate: string;
  leaseExpirationDate: string;
  certificationStatus: "certified" | "certified_with_observations";
  active: boolean;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  packetId: string;
  actorId: string;
  actorRole: string;
  eventType: string;
  eventLabel: string;
  timestamp: string;
  ipAddressPlaceholder: string;
  devicePlaceholder: string;
  metadata?: Record<string, string>;
}

export interface Payment {
  status: "pending" | "paid" | "refunded";
  amount: number;
  currency: "PEN";
  paidAt?: string;
  paymentMethodPlaceholder: string;
  invoiceStatus: "pending" | "issued" | "na";
}

export interface Factura {
  status: "pending" | "issued";
  numberPlaceholder?: string;
  issuedAt?: string;
  downloadUrlPlaceholder?: string;
}
