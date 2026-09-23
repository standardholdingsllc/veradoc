import { z } from "zod";
import { DEMO_MAX_PACKETS, DEMO_MAX_REQUEST_BYTES, isAllowedDemoEmail } from "./constants";
import type { DemoSnapshot } from "./types";

const snapshotShape = z.object({
  users: z.array(z.object({ id: z.string(), role: z.string() }).passthrough()).max(20),
  packets: z.array(z.object({
    id: z.string(),
    packetCode: z.string(),
    signers: z.array(z.object({
      id: z.string(),
      email: z.string().email(),
      dni: z.string(),
      whatsapp: z.string(),
      secureLinkToken: z.string(),
    }).passthrough()).max(8),
  }).passthrough()).max(DEMO_MAX_PACKETS),
  registry: z.array(z.object({ id: z.string(), packetId: z.string() }).passthrough()).max(50),
  currentRole: z.enum(["notary", "realtor", "landlord", "renter"]),
});

export function parseDemoSnapshot(input: unknown): DemoSnapshot {
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, "utf8") > DEMO_MAX_REQUEST_BYTES) {
    throw new Error("DEMO_SNAPSHOT_TOO_LARGE");
  }
  const parsed = snapshotShape.parse(input) as unknown as DemoSnapshot;
  for (const packet of parsed.packets) {
    for (const signer of packet.signers) {
      if (!isAllowedDemoEmail(signer.email)) throw new Error("DEMO_EMAIL_NOT_ALLOWED");
      if (!/^00\d{6}$/.test(signer.dni)) throw new Error("DEMO_DNI_MUST_BE_SYNTHETIC");
      if (!/^\+5100000000\d$/.test(signer.whatsapp)) throw new Error("DEMO_PHONE_MUST_BE_SYNTHETIC");
    }
  }
  return parsed;
}
