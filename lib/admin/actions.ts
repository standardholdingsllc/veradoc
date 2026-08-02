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

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

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

  const redirectUrl = `${getBaseUrl()}/auth/callback?invitation=${invitation.token}`;

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

  const redirectUrl = `${getBaseUrl()}/auth/callback?invitation=${invitation.token}`;

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
