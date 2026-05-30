"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LeasePacket, RegistryEntry, User } from "@/lib/domain/types";
import { MOCK_PACKETS, MOCK_REGISTRY, MOCK_USERS } from "./initial-data";

interface VeraDocStore {
  users: User[];
  packets: LeasePacket[];
  registry: RegistryEntry[];
  currentRole: "notary" | "realtor" | "landlord" | "renter";

  getCurrentUser: () => User | undefined;
  getPacketById: (id: string) => LeasePacket | undefined;
  getPacketsByStatus: (status: string) => LeasePacket[];
  getSignerByToken: (
    token: string,
  ) => { packet: LeasePacket; signerIndex: number } | undefined;
  getRegistryByPropertyKey: (key: string) => RegistryEntry[];

  setCurrentRole: (role: "notary" | "realtor" | "landlord" | "renter") => void;
  updatePacket: (id: string, updates: Partial<LeasePacket>) => void;
  addPacket: (packet: LeasePacket) => void;
  addRegistryEntry: (entry: RegistryEntry) => void;
  updateRegistryEntry: (id: string, updates: Partial<RegistryEntry>) => void;
}

export const useVeraDocStore = create<VeraDocStore>()(
  persist(
    (set, get) => ({
      users: MOCK_USERS,
      packets: MOCK_PACKETS,
      registry: MOCK_REGISTRY,
      currentRole: "realtor",

      getCurrentUser: () => {
        const { users, currentRole } = get();
        return users.find((user) => user.role === currentRole);
      },

      getPacketById: (id) =>
        get().packets.find((packet) => packet.id === id),

      getPacketsByStatus: (status) =>
        get().packets.filter((packet) => packet.status === status),

      getSignerByToken: (token) => {
        for (const packet of get().packets) {
          const signerIndex = packet.signers.findIndex(
            (signer) => signer.secureLinkToken === token,
          );
          if (signerIndex !== -1) {
            return { packet, signerIndex };
          }
        }
        return undefined;
      },

      getRegistryByPropertyKey: (key) =>
        get().registry.filter((entry) => entry.propertyKey === key),

      setCurrentRole: (role) => set({ currentRole: role }),

      updatePacket: (id, updates) =>
        set((state) => ({
          packets: state.packets.map((packet) =>
            packet.id === id
              ? { ...packet, ...updates, updatedAt: new Date().toISOString() }
              : packet,
          ),
        })),

      addPacket: (packet) =>
        set((state) => ({
          packets: [...state.packets, packet],
        })),

      addRegistryEntry: (entry) =>
        set((state) => ({
          registry: [...state.registry, entry],
        })),

      updateRegistryEntry: (id, updates) =>
        set((state) => ({
          registry: state.registry.map((entry) =>
            entry.id === id ? { ...entry, ...updates } : entry,
          ),
        })),
    }),
    {
      name: "veradoc-demo-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        users: state.users,
        packets: state.packets,
        registry: state.registry,
        currentRole: state.currentRole,
      }),
    },
  ),
);
