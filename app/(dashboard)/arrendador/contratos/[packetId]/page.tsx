import { notFound } from "next/navigation";
import {
  getPartyContractDetail,
  getPartyDocumentDownloadUrl,
  startRenewalAction,
} from "@/lib/actions/party-actions";
import {
  dbStatusToDisplay,
  dbSignerStatusToDisplay,
} from "@/lib/domain/status-mapping";
import { isLeaseExpired } from "@/lib/formatters";
import { PartyContractDetailClient } from "@/components/party/party-contract-detail-client";

export default async function ArrendadorContratoDetallePage(
  props: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await props.params;
  const result = await getPartyContractDetail(packetId, "landlord");

  if (result.error || !result.data) {
    notFound();
  }

  const { packet, signerRecord, documents, auditLog, evidence, certType } =
    result.data;

  const displayStatus = dbStatusToDisplay(packet.status, {
    certType: certType ?? undefined,
    isExpired:
      typeof packet.lease_end_date === "string" &&
      isLeaseExpired(packet.lease_end_date),
  });
  const signerDisplayStatus = dbSignerStatusToDisplay(signerRecord.status);

  return (
    <PartyContractDetailClient
      role="landlord"
      packet={packet}
      displayStatus={displayStatus}
      signerRecord={signerRecord}
      signerDisplayStatus={signerDisplayStatus}
      documents={documents}
      auditLog={auditLog}
      evidence={evidence}
      onDownload={getPartyDocumentDownloadUrl}
      onStartRenewal={startRenewalAction}
    />
  );
}
