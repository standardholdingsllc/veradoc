export interface DocumentHashRecord {
  stage: "initial_upload" | "post_signatures" | "final_certified";
  algorithm: string;
  hash: string;
  timestamp: string;
  actorId?: string;
}

export interface SignerEvidenceSummary {
  signerName: string;
  signerDni: string;
  roleInLease: string;
  identityStatus: string;
  signatureStatus: string;
  consentStatus: string;
}

export interface OtpRecord {
  signerName: string;
  channel: string;
  sentAt: string;
  verifiedAt: string | null;
}

export interface ConsentRecord {
  signerName: string;
  consentType: string;
  acceptedAt: string;
  ip: string;
  device: string;
}

export interface SignatureValidationRecord {
  signerName: string;
  certificateSubject: string | null;
  certificateIssuer: string | null;
  certificateSerial: string | null;
  certificateValidFrom: string | null;
  certificateValidTo: string | null;
  chainValidationResult: string | null;
  revocationResult: string | null;
  timestampResult: string | null;
  signatureValid: boolean | null;
  pdfIntegrityValid: boolean | null;
  signedDocumentHash: string | null;
  signedAt: string | null;
  providerName?: string;
  verificationUrl?: string;
  providerSignedAt?: string;
}

export interface SessionLogEntry {
  signerName: string;
  events: {
    type: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }[];
}

export interface DuplicateCheckResult {
  checked: boolean;
  matchFound: boolean;
  overlapCount: number;
  details?: string;
}

export interface EvidenceReportData {
  packetId: string;
  packetCode: string;
  generatedAt: string;
  propertyAddress: string;
  propertyUnit?: string;
  district?: string;
  province?: string;
  documentHashHistory: DocumentHashRecord[];
  signerEvidenceSummaries: SignerEvidenceSummary[];
  otpRecords: OtpRecord[];
  consentRecords: ConsentRecord[];
  signatureValidationResults: SignatureValidationRecord[];
  sessionLogs: SessionLogEntry[];
  propertyAuthorityEvidence: string;
  duplicateRentalCheck: DuplicateCheckResult;
  systemFlags: string[];
  summaryForNotary: string;
}

export interface CertifiedDocumentData {
  packetCode: string;
  packetId: string;
  notaryName: string;
  accreditationNumber: string | null;
  certifiedAt: string;
  certificationType: "certified" | "certified_with_observations";
  observations?: string;
  checklistSummary: Record<string, boolean>;
  documentHashes: DocumentHashRecord[];
  propertyAddress: string;
  propertyUnit?: string;
  district?: string;
  province?: string;
  landlordNames: string[];
  renterNames: string[];
  leaseStartDate?: string;
  leaseEndDate?: string;
}
