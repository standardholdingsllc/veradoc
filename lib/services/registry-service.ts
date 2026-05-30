import type { LeasePacket, RegistryEntry } from "@/lib/domain/types";
import {
  getPacketAdapter,
  getRegistryAdapter,
} from "@/lib/adapters/mock-adapter";

export function getRegistryEntries(): RegistryEntry[] {
  return getRegistryAdapter().getAll();
}

export function checkDuplicate(normalizedKey: string): RegistryEntry[] {
  return getRegistryAdapter()
    .getByPropertyKey(normalizedKey)
    .filter((entry) => entry.active);
}

export function createEntry(packetId: string): RegistryEntry {
  const packet = getPacketAdapter().getById(packetId);
  if (!packet) {
    throw new Error(`Packet not found: ${packetId}`);
  }

  if (
    packet.status !== "certified" &&
    packet.status !== "certified_with_observations"
  ) {
    throw new Error(
      `Cannot create registry entry for packet in status: ${packet.status}`,
    );
  }

  const entry: RegistryEntry = {
    id: `reg-${packet.packetCode.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    propertyKey: packet.property.normalizedAddressKey,
    packetId: packet.id,
    propertyAddress: formatPropertyAddress(packet),
    landlordNames: packet.signers
      .filter((signer) => signer.roleInLease === "landlord")
      .map((signer) => signer.fullName),
    renterNames: packet.signers
      .filter((signer) => signer.roleInLease === "renter")
      .map((signer) => signer.fullName),
    leaseStartDate: packet.leaseTerms.startDate,
    leaseExpirationDate: packet.leaseTerms.expirationDate,
    certificationStatus:
      packet.status === "certified_with_observations"
        ? "certified_with_observations"
        : "certified",
    active: true,
    createdAt: new Date().toISOString(),
  };

  getRegistryAdapter().add(entry);
  return entry;
}

export function isLeaseTermExpired(entry: RegistryEntry): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(entry.leaseExpirationDate);
  expiration.setHours(0, 0, 0, 0);
  return expiration < today;
}

function formatPropertyAddress(packet: LeasePacket): string {
  const { address, district, department } = packet.property;
  return `${address}, ${district}, ${department}`;
}
