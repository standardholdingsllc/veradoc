import "server-only";
import type {
  LeasePacket,
  RegistryEntry,
  Signer,
  User,
} from "@/lib/domain/types";

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PacketAdapter {
  getAll(filters?: {
    status?: string;
    createdBy?: string;
    pagination?: PaginationOptions;
  }): Promise<PaginatedResult<LeasePacket>>;
  getById(id: string): Promise<LeasePacket | undefined>;
  create(packet: LeasePacket): Promise<LeasePacket>;
  updateStatus(id: string, newStatus: string, actorId: string, action: string): Promise<void>;
  insertAuditEvent(packetId: string, actorId: string, action: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface SignerAdapter {
  getByPacketId(packetId: string): Promise<Signer[]>;
  lookupByTokenHash(tokenHash: string): Promise<{
    tokenId: string;
    packetId: string;
    signerEmail: string;
    signerName: string;
    roleInLease: string;
    tokenStatus: string;
  } | null>;
  advanceStatus(signerId: string, newStatus: string, profileId?: string): Promise<void>;
  verifyOtp(tokenHash: string): Promise<void>;
  insertEvidence(signerId: string, evidence: {
    type: string;
    storagePath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  insertSignatureRecord(signerId: string, record: Record<string, unknown>): Promise<void>;
}

export interface RegistryAdapter {
  getAll(pagination?: PaginationOptions): Promise<PaginatedResult<RegistryEntry>>;
  checkDuplicate(address: string, unit: string | null, startDate: string, endDate: string): Promise<{
    overlapCount: number;
    earliestStart?: string;
    latestEnd?: string;
  }>;
  create(entry: Omit<RegistryEntry, "id">): Promise<RegistryEntry>;
}

export interface UserAdapter {
  getById(id: string): Promise<User | undefined>;
  getByRole(role: string, pagination?: PaginationOptions): Promise<PaginatedResult<User>>;
  getCurrentUser(): Promise<User | undefined>;
}

export interface NotaryAdapter {
  createAssignment(packetId: string, notaryId: string): Promise<void>;
  startReview(packetId: string): Promise<void>;
  updateDecision(packetId: string, decision: string, observations?: string): Promise<void>;
  createCertification(data: {
    packetId: string;
    notaryId: string;
    type: string;
    observations?: string;
    checklistData: Record<string, unknown>;
  }): Promise<void>;
}

export interface PaymentAdapter {
  create(data: {
    packetId: string;
    realtorId: string;
    amount: number;
    currency: string;
  }): Promise<{ id: string }>;
  updateStatus(id: string, status: string, providerRef?: string): Promise<void>;
}
