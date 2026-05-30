"use client";

import { useVeraDocStore } from "@/lib/store";
import type {
  PacketAdapter,
  RegistryAdapter,
  SignerAdapter,
  UserAdapter,
} from "./types";

export function getPacketAdapter(): PacketAdapter {
  return {
    getAll: () => useVeraDocStore.getState().packets,
    getById: (id) => useVeraDocStore.getState().getPacketById(id),
    getByStatus: (status) => useVeraDocStore.getState().getPacketsByStatus(status),
    create: (packet) => useVeraDocStore.getState().addPacket(packet),
    update: (id, updates) => useVeraDocStore.getState().updatePacket(id, updates),
  };
}

export function getUserAdapter(): UserAdapter {
  return {
    getAll: () => useVeraDocStore.getState().users,
    getByRole: (role) =>
      useVeraDocStore.getState().users.filter((user) => user.role === role),
    getById: (id) =>
      useVeraDocStore.getState().users.find((user) => user.id === id),
    getCurrentUser: () => useVeraDocStore.getState().getCurrentUser(),
  };
}

export function getRegistryAdapter(): RegistryAdapter {
  return {
    getAll: () => useVeraDocStore.getState().registry,
    getByPropertyKey: (key) =>
      useVeraDocStore.getState().getRegistryByPropertyKey(key),
    add: (entry) => useVeraDocStore.getState().addRegistryEntry(entry),
    update: (id, updates) =>
      useVeraDocStore.getState().updateRegistryEntry(id, updates),
  };
}

export function getSignerAdapter(): SignerAdapter {
  return {
    getByToken: (token) => useVeraDocStore.getState().getSignerByToken(token),
  };
}
