import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { dbStatusToDisplay, dbSignerStatusToDisplay } from "@/lib/domain/status-mapping";
import { getDocumentHashTimeline } from "@/lib/utils/document-hash";
import { PacketDetailClient } from "@/components/agente/packet-detail-client";
import { ACTIONS } from "@/lib/i18n/labels";

export default async function PaqueteDetallePage(
  props: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await props.params;
  const supabase = await createClient();

  // Fetch packet (RLS ensures ownership)
  const { data: packet } = await supabase
    .from("lease_packets")
    .select("*")
    .eq("id", packetId)
    .single();

  if (!packet) {
    notFound();
  }

  // Fetch related data in parallel
  const [
    { data: signers },
    { data: documents },
    { data: payments },
    { data: auditLog },
    { data: certifications },
  ] = await Promise.all([
    supabase
      .from("packet_signers")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at"),
    supabase
      .from("packet_documents")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at"),
    supabase
      .from("payments")
      .select("*")
      .eq("packet_id", packetId)
      .order("created_at", { ascending: false })
      .limit(1),
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

  // Duplicate lease check
  const { data: dupResult } = await supabase.rpc("check_duplicate_lease", {
    p_property_address: packet.property_address ?? "",
    p_property_unit: packet.property_unit ?? null,
    p_lease_start: packet.lease_start_date ?? "",
    p_lease_end: packet.lease_end_date ?? "",
  });

  const hashTimeline = await getDocumentHashTimeline(packetId, supabase);

  const certType = certifications?.[0]?.certification_type;
  const displayStatus = dbStatusToDisplay(packet.status, {
    certType: certType ?? undefined,
  });

  const mappedSigners = (signers ?? []).map((s) => ({
    ...s,
    displayStatus: dbSignerStatusToDisplay(s.status),
  }));

  const payment = payments?.[0] ?? null;
  const duplicateCheck = dupResult?.[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 md:px-8">
      <Link
        href="/agente"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {ACTIONS.volverAlPanel}
      </Link>

      <PacketDetailClient
        packet={packet}
        displayStatus={displayStatus}
        signers={mappedSigners}
        documents={documents ?? []}
        payment={payment}
        auditLog={auditLog ?? []}
        duplicateCheck={duplicateCheck}
        hashTimeline={hashTimeline}
      />
    </div>
  );
}
