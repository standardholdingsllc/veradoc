"use client";

import { useVeraDocStore } from "@/lib/store";
import type {
  LeasePacket,
  PacketStatus,
  RegistryEntry,
  User,
} from "@/lib/domain/types";

export function usePackets(): LeasePacket[] {
  return useVeraDocStore((state) => state.packets);
}

export function usePacketById(id: string): LeasePacket | undefined {
  return useVeraDocStore((state) => state.packets.find((p) => p.id === id));
}

export function usePacketsByStatus(status: PacketStatus): LeasePacket[] {
  return useVeraDocStore((state) =>
    state.packets.filter((p) => p.status === status),
  );
}

export function useRegistryEntries(): RegistryEntry[] {
  return useVeraDocStore((state) => state.registry);
}

export function useUsers(): User[] {
  return useVeraDocStore((state) => state.users);
}

export function useUserById(id: string): User | undefined {
  return useVeraDocStore((state) => state.users.find((u) => u.id === id));
}

export function useCurrentRole() {
  return useVeraDocStore((state) => state.currentRole);
}

export function useCurrentUser(): User | undefined {
  return useVeraDocStore((state) =>
    state.users.find((u) => u.role === state.currentRole),
  );
}

export function useSetCurrentRole() {
  return useVeraDocStore((state) => state.setCurrentRole);
}

export function useSignerByToken(token: string) {
  return useVeraDocStore((state) => {
    for (const packet of state.packets) {
      const signerIndex = packet.signers.findIndex(
        (signer) => signer.secureLinkToken === token,
      );
      if (signerIndex !== -1) {
        return { packet, signerIndex };
      }
    }
    return undefined;
  });
}
