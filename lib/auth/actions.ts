"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCoverageText } from "@/lib/coverage/normalize";
import { getDashboardForRole } from "@/lib/auth/constants";
import { buildAbsoluteUrl } from "@/lib/routing/origins";
import { classifyHost } from "@/lib/routing/surfaces";
import { getPublicTargetForRole } from "@/lib/routing/targets";
import type { CanonicalSurface, Surface } from "@/lib/routing/types";
import { hasRequiredAdminMfa } from "@/lib/auth/mfa";
import {
  approveRealtorSchema,
  createSignerAccountSchema,
  googleRealtorSignupSchema,
  loginSchema,
  realtorSignupSchema,
  rejectRealtorSchema,
} from "@/lib/auth/schemas";
import type { AppMetadata, ProfileRole } from "@/lib/auth/types";
import {
  notifyRealtorSignupReceived,
  notifyRealtorApproved,
  notifyRealtorRejected,
} from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<{ error?: string; redirect?: string }> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Credenciales inválidas. Intente nuevamente." };
  }

  const meta = (data.user.app_metadata ?? {}) as AppMetadata;
  const role = meta.role;

  if (!role) {
    return { redirect: "/auth/pending-approval" };
  }

  const currentSurface = await getRequestSurface();
  const target = getPublicTargetForRole(role);
  if (
    currentSurface !== "local" &&
    currentSurface !== "preview" &&
    currentSurface !== target.surface
  ) {
    await supabase.auth.signOut();
    return {
      redirect: buildAbsoluteUrl(
        { surface: target.surface, path: "/auth/login" },
        { error: "wrong-surface" },
      ),
    };
  }

  if (meta.status === "suspended") {
    await supabase.auth.signOut();
    return {
      error:
        "Esta cuenta está suspendida. Comuníquese con soporte para solicitar una revisión.",
    };
  }

  if (meta.status === "pending_approval") {
    return { redirect: "/auth/pending-approval" };
  }

  if (meta.status === "rejected") {
    return { redirect: "/auth/rejected" };
  }

  return { redirect: getDashboardForRole(role) };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(): Promise<{ redirect: string }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { redirect: "/auth/login" };
}

// ---------------------------------------------------------------------------
// Realtor self-signup (requires admin approval)
// ---------------------------------------------------------------------------

export async function signupRealtor(
  data: {
    fullName: string;
    email: string;
    password: string;
    dni: string;
    licenseNumber?: string;
    province: string;
    department?: string;
    companyName?: string;
    ruc?: string;
    phone?: string;
  },
): Promise<{ error?: string }> {
  const parsed = realtorSignupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  if (!(await isAllowedRequestSurface(["app"]))) {
    return { error: "El registro de agentes solo está disponible en app.veradoc.pe." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: buildAbsoluteUrl({
        surface: "app",
        path: "/auth/callback",
      }),
    },
  });

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      return { error: "Este correo electrónico ya está registrado." };
    }
    return { error: "Error al crear la cuenta. Intente nuevamente." };
  }

  const userId = signUpData.user?.id;
  if (!userId) {
    return { error: "Error inesperado al crear la cuenta." };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: "realtor" as ProfileRole, status: "pending_approval" },
  });

  if (metaError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Error al configurar la cuenta. Intente nuevamente." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "realtor",
    status: "pending_approval",
    full_name: v.fullName,
    email: v.email,
    phone: v.phone || null,
    dni: v.dni,
    license_number: v.licenseNumber || null,
    province: v.province,
    department: v.department || null,
    company_name: v.companyName || null,
    ruc: v.ruc || null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Error al crear el perfil. Intente nuevamente." };
  }

  void notifyRealtorSignupReceived({ email: v.email, fullName: v.fullName });

  return {};
}

// ---------------------------------------------------------------------------
// Approve realtor (admin only)
// ---------------------------------------------------------------------------

export async function approveRealtor(
  userId: string,
  province: string,
): Promise<{ error?: string }> {
  const parsed = approveRealtorSchema.safeParse({ userId, province });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return { error: "No autenticado." };
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin" || callerProfile?.status !== "active") {
    return { error: "No autorizado." };
  }

  if (!(await isAllowedRequestSurface(["admin"])) || !(await hasRequiredAdminMfa())) {
    return { error: "Se requiere acceso administrativo con MFA." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      status: "active",
      province: normalizeCoverageText(v.province),
      approved_by: caller.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.userId);

  if (profileError) {
    return { error: "Error al actualizar el perfil del agente." };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(v.userId, {
    app_metadata: {
      role: "realtor",
      status: "active",
      province: normalizeCoverageText(v.province),
    },
  });

  if (metaError) {
    await admin
      .from("profiles")
      .update({ status: "pending_approval", province: null, approved_by: null, approved_at: null })
      .eq("id", v.userId);
    return { error: "Error al actualizar los permisos del agente." };
  }

  const { data: realtorProfile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", v.userId)
    .single();

  if (realtorProfile?.email) {
    void notifyRealtorApproved({
      email: realtorProfile.email,
      fullName: realtorProfile.full_name ?? "",
    });
  }

  return {};
}

// ---------------------------------------------------------------------------
// Reject realtor (admin only)
// ---------------------------------------------------------------------------

export async function rejectRealtor(
  userId: string,
  reason = "",
): Promise<{ error?: string }> {
  const parsed = rejectRealtorSchema.safeParse({ userId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return { error: "No autenticado." };
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin" || callerProfile?.status !== "active") {
    return { error: "No autorizado." };
  }

  if (!(await isAllowedRequestSurface(["admin"])) || !(await hasRequiredAdminMfa())) {
    return { error: "Se requiere acceso administrativo con MFA." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.userId);

  if (profileError) {
    return { error: "Error al rechazar al agente." };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(v.userId, {
    app_metadata: {
      role: "realtor",
      status: "rejected",
      rejection_reason: v.reason.trim() || undefined,
    },
  });

  if (metaError) {
    await admin
      .from("profiles")
      .update({ status: "pending_approval" })
      .eq("id", v.userId);
    return { error: "Error al actualizar los permisos." };
  }

  const { data: realtorProfile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", v.userId)
    .single();

  if (realtorProfile?.email) {
    void notifyRealtorRejected({
      email: realtorProfile.email,
      fullName: realtorProfile.full_name ?? "",
      reason: v.reason.trim() || undefined,
    });
  }

  return {};
}

// ---------------------------------------------------------------------------
// Create signer account (token-validated, session handoff)
// ---------------------------------------------------------------------------

export async function createSignerAccount(
  token: string,
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const parsed = createSignerAccountSchema.safeParse({ token, email, password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  if (!(await isAllowedRequestSurface(["app"]))) {
    return { error: "Este enlace debe abrirse en app.veradoc.pe." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const tokenHash = await hashToken(v.token);

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_signing_token",
    { p_token_hash: tokenHash },
  );

  if (claimError || !claimed || claimed.length === 0) {
    return { error: "Enlace de firma inválido, expirado o ya utilizado." };
  }

  const signerData = claimed[0];

  if (v.email.toLowerCase() !== signerData.signer_email.toLowerCase()) {
    await resetTokenToOtpVerified(admin, signerData.id);
    return { error: "El correo electrónico no coincide con el registrado." };
  }

  const { data: newUser, error: createError } =
    await admin.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
    });

  if (createError || !newUser.user) {
    await resetTokenToOtpVerified(admin, signerData.id);

    if (createError?.message?.includes("already been registered")) {
      return { error: "Este correo electrónico ya está registrado." };
    }
    return { error: "Error al crear la cuenta. Intente nuevamente." };
  }

  const userId = newUser.user.id;
  const roleInLease = signerData.role_in_lease as "landlord" | "renter";

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: roleInLease, status: "active" },
  });

  if (metaError) {
    await admin.auth.admin.deleteUser(userId);
    await resetTokenToOtpVerified(admin, signerData.id);
    return { error: "Error al configurar la cuenta. Intente nuevamente." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: roleInLease,
    status: "active",
    full_name: signerData.signer_full_name,
    email: signerData.signer_email,
    dni: signerData.signer_dni,
    phone: signerData.signer_whatsapp,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    await resetTokenToOtpVerified(admin, signerData.id);
    return { error: "Error al crear el perfil. Intente nuevamente." };
  }

  // Token finalization is treated as non-fatal after this point. The auth user
  // and profile exist and are functional. If this update fails, the token stays
  // in "claiming" status — downstream signing logic should NOT rely solely on
  // signing_tokens.status = 'account_created' to determine whether the signer
  // has an account. Instead, check for the presence of auth_user_id or query
  // the profiles table. A background reconciliation job can sweep tokens stuck
  // in "claiming" where auth_user_id IS NOT NULL and finalize them.
  const { error: finalizeError } = await admin
    .from("signing_tokens")
    .update({
      status: "account_created",
      auth_user_id: userId,
      consumed_at: new Date().toISOString(),
    })
    .eq("id", signerData.id);

  if (finalizeError) {
    console.error("Failed to finalize signing token:", finalizeError);
  }

  // Advance packet_signers status to account_created
  const { data: signerRow } = await admin
    .from("packet_signers")
    .select("id")
    .eq("signing_token_id", signerData.id)
    .single();

  if (signerRow) {
    const { error: advanceError } = await admin.rpc("advance_signer_status", {
      p_signer_id: signerRow.id,
      p_new_status: "account_created",
      p_profile_id: userId,
    });
    if (advanceError) {
      console.error("Failed to advance signer status:", advanceError);
    }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: v.email,
    password: v.password,
  });

  if (signInError) {
    console.error("Session handoff failed:", signInError);
  }

  return {};
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export async function loginWithGoogle(): Promise<{ url?: string; error?: string }> {
  if (!(await isAllowedRequestSurface(["app"]))) {
    return { error: "El acceso con Google está disponible en app.veradoc.pe." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildAbsoluteUrl({ surface: "app", path: "/auth/callback" }),
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    return { error: "Error al iniciar sesión con Google." };
  }

  return { url: data.url };
}

// ---------------------------------------------------------------------------
// Complete Google signup (realtor who authenticated via Google, needs profile)
// ---------------------------------------------------------------------------

export async function completeGoogleSignup(
  data: {
    fullName: string;
    dni: string;
    licenseNumber?: string;
    province: string;
    department?: string;
    companyName?: string;
    ruc?: string;
    phone?: string;
  },
): Promise<{ error?: string }> {
  const parsed = googleRealtorSignupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No autenticado. Inicie sesión nuevamente." };
  }

  const meta = (user.app_metadata ?? {}) as AppMetadata;
  if (meta.role) {
    return { error: "Esta cuenta ya tiene un rol asignado." };
  }

  // Verify this user authenticated via Google OAuth (not magic-link or other flows)
  const isGoogleUser = user.app_metadata?.provider === "google"
    || user.app_metadata?.providers?.includes("google")
    || user.identities?.some((id: { provider: string }) => id.provider === "google");

  if (!isGoogleUser) {
    return { error: "Esta acción solo está disponible para cuentas autenticadas con Google." };
  }

  // Verify no profile already exists (defense against duplicate calls)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return { error: "Ya existe un perfil para esta cuenta." };
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: "realtor" as ProfileRole, status: "pending_approval" },
  });

  if (metaError) {
    return { error: "Error al configurar la cuenta. Intente nuevamente." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    role: "realtor",
    status: "pending_approval",
    full_name: v.fullName,
    email: user.email!,
    phone: v.phone || null,
    dni: v.dni,
    license_number: v.licenseNumber || null,
    province: v.province,
    department: v.department || null,
    company_name: v.companyName || null,
    ruc: v.ruc || null,
  });

  if (profileError) {
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { role: null, status: null },
    });
    return { error: "Error al crear el perfil. Intente nuevamente." };
  }

  void notifyRealtorSignupReceived({ email: user.email!, fullName: v.fullName });

  return {};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRequestSurface(): Promise<Surface> {
  const requestHeaders = await headers();
  return classifyHost(requestHeaders.get("host"), {
    vercelEnvironment: process.env.VERCEL_ENV,
    vercelHostname: [
      process.env.VERCEL_URL ?? "",
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    ],
  }).surface;
}

async function isAllowedRequestSurface(
  allowed: CanonicalSurface[],
): Promise<boolean> {
  const surface = await getRequestSurface();
  return surface === "local" || surface === "preview" || allowed.includes(surface as CanonicalSurface);
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function resetTokenToOtpVerified(
  admin: ReturnType<typeof createAdminClient>,
  tokenId: string,
): Promise<void> {
  await admin
    .from("signing_tokens")
    .update({ status: "otp_verified" })
    .eq("id", tokenId);
}
