"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApproved } from "@/lib/auth/guards";
import { isLeaseExpired } from "@/lib/formatters";
import { updatePartyProfileSchema } from "@/lib/schemas/packet-schemas";

import {
  changePasswordAction as _changePasswordAction,
  getDocumentDownloadUrl as _getDocumentDownloadUrl,
} from "@/lib/actions/agente-actions";

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
) {
  return _changePasswordAction(currentPassword, newPassword);
}

export async function getPartyDocumentDownloadUrl(
  packetId: string,
  documentId: string,
) {
  return _getDocumentDownloadUrl(packetId, documentId);
}

type ActionResult<T = null> = { error?: string; data?: T };

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Get Party Contracts (dashboard list)
// ---------------------------------------------------------------------------

export async function getPartyContracts(role: "landlord" | "renter") {
  const profile = await requireApproved(
    role === "landlord" ? "landlord" : "renter",
  );
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packet_signers")
    .select(
      `
      id,
      role_in_lease,
      signer_full_name,
      signer_dni,
      signer_whatsapp,
      status,
      signed_at,
      completed_at,
      lease_packets!inner (
        id,
        packet_code,
        status,
        property_address,
        property_unit,
        district,
        province,
        rental_amount,
        lease_start_date,
        lease_end_date,
        document_hash,
        created_at,
        updated_at,
        certified_at
      )
    `,
    )
    .eq("profile_id", profile.id)
    .eq("role_in_lease", role);

  // Sort by packet activity (updated_at) descending. PostgREST .order()
  // applies to the top-level table (packet_signers), not the joined
  // lease_packets, so sort in application code.
  const sorted = (data ?? []).sort((a, b) => {
    const aDate =
      (a.lease_packets as Record<string, unknown>)?.updated_at ?? "";
    const bDate =
      (b.lease_packets as Record<string, unknown>)?.updated_at ?? "";
    return String(bDate).localeCompare(String(aDate));
  });

  return { data: sorted, error: error?.message };
}

// ---------------------------------------------------------------------------
// Get Party Contract Detail (role-verified)
// ---------------------------------------------------------------------------

export async function getPartyContractDetail(
  packetId: string,
  role: "landlord" | "renter",
) {
  const profile = await requireApproved(
    role === "landlord" ? "landlord" : "renter",
  );
  const supabase = await createClient();

  // Verify the user is a signer on this packet WITH the correct role.
  // RLS alone does not distinguish roles -- it only checks profile_id.
  const { data: signerRecord } = await supabase
    .from("packet_signers")
    .select("*")
    .eq("packet_id", packetId)
    .eq("profile_id", profile.id)
    .eq("role_in_lease", role)
    .single();

  if (!signerRecord) return { error: "Contrato no encontrado." as const };

  const [
    { data: packet },
    { data: documents },
    { data: auditLog },
    { data: certification },
  ] = await Promise.all([
    supabase.from("lease_packets").select("*").eq("id", packetId).single(),
    supabase
      .from("packet_documents")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at"),
    supabase
      .from("packet_audit_log")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at"),
    supabase
      .from("notary_certifications")
      .select("certification_type")
      .eq("packet_id", packetId)
      .limit(1),
  ]);

  if (!packet) return { error: "Contrato no encontrado." as const };

  const { data: evidence } = await supabase
    .from("signer_evidence")
    .select("*")
    .eq("packet_signer_id", signerRecord.id)
    .order("created_at");

  return {
    data: {
      packet,
      signerRecord,
      documents: documents ?? [],
      auditLog: auditLog ?? [],
      evidence: evidence ?? [],
      certType: certification?.[0]?.certification_type ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Start Renewal (landlord-initiated draft linked to original packet)
// ---------------------------------------------------------------------------

export async function startRenewalAction(
  packetId: string,
): Promise<ActionResult<{ renewalPacketId: string }>> {
  const profile = await requireApproved("landlord");
  const supabase = await createClient();

  const { data: signerRecord } = await supabase
    .from("packet_signers")
    .select("id")
    .eq("packet_id", packetId)
    .eq("profile_id", profile.id)
    .eq("role_in_lease", "landlord")
    .single();

  if (!signerRecord) return { error: "Contrato no encontrado." };

  const { data: packet } = await supabase
    .from("lease_packets")
    .select(
      `
      id,
      created_by,
      status,
      property_address,
      property_unit,
      district,
      province,
      department,
      rental_amount,
      deposit_amount,
      lease_end_date,
      renewed_by_packet_id
    `,
    )
    .eq("id", packetId)
    .single();

  if (!packet) return { error: "Contrato no encontrado." };
  if (packet.status !== "certified") {
    return { error: "Solo se pueden renovar contratos certificados." };
  }
  if (!packet.lease_end_date || !isLeaseExpired(packet.lease_end_date)) {
    return { error: "El contrato aún no está vencido." };
  }
  if (packet.renewed_by_packet_id) {
    return { data: { renewalPacketId: packet.renewed_by_packet_id } };
  }

  const { data: signers } = await supabase
    .from("packet_signers")
    .select(
      "profile_id, role_in_lease, signer_email, signer_full_name, signer_dni, signer_whatsapp",
    )
    .eq("packet_id", packetId);

  if (!signers || signers.length === 0) {
    return { error: "No se encontraron firmantes para renovar." };
  }

  const admin = createAdminClient();
  const renewalPacketId = crypto.randomUUID();
  const now = new Date().toISOString();
  const nextStartDate = new Date(`${packet.lease_end_date}T00:00:00.000Z`);
  nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);

  const { error: insertError } = await admin.from("lease_packets").insert({
    id: renewalPacketId,
    created_by: packet.created_by,
    parent_packet_id: packet.id,
    status: "draft",
    property_address: packet.property_address,
    property_unit: packet.property_unit,
    district: packet.district,
    province: packet.province,
    department: packet.department,
    rental_amount: packet.rental_amount,
    deposit_amount: packet.deposit_amount,
    lease_start_date: nextStartDate.toISOString().slice(0, 10),
    lease_end_date: null,
    document_hash: null,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    return { error: `Error al crear renovación: ${insertError.message}` };
  }

  const { error: signerError } = await admin.from("packet_signers").insert(
    signers.map((signer) => ({
      packet_id: renewalPacketId,
      profile_id: signer.profile_id,
      role_in_lease: signer.role_in_lease,
      signer_email: signer.signer_email,
      signer_full_name: signer.signer_full_name,
      signer_dni: signer.signer_dni,
      signer_whatsapp: signer.signer_whatsapp,
      status: "invited",
    })),
  );

  if (signerError) {
    return { error: `Error al copiar firmantes: ${signerError.message}` };
  }

  await admin
    .from("lease_packets")
    .update({ renewed_by_packet_id: renewalPacketId, updated_at: now })
    .eq("id", packetId);

  await admin.from("packet_audit_log").insert([
    {
      packet_id: packetId,
      actor_id: profile.id,
      action: "renewal_started",
      metadata: { renewal_packet_id: renewalPacketId },
    },
    {
      packet_id: renewalPacketId,
      actor_id: profile.id,
      action: "renewal_packet_created",
      metadata: { parent_packet_id: packetId },
    },
  ]);

  revalidatePath("/arrendador");
  revalidatePath("/arrendador/contratos");
  revalidatePath(`/arrendador/contratos/${packetId}`);
  revalidatePath(`/arrendador/contratos/${renewalPacketId}`);
  revalidatePath("/agente");

  return { data: { renewalPacketId } };
}

// ---------------------------------------------------------------------------
// Update Party Profile
// ---------------------------------------------------------------------------

export async function updatePartyProfile(
  input: unknown,
): Promise<ActionResult> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { error: "No autenticado." };

  const parsed = updatePartyProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
    })
    .eq("id", userId);

  if (error)
    return { error: `Error al actualizar perfil: ${error.message}` };

  revalidatePath("/arrendador/perfil");
  revalidatePath("/arrendatario/perfil");
  return {};
}
