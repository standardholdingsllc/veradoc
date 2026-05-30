"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import type { LeasePacket, Signer } from "@/lib/domain/types";
import { getSignerByToken } from "@/lib/services/signer-service";
import { useSignerByToken, useUsers } from "@/lib/services/hooks";

export interface SignerContext {
  token: string;
  basePath: string;
  packet: LeasePacket;
  signer: Signer;
  signerIndex: number;
  realtorName: string;
  propertyAddress: string;
}

export function useSignerContext(): SignerContext | undefined {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const refreshKey = useSignerByToken(token) ?? token;

  const users = useUsers();

  return useMemo(() => {
    void refreshKey;
    const result = getSignerByToken(token);
    if (!result) {
      return undefined;
    }

    const { packet, signer, signerIndex } = result;
    const realtor = users.find((user) => user.id === packet.createdByRealtorId);
    const unit = packet.property.unit ? `, ${packet.property.unit}` : "";

    return {
      token,
      basePath: `/demo/firma/${token}`,
      packet,
      signer,
      signerIndex,
      realtorName: realtor?.fullName ?? "Agente inmobiliario",
      propertyAddress: `${packet.property.address}${unit}, ${packet.property.district}`,
    };
  }, [refreshKey, token, users]);
}
