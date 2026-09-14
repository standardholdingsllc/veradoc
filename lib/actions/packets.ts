"use server";

import { createClient } from "@/lib/supabase/server";
import { SupabasePacketAdapter } from "@/lib/adapters/supabase-adapter";
import { z } from "zod";
import type { LeasePacket } from "@/lib/domain/types";

const createPacketSchema = z.object({
  propertyAddress: z.string().min(1),
  propertyUnit: z.string().optional(),
  district: z.string().min(1),
  province: z.string().min(1),
  department: z.string().min(1),
  monthlyRent: z.number().positive(),
  depositAmount: z.number().nonnegative(),
  startDate: z.string(),
  endDate: z.string(),
  documentHash: z.string(),
  signers: z.array(z.object({
    roleInLease: z.enum(["landlord", "renter"]),
    fullName: z.string().min(1),
    email: z.string().email(),
    whatsapp: z.string().min(1),
    dni: z.string().min(1),
  })).min(1),
});

export async function createPacketAction(input: z.infer<typeof createPacketSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "realtor" || profile.status !== "active") {
    throw new Error("Unauthorized: must be an active realtor");
  }

  const validated = createPacketSchema.parse(input);
  const adapter = new SupabasePacketAdapter();

  const packet: LeasePacket = {
    id: "",
    packetCode: "",
    version: 1,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByRealtorId: user.id,
    leaseDocument: { fileName: "contract.pdf", uploadedAt: new Date().toISOString(), initialHash: validated.documentHash },
    property: {
      address: validated.propertyAddress,
      district: validated.district,
      province: validated.province,
      department: validated.department,
      unit: validated.propertyUnit,
      normalizedAddressKey: "",
    },
    leaseTerms: {
      monthlyRent: validated.monthlyRent,
      depositAmount: validated.depositAmount,
      currency: "PEN",
      startDate: validated.startDate,
      expirationDate: validated.endDate,
      durationMonths: 12,
      useType: "residential",
    },
    signers: [],
    payment: { status: "pending", amount: 0, currency: "PEN", paymentMethodPlaceholder: "" },
    documentHashes: [],
    registryCheck: { status: "pending", matchFound: false },
    auditEvents: [],
    renewalEligibility: { eligible: false },
  };

  return adapter.create(packet);
}

export async function getPacketsAction(filters?: { status?: string }) {
  const adapter = new SupabasePacketAdapter();
  return adapter.getAll(filters);
}

export async function getPacketAction(id: string) {
  const adapter = new SupabasePacketAdapter();
  return adapter.getById(id);
}

export async function submitToNotaryAction(packetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const adapter = new SupabasePacketAdapter();
  const packet = await adapter.getById(packetId);
  if (!packet) throw new Error("Packet not found");
  if (packet.createdByRealtorId !== user.id) throw new Error("Not your packet");

  await adapter.updateStatus(packetId, "pending_notary", user.id, "submitted_to_notary");
}
