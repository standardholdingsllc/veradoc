import type {
  AuditEvent,
  LeasePacket,
  RegistryEntry,
  Signer,
  User,
} from "@/lib/domain/types";

export interface PacketAdapter {
  getAll(): LeasePacket[];
  getById(id: string): LeasePacket | undefined;
  getByStatus(status: string): LeasePacket[];
  create(packet: LeasePacket): void;
  update(id: string, updates: Partial<LeasePacket>): void;
}

export interface UserAdapter {
  getAll(): User[];
  getByRole(role: string): User[];
  getById(id: string): User | undefined;
  getCurrentUser(): User | undefined;
}

export interface RegistryAdapter {
  getAll(): RegistryEntry[];
  getByPropertyKey(key: string): RegistryEntry[];
  add(entry: RegistryEntry): void;
  update(id: string, updates: Partial<RegistryEntry>): void;
}

export interface SignerAdapter {
  getByToken(token: string): { packet: LeasePacket; signerIndex: number } | undefined;
}

export type { AuditEvent, LeasePacket, RegistryEntry, Signer, User };
