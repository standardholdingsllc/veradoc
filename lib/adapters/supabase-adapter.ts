import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type {
  PacketAdapter,
  SignerAdapter,
  RegistryAdapter,
  UserAdapter,
  NotaryAdapter,
  PaymentAdapter,
  PaginationOptions,
  PaginatedResult,
} from "./server-types";
import type { LeasePacket, RegistryEntry, Signer, User } from "@/lib/domain/types";
import {
  toDomainPacket,
  toDomainSigner,
  toDomainUser,
  toDomainRegistry,
  toPacketInsert,
} from "./mappers";

const DEFAULT_PAGE_SIZE = 25;

function resolvePagination(opts?: PaginationOptions) {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export class SupabasePacketAdapter implements PacketAdapter {
  async getAll(filters?: {
    status?: string;
    createdBy?: string;
    pagination?: PaginationOptions;
  }): Promise<PaginatedResult<LeasePacket>> {
    const supabase = await createClient();
    const { page, pageSize, from, to } = resolvePagination(filters?.pagination);

    let query = supabase
      .from("lease_packets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.createdBy) query = query.eq("created_by", filters.createdBy);

    const { data: packets, error, count } = await query;
    if (error) throw error;
    if (!packets || packets.length === 0) {
      return { data: [], total: count ?? 0, page, pageSize, hasMore: false };
    }

    const packetIds = packets.map((p) => p.id);

    const [signers, documents, payments, auditLog, assignments, certifications] = await Promise.all([
      supabase.from("packet_signers").select("*").in("packet_id", packetIds),
      supabase.from("packet_documents").select("*").in("packet_id", packetIds),
      supabase.from("payments").select("*").in("packet_id", packetIds),
      supabase.from("packet_audit_log").select("*").in("packet_id", packetIds),
      supabase.from("notary_assignments").select("*").in("packet_id", packetIds),
      supabase.from("notary_certifications").select("*").in("packet_id", packetIds),
    ]);

    const data = packets.map((row) =>
      toDomainPacket(
        row,
        (signers.data ?? []).filter((s) => s.packet_id === row.id),
        (documents.data ?? []).filter((d) => d.packet_id === row.id),
        (payments.data ?? []).filter((p) => p.packet_id === row.id),
        (auditLog.data ?? []).filter((a) => a.packet_id === row.id),
        (assignments.data ?? []).find((a) => a.packet_id === row.id) ?? null,
        (certifications.data ?? []).find((c) => c.packet_id === row.id) ?? null,
      ),
    );

    const total = count ?? 0;
    return { data, total, page, pageSize, hasMore: from + packets.length < total };
  }

  async getById(id: string): Promise<LeasePacket | undefined> {
    const supabase = await createClient();
    const { data: row } = await supabase.from("lease_packets").select("*").eq("id", id).single();
    if (!row) return undefined;

    const [signers, documents, payments, auditLog, assignments, certifications] = await Promise.all([
      supabase.from("packet_signers").select("*").eq("packet_id", id),
      supabase.from("packet_documents").select("*").eq("packet_id", id),
      supabase.from("payments").select("*").eq("packet_id", id),
      supabase.from("packet_audit_log").select("*").eq("packet_id", id),
      supabase.from("notary_assignments").select("*").eq("packet_id", id),
      supabase.from("notary_certifications").select("*").eq("packet_id", id),
    ]);

    return toDomainPacket(
      row,
      signers.data ?? [],
      documents.data ?? [],
      payments.data ?? [],
      auditLog.data ?? [],
      (assignments.data ?? [])[0] ?? null,
      (certifications.data ?? [])[0] ?? null,
    );
  }

  async create(packet: LeasePacket): Promise<LeasePacket> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("lease_packets")
      .insert(toPacketInsert(packet))
      .select()
      .single();
    if (error) throw error;

    await admin.from("packet_documents").insert({
      packet_id: data.id,
      document_type: "lease_original",
      storage_path: `packets/${data.id}/${packet.leaseDocument.fileName}`,
      file_hash: packet.leaseDocument.initialHash,
      uploaded_by: packet.createdByRealtorId,
    });

    await admin.from("payments").insert({
      packet_id: data.id,
      realtor_id: packet.createdByRealtorId,
      amount: packet.leaseTerms.monthlyRent * 0.1,
      currency: "PEN",
    });

    await admin.from("packet_audit_log").insert({
      packet_id: data.id,
      actor_id: packet.createdByRealtorId,
      action: "packet_created",
    });

    return (await this.getById(data.id))!;
  }

  async updateStatus(id: string, newStatus: string, actorId: string, action: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc("transition_packet_status", {
      p_packet_id: id,
      p_new_status: newStatus,
      p_actor_id: actorId,
      p_action: action,
    });
    if (error) throw error;
  }

  async insertAuditEvent(packetId: string, actorId: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("packet_audit_log").insert({
      packet_id: packetId,
      actor_id: actorId,
      action,
      metadata: (metadata ?? {}) as Json,
    });
    if (error) throw error;
  }
}

export class SupabaseSignerAdapter implements SignerAdapter {
  async getByPacketId(packetId: string): Promise<Signer[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("packet_signers")
      .select("*")
      .eq("packet_id", packetId);
    if (error) throw error;
    return (data ?? []).map(toDomainSigner);
  }

  async lookupByTokenHash(tokenHash: string) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("lookup_signing_context", {
      p_token_hash: tokenHash,
    });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const row = data[0];
    return {
      tokenId: row.token_id,
      packetId: row.packet_id,
      signerEmail: row.signer_email,
      signerName: row.signer_full_name,
      roleInLease: row.role_in_lease,
      tokenStatus: row.token_status,
    };
  }

  async advanceStatus(signerId: string, newStatus: string, profileId?: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc("advance_signer_status", {
      p_signer_id: signerId,
      p_new_status: newStatus,
      p_profile_id: profileId ?? null,
    });
    if (error) throw error;
  }

  async verifyOtp(tokenHash: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.rpc("verify_signing_otp", {
      p_token_hash: tokenHash,
    });
    if (error) throw error;
  }

  async insertEvidence(signerId: string, evidence: { type: string; storagePath?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("signer_evidence").insert({
      packet_signer_id: signerId,
      evidence_type: evidence.type,
      storage_path: evidence.storagePath ?? null,
      metadata: (evidence.metadata ?? {}) as Json,
    });
    if (error) throw error;
  }

  async insertSignatureRecord(signerId: string, record: Record<string, unknown>): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("signature_records").insert({
      packet_signer_id: signerId,
      ...record,
    } as any);
    if (error) throw error;
  }
}

export class SupabaseUserAdapter implements UserAdapter {
  async getById(id: string): Promise<User | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    return data ? toDomainUser(data) : undefined;
  }

  async getByRole(role: string, pagination?: PaginationOptions): Promise<PaginatedResult<User>> {
    const supabase = await createClient();
    const { page, pageSize, from, to } = resolvePagination(pagination);

    const { data, error, count } = await supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("role", role)
      .range(from, to);

    if (error) throw error;
    const users = (data ?? []).map(toDomainUser);
    const total = count ?? 0;
    return { data: users, total, page, pageSize, hasMore: from + users.length < total };
  }

  async getCurrentUser(): Promise<User | undefined> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    return this.getById(user.id);
  }
}

export class SupabaseRegistryAdapter implements RegistryAdapter {
  async getAll(pagination?: PaginationOptions): Promise<PaginatedResult<RegistryEntry>> {
    const supabase = await createClient();
    const { page, pageSize, from, to } = resolvePagination(pagination);

    const { data, error, count } = await supabase
      .from("registry_entries")
      .select("*", { count: "exact" })
      .range(from, to);

    if (error) throw error;
    const entries = (data ?? []).map(toDomainRegistry);
    const total = count ?? 0;
    return { data: entries, total, page, pageSize, hasMore: from + entries.length < total };
  }

  async checkDuplicate(address: string, unit: string | null, startDate: string, endDate: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_duplicate_lease", {
      p_property_address: address,
      p_property_unit: unit,
      p_lease_start: startDate,
      p_lease_end: endDate,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      overlapCount: Number(row?.overlap_count ?? 0),
      earliestStart: row?.earliest_start ?? undefined,
      latestEnd: row?.latest_end ?? undefined,
    };
  }

  async create(entry: Omit<RegistryEntry, "id">): Promise<RegistryEntry> {
    const admin = createAdminClient();
    const { data, error } = await admin.from("registry_entries").insert({
      packet_id: entry.packetId,
      property_address: entry.propertyAddress,
      property_unit: null,
      district: null,
      province: null,
      landlord_dni: entry.landlordNames[0] ?? "",
      renter_dni: entry.renterNames[0] ?? "",
      lease_start_date: entry.leaseStartDate,
      lease_end_date: entry.leaseExpirationDate,
      certified_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return toDomainRegistry(data);
  }
}

export class SupabaseNotaryAdapter implements NotaryAdapter {
  async createAssignment(packetId: string, notaryId: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("notary_assignments").insert({
      packet_id: packetId,
      notary_id: notaryId,
    });
    if (error) throw error;
  }

  async startReview(packetId: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("notary_assignments").update({
      review_started_at: new Date().toISOString(),
    }).eq("packet_id", packetId);
    if (error) throw error;
  }

  async updateDecision(packetId: string, decision: string, observations?: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("notary_assignments").update({
      decision,
      decided_at: new Date().toISOString(),
      observations: observations ?? null,
    }).eq("packet_id", packetId);
    if (error) throw error;
  }

  async createCertification(data: { packetId: string; notaryId: string; type: string; observations?: string; checklistData: Record<string, unknown> }): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("notary_certifications").insert({
      packet_id: data.packetId,
      notary_id: data.notaryId,
      certification_type: data.type,
      observations: data.observations ?? null,
      checklist_data: data.checklistData as Json,
    });
    if (error) throw error;
  }
}

export class SupabasePaymentAdapter implements PaymentAdapter {
  async create(data: { packetId: string; realtorId: string; amount: number; currency: string }): Promise<{ id: string }> {
    const admin = createAdminClient();
    const { data: row, error } = await admin.from("payments").insert({
      packet_id: data.packetId,
      realtor_id: data.realtorId,
      amount: data.amount,
      currency: data.currency,
    }).select("id").single();
    if (error) throw error;
    return { id: row.id };
  }

  async updateStatus(id: string, status: string, providerRef?: string): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("payments").update({
      status,
      payment_provider_ref: providerRef ?? null,
      paid_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) throw error;
  }
}
