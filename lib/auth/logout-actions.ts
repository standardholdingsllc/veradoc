"use server";

import { redirect } from "next/navigation";
import { logout } from "@/lib/auth/actions";

export async function logoutAndRedirect(): Promise<never> {
  const result = await logout();
  redirect(result.redirect);
}
