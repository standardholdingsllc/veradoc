import { getPartyContracts } from "@/lib/actions/party-actions";
import {
  dbStatusToDisplay,
  dbSignerStatusToDisplay,
} from "@/lib/domain/status-mapping";
import { isLeaseExpired } from "@/lib/formatters";
import {
  PartyContractListClient,
  type PartyContract,
} from "@/components/party/party-contract-list-client";

export default async function ArrendadorContratosPage() {
  const { data: rows } = await getPartyContracts("landlord");

  const contracts: PartyContract[] = rows.map((row) => {
    const lp = row.lease_packets as Record<string, unknown>;
    return {
      signerId: row.id,
      signerName: row.signer_full_name,
      signerStatus: row.status,
      signerDisplayStatus: dbSignerStatusToDisplay(row.status),
      packetId: lp.id as string,
      packetCode: lp.packet_code as string | null,
      packetStatus: lp.status as string,
      displayStatus: dbStatusToDisplay(lp.status as string, {
        isExpired:
          typeof lp.lease_end_date === "string" &&
          isLeaseExpired(lp.lease_end_date),
      }),
      propertyAddress: lp.property_address as string | null,
      propertyUnit: lp.property_unit as string | null,
      district: lp.district as string | null,
      leaseStartDate: lp.lease_start_date as string | null,
      leaseEndDate: lp.lease_end_date as string | null,
      certifiedAt: lp.certified_at as string | null,
      updatedAt: lp.updated_at as string | null,
    };
  });

  const pending = contracts.filter(
    (c) =>
      c.signerDisplayStatus !== "complete" &&
      c.signerDisplayStatus !== "signed",
  ).length;

  const certified = contracts.filter(
    (c) =>
      c.displayStatus === "certified" ||
      c.displayStatus === "certified_with_observations" ||
      c.displayStatus === "expired",
  ).length;

  const renewalEligible = contracts.filter(
    (c) =>
      c.displayStatus === "expired",
  ).length;

  return (
    <PartyContractListClient
      role="landlord"
      contracts={contracts}
      metrics={{
        total: contracts.length,
        pending,
        certified,
        renewalEligible,
      }}
      showFullList
    />
  );
}
