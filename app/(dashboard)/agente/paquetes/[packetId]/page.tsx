import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    p_property_unit: packet.property_unit ?? "",
    p_lease_start: packet.lease_start_date ?? "",
    p_lease_end: packet.lease_end_date ?? "",
  });

  // Fetch CPE data using admin client (invoices table requires service_role for now)
  const admin = createAdminClient();
  // Fetch primary CPE (factura/boleta) and all credit notes for this packet
  const [{ data: primaryCpe }, { data: creditNotes }] = await Promise.all([
    admin
      .from("invoices")
      .select("id, tipo_doc, serie, correlativo, status, next_operation, operation_status, pdf_storage_path")
      .eq("packet_id", packetId)
      .in("tipo_doc", ["01", "03"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("invoices")
      .select("id, tipo_doc, serie, correlativo, status, next_operation, operation_status, pdf_storage_path")
      .eq("packet_id", packetId)
      .eq("tipo_doc", "07")
      .order("created_at", { ascending: false }),
  ]);

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
        cpeData={primaryCpe ? {
          id: primaryCpe.id,
          tipo_doc: primaryCpe.tipo_doc,
          serie: primaryCpe.serie,
          correlativo: primaryCpe.correlativo,
          status: primaryCpe.status,
          operation_status: primaryCpe.operation_status,
        } : null}
        creditNotes={(creditNotes ?? []).map(cn => ({
          id: cn.id,
          tipo_doc: cn.tipo_doc,
          serie: cn.serie,
          correlativo: cn.correlativo,
          status: cn.status,
          operation_status: cn.operation_status,
        }))}
      />
    </div>
  );
}
