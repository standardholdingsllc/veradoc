import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbSignerStatus } from "@/lib/domain/status-mapping";

export interface SigningContext {
  token: string;
  tokenId: string;
  packetId: string;
  signerId: string;
  signerEmail: string;
  signerName: string;
  signerWhatsapp: string;
  signerDni: string;
  roleInLease: "landlord" | "renter";
  signerStatus: DbSignerStatus;
  tokenStatus: string;
  tokenExpiry: string;
  propertyAddress: string;
  realtorName: string;
  profileId?: string;
}

export interface SigningContextError {
  code: "invalid_token" | "expired_token" | "revoked_token" | "server_error";
  message: string;
}

export type SigningContextResult =
  | { ok: true; data: SigningContext }
  | { ok: false; error: SigningContextError };

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function resolveSigningContext(
  rawToken: string,
): Promise<SigningContextResult> {
  const admin = createAdminClient();
  const tokenHash = hashToken(rawToken);

  const { data: tokenRows, error: tokenError } = await admin.rpc(
    "lookup_signing_context",
    { p_token_hash: tokenHash },
  );

  if (tokenError || !tokenRows || tokenRows.length === 0) {
    return {
      ok: false,
      error: { code: "invalid_token", message: "Enlace de firma inválido." },
    };
  }

  const tokenRow = tokenRows[0];

  if (tokenRow.token_status === "expired" || new Date(tokenRow.expires_at) < new Date()) {
    return {
      ok: false,
      error: { code: "expired_token", message: "Este enlace de firma ha expirado." },
    };
  }

  if (tokenRow.token_status === "revoked") {
    return {
      ok: false,
      error: { code: "revoked_token", message: "Este enlace de firma ha sido revocado." },
    };
  }

  const { data: signerRow, error: signerError } = await admin
    .from("packet_signers")
    .select("id, status, profile_id")
    .eq("packet_id", tokenRow.packet_id)
    .eq("signer_email", tokenRow.signer_email)
    .single();

  if (signerError || !signerRow) {
    return {
      ok: false,
      error: { code: "server_error", message: "No se encontró el firmante asociado." },
    };
  }

  const { data: packet } = await admin
    .from("lease_packets")
    .select("property_address, property_unit, district, created_by")
    .eq("id", tokenRow.packet_id)
    .single();

  let realtorName = "Agente inmobiliario";
  if (packet?.created_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", packet.created_by)
      .single();
    if (profile?.full_name) realtorName = profile.full_name;
  }

  const unit = packet?.property_unit ? `, ${packet.property_unit}` : "";
  const district = packet?.district ? `, ${packet.district}` : "";
  const propertyAddress = `${packet?.property_address ?? ""}${unit}${district}`;

  return {
    ok: true,
    data: {
      token: rawToken,
      tokenId: tokenRow.token_id,
      packetId: tokenRow.packet_id,
      signerId: signerRow.id,
      signerEmail: tokenRow.signer_email,
      signerName: tokenRow.signer_full_name,
      signerWhatsapp: (tokenRow as Record<string, unknown>).signer_whatsapp as string ?? "",
      signerDni: (tokenRow as Record<string, unknown>).signer_dni as string ?? "",
      roleInLease: tokenRow.role_in_lease as "landlord" | "renter",
      signerStatus: signerRow.status as DbSignerStatus,
      tokenStatus: tokenRow.token_status,
      tokenExpiry: tokenRow.expires_at,
      propertyAddress,
      realtorName,
      profileId: signerRow.profile_id ?? undefined,
    },
  };
}
