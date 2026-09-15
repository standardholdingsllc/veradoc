"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addCoverageSchema,
  createInvitationSchema,
  updateCoverageSchema,
  userActionSchema,
} from "@/lib/auth/schemas";
import { normalizeCoverageText } from "@/lib/coverage/normalize";
import {
  hashPrivatePromoCode,
  promoCodeHint,
} from "@/lib/services/commercial-service";
import { buildNotaryInvitationCallbackUrl } from "@/lib/routing/origins";
import { hasRequiredAdminMfa } from "@/lib/auth/mfa";
import { getCommercialAccountingUnavailableError } from "@/lib/admin/commercial-accounting";

async function verifyAdmin() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return { error: "No autenticado." as const, admin: null!, callerId: null! };
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin" || callerProfile?.status !== "active") {
    return {
      error: "No autorizado." as const,
      admin: null!,
      callerId: null!,
    };
  }

  if (!(await hasRequiredAdminMfa())) {
    return {
      error: "Se requiere verificación MFA para esta acción." as const,
      admin: null!,
      callerId: null!,
    };
  }

  return { error: null, admin, callerId: caller.id };
}

// ---------------------------------------------------------------------------
// Notary invitation management
// ---------------------------------------------------------------------------

export async function createNotaryInvitation(
  email: string,
  province: string,
  department?: string,
): Promise<{ error?: string }> {
  const parsed = createInvitationSchema.safeParse({
    email,
    province,
    department,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const { error: authError, admin, callerId } = await verifyAdmin();
  if (authError) return { error: authError };

  const { data: invitation, error: insertError } = await admin
    .from("invitations")
    .insert({
      email: v.email.trim().toLocaleLowerCase("es-PE"),
      role: "notary",
      invited_by: callerId,
      metadata: {
        province: normalizeCoverageText(v.province),
        department: v.department ? normalizeCoverageText(v.department) : undefined,
      },
    })
    .select("id, token")
    .single();

  if (insertError || !invitation) {
    return { error: "Error al crear la invitación." };
  }

  const redirectUrl = buildNotaryInvitationCallbackUrl(invitation.token);

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    v.email,
    { redirectTo: redirectUrl },
  );

  if (inviteError) {
    await admin.from("invitations").delete().eq("id", invitation.id);
    return { error: "Error al enviar la invitación por correo." };
  }

  revalidatePath("/admin");
  return {};
}

export async function revokeInvitation(
  invitationId: string,
): Promise<{ error?: string }> {
  const parsed = userActionSchema.safeParse({ userId: invitationId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { error } = await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    return { error: "Error al revocar la invitación." };
  }

  revalidatePath("/admin");
  return {};
}

export async function resendInvitation(
  invitationId: string,
): Promise<{ error?: string }> {
  const parsed = userActionSchema.safeParse({ userId: invitationId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { data: invitation, error: lookupError } = await admin
    .from("invitations")
    .select("id, email, token, status, expires_at")
    .eq("id", invitationId)
    .single();

  if (lookupError || !invitation) {
    return { error: "Invitación no encontrada." };
  }

  if (invitation.status !== "pending") {
    return { error: "Solo se pueden reenviar invitaciones pendientes." };
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return { error: "La invitación ha expirado." };
  }

  const redirectUrl = buildNotaryInvitationCallbackUrl(invitation.token);

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    invitation.email,
    { redirectTo: redirectUrl },
  );

  if (inviteError) {
    return { error: "Error al reenviar la invitación." };
  }

  await admin
    .from("invitations")
    .update({
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", invitationId);

  revalidatePath("/admin");
  return {};
}

// ---------------------------------------------------------------------------
// Notary coverage management
// ---------------------------------------------------------------------------

export async function addNotaryCoverage(
  notaryId: string,
  province: string,
  department?: string,
): Promise<{ error?: string }> {
  const parsed = addCoverageSchema.safeParse({
    notaryId,
    province,
    department,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { error } = await admin.from("notary_coverage").insert({
    notary_id: v.notaryId,
    province: normalizeCoverageText(v.province),
    department: v.department ? normalizeCoverageText(v.department) : null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Este notario ya tiene cobertura en esta provincia." };
    }
    return { error: "Error al agregar cobertura." };
  }

  revalidatePath("/admin");
  return {};
}

export async function updateNotaryCoverage(
  coverageId: string,
  notaryId: string,
  province: string,
  department?: string,
): Promise<{ error?: string }> {
  const parsed = updateCoverageSchema.safeParse({
    coverageId,
    notaryId,
    province,
    department,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { error } = await admin
    .from("notary_coverage")
    .update({
      notary_id: v.notaryId,
      province: normalizeCoverageText(v.province),
      department: v.department ? normalizeCoverageText(v.department) : null,
    })
    .eq("id", v.coverageId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Este notario ya tiene cobertura en esta provincia." };
    }
    return { error: "Error al editar cobertura." };
  }

  revalidatePath("/admin");
  return {};
}

export async function toggleCoverageStatus(
  coverageId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { error } = await admin
    .from("notary_coverage")
    .update({ active })
    .eq("id", coverageId);

  if (error) {
    return { error: "Error al actualizar el estado de cobertura." };
  }

  revalidatePath("/admin");
  return {};
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export async function suspendUser(
  userId: string,
): Promise<{ error?: string }> {
  const parsed = userActionSchema.safeParse({ userId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { data: target } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single();

  if (!target) {
    return { error: "Usuario no encontrado." };
  }

  if (target.role === "admin") {
    return { error: "No se puede suspender a un administrador." };
  }

  const previousStatus = target.status;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) {
    return { error: "Error al suspender el usuario." };
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const existingMeta = userData?.user?.app_metadata ?? {};

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...existingMeta, status: "suspended" },
  });

  if (metaError) {
    await admin
      .from("profiles")
      .update({ status: previousStatus })
      .eq("id", userId);
    return { error: "Error al actualizar los permisos del usuario." };
  }

  revalidatePath("/admin");
  return {};
}

export async function reactivateUser(
  userId: string,
): Promise<{ error?: string }> {
  const parsed = userActionSchema.safeParse({ userId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error: authError, admin } = await verifyAdmin();
  if (authError) return { error: authError };

  const { data: target } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single();

  if (!target) {
    return { error: "Usuario no encontrado." };
  }

  const previousStatus = target.status;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) {
    return { error: "Error al reactivar el usuario." };
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const existingMeta = userData?.user?.app_metadata ?? {};

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...existingMeta, status: "active" },
  });

  if (metaError) {
    await admin
      .from("profiles")
      .update({ status: previousStatus })
      .eq("id", userId);
    return { error: "Error al actualizar los permisos del usuario." };
  }

  revalidatePath("/admin");
  return {};
}

// ---------------------------------------------------------------------------
// Contracted notary rates and monthly payout confirmation
// ---------------------------------------------------------------------------

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

export async function setNotaryContractedRate(
  notaryId: string,
  participationPercent: number,
  effectiveFrom: string,
  contractReference?: string,
): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!notaryId || !Number.isFinite(participationPercent) || participationPercent <= 0 || participationPercent > 100) {
    return { error: "Ingrese un porcentaje contractual válido." };
  }
  if (!isIsoDate(effectiveFrom)) {
    return { error: "Ingrese una fecha de vigencia válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notary_percentage_terms", {
    p_notary_id: notaryId,
    p_participation_percent: participationPercent,
    p_effective_from: effectiveFrom,
    p_contract_reference: contractReference?.trim() || undefined,
    p_protect_promos: true,
  });
  if (error) return { error: `No se pudo guardar la tarifa: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/notario");
  revalidatePath("/notario/ganancias");
  return {};
}

export async function confirmNotaryMonthlyPayout(
  notaryId: string,
  periodMonth: string,
  notes?: string,
): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  const monthDate = `${periodMonth}-01`;
  if (!/^\d{4}-\d{2}$/.test(periodMonth) || !isIsoDate(monthDate)) {
    return { error: "Seleccione un mes válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("prepare_notary_monthly_payout_v2", {
    p_notary_id: notaryId,
    p_period_month: monthDate,
    p_notes: notes?.trim() || undefined,
  });
  if (error) return { error: `No se pudo preparar el pago: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/notario/ganancias");
  return {};
}

export async function approveNotaryMonthlyPayout(
  payoutId: string,
  notaryComprobanteReference: string,
  notaryIgvPen: number,
  notes?: string,
): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!payoutId || !notaryComprobanteReference.trim()) {
    return { error: "Ingrese el comprobante emitido por el notario." };
  }
  if (!Number.isFinite(notaryIgvPen) || notaryIgvPen < 0) {
    return { error: "Ingrese un IGV válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_notary_monthly_payout", {
    p_payout_id: payoutId,
    p_notary_comprobante_reference: notaryComprobanteReference.trim(),
    p_notary_igv_centimos: Math.round(notaryIgvPen * 100),
    p_notes: notes?.trim() || undefined,
  });
  if (error) return { error: `No se pudo aprobar el desembolso: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/notario/ganancias");
  return {};
}

export async function markNotaryPayoutPaid(
  payoutId: string,
  paymentReference: string,
  notes?: string,
): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!payoutId || !paymentReference.trim()) {
    return { error: "Ingrese la referencia del desembolso." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notary_payout_paid", {
    p_payout_id: payoutId,
    p_payment_reference: paymentReference.trim(),
    p_notes: notes?.trim() || undefined,
  });
  if (error) return { error: `No se pudo registrar el desembolso: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/notario/ganancias");
  return {};
}

// ---------------------------------------------------------------------------
// Commercial finance operations
// ---------------------------------------------------------------------------

export async function createPrivatePromoCodeAction(params: {
  code: string;
  description: string;
  discountPen: number;
  validUntil: string;
  boundRealtorId?: string;
  maxRedemptions: number;
}): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!params.code.trim() || params.description.trim().length < 3) {
    return { error: "Ingrese el código y el motivo de la promoción." };
  }
  if (!Number.isFinite(params.discountPen) || params.discountPen <= 0 || params.discountPen >= 199) {
    return { error: "El descuento debe estar entre S/0.01 y S/198.99." };
  }
  if (!Number.isInteger(params.maxRedemptions) || params.maxRedemptions < 1) {
    return { error: "El límite de usos debe ser un entero positivo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_private_promo_code", {
    p_code_hash: hashPrivatePromoCode(params.code),
    p_code_hint: promoCodeHint(params.code),
    p_description: params.description.trim(),
    p_discount_centimos: Math.round(params.discountPen * 100),
    p_valid_until: new Date(`${params.validUntil}T23:59:59-05:00`).toISOString(),
    p_bound_realtor_id: params.boundRealtorId || undefined,
    p_max_redemptions: params.maxRedemptions,
  });
  if (error) return { error: `No se pudo crear la promoción: ${error.message}` };
  revalidatePath("/admin");
  return {};
}

export async function recordPacketDirectCostAction(params: {
  packetId: string;
  paymentId?: string;
  category: string;
  provider: string;
  amountPen: number;
  costStatus: "estimated" | "actual" | "reversal";
  evidenceReference: string;
  allocationMethod?: string;
  sourceId: string;
}): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!params.packetId || !params.sourceId.trim() || params.evidenceReference.trim().length < 3) {
    return { error: "Paquete, identificador de origen y evidencia son obligatorios." };
  }
  if (!Number.isFinite(params.amountPen) || params.amountPen === 0) {
    return { error: "El costo debe ser distinto de cero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_packet_direct_cost", {
    p_packet_id: params.packetId,
    p_payment_id: params.paymentId || null,
    p_category: params.category,
    p_provider: params.provider,
    p_amount_centimos: Math.round(params.amountPen * 100),
    p_cost_status: params.costStatus,
    p_evidence_reference: params.evidenceReference.trim(),
    p_allocation_method: params.allocationMethod?.trim() || null,
    p_source_id: params.sourceId.trim(),
  });
  if (error) return { error: `No se pudo registrar el costo: ${error.message}` };
  revalidatePath("/admin");
  return {};
}

export async function setPacketArchivalHoldAction(params: {
  packetId: string;
  holdUntil: string;
  reason: string;
}): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const unavailableError = getCommercialAccountingUnavailableError();
  if (unavailableError) return { error: unavailableError };
  if (!params.packetId || params.reason.trim().length < 5) {
    return { error: "Ingrese el paquete y el motivo de la retención." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_packet_archival_hold", {
    p_packet_id: params.packetId,
    p_hold_until: new Date(`${params.holdUntil}T23:59:59-05:00`).toISOString(),
    p_reason: params.reason.trim(),
  });
  if (error) return { error: `No se pudo retener el archivo: ${error.message}` };
  revalidatePath("/admin");
  return {};
}
