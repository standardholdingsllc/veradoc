"use server";

import { revalidatePath } from "next/cache";
import { requireAdminMfa } from "@/lib/auth/mfa";
import { writeAdminDemoControl } from "@/lib/demo/admin-control";

export async function setDemoAvailability(enabled: boolean): Promise<{
  error?: string;
  enabled?: boolean;
  updatedAt?: string;
}> {
  const admin = await requireAdminMfa();
  try {
    const state = await writeAdminDemoControl(enabled, admin.id);
    revalidatePath("/admin");
    return { enabled: state.enabled, updatedAt: state.updatedAt };
  } catch {
    return { error: "No se pudo actualizar la disponibilidad de la demo." };
  }
}
