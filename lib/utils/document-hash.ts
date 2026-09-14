import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentHashEntry } from "@/lib/domain/types";
import type { Database } from "@/lib/supabase/database.types";

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export interface HashAuditEntry {
  stage: "initial_upload" | "post_signatures" | "final_certified" | "notarial_scan" | "certification_report";
  algorithm: "SHA-256";
  hash: string;
  storagePath: string;
  documentType: string;
}

export async function getDocumentHashTimeline(
  packetId: string,
  supabase: SupabaseClient<Database>,
): Promise<DocumentHashEntry[]> {
  const { data } = await supabase
    .from("packet_audit_log")
    .select("metadata, created_at, actor_id")
    .eq("packet_id", packetId)
    .eq("action", "document_hash_recorded")
    .order("created_at", { ascending: true });

  if (!data) return [];

  return data.map((row) => {
    const meta = row.metadata as Record<string, string>;
    return {
      hash: meta.hash,
      stage: meta.stage as DocumentHashEntry["stage"],
      algorithm: (meta.algorithm ?? "SHA-256") as "SHA-256",
      timestamp: row.created_at ?? new Date().toISOString(),
      actorId: row.actor_id ?? undefined,
    };
  });
}
