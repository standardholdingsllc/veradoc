"use client";

import { useParams } from "next/navigation";
import { PartyContractDetail } from "@/components/party/party-portal";

export default function ArrendatarioContratoDetallePage() {
  const params = useParams<{ packetId: string }>();
  return <PartyContractDetail role="renter" packetId={params.packetId} />;
}
