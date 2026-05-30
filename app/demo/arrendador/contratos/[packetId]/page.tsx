"use client";

import { useParams } from "next/navigation";
import { PartyContractDetail } from "@/components/party/party-portal";

export default function ArrendadorContratoDetallePage() {
  const params = useParams<{ packetId: string }>();
  return <PartyContractDetail role="landlord" packetId={params.packetId} />;
}
