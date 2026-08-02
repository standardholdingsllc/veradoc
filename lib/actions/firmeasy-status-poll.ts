"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Lightweight polling action for the completion page.
 * Returns the current signer DB status without side effects.
 */
export async function pollSignerStatus(
  rawToken: string,
): Promise<{ status?: string; error?: string }> {
  try {
    const tokenHash = hashToken(rawToken);
    const admin = createAdminClient();

    const { data: tokenRows } = await admin.rpc("lookup_signing_context", {
      p_token_hash: tokenHash,
    });

    if (!tokenRows || tokenRows.length === 0) {
      return { error: "Token inválido." };
    }

    const tokenRow = tokenRows[0];

    const { data: signerRow } = await admin
      .from("packet_signers")
      .select("status")
      .eq("packet_id", tokenRow.packet_id)
      .eq("signer_email", tokenRow.signer_email)
      .single();

    if (!signerRow) {
      return { error: "Firmante no encontrado." };
    }

    return { status: signerRow.status as string };
  } catch {
    return { error: "Error al consultar estado." };
  }
}
