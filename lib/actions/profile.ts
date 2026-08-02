"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "@/lib/schemas/packet-schemas";

type ActionResult = { error?: string };

export async function updateProfileAction(
  input: unknown,
  revalidatePaths?: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      company_name: parsed.data.company_name ?? null,
      ruc: parsed.data.ruc ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: `Error al actualizar perfil: ${error.message}` };
  }

  for (const p of revalidatePaths ?? []) {
    revalidatePath(p);
  }

  return {};
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword,
    newPassword,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No autenticado." };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Contraseña actual incorrecta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { error: `Error al cambiar contraseña: ${updateError.message}` };
  }

  return {};
}
