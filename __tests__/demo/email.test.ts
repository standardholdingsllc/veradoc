import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn(async (payload: { to: string; subject: string }) => {
  void payload;
  return { data: { id: crypto.randomUUID() }, error: null };
});

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
vi.mock("@/lib/demo/config", () => ({
  demoConfig: {
    emailApiKey: "demo-test-key",
    emailFrom: "demo@example.com",
  },
  hasPersistentDemoBackend: () => false,
  assertPersistentDemoBackendConfigured: () => undefined,
  buildDemoAbsoluteUrl: (path: string) => `https://demo.veradoc.pe${path}`,
}));

import { sendDemoSigningEmails } from "@/lib/demo/email";
import { createDemoWorkspace, deleteDemoWorkspace } from "@/lib/demo/repository";

describe("sandbox demo email", () => {
  beforeEach(() => {
    send.mockClear();
  });

  it("sends only allowlisted workspace recipients and deduplicates retries", async () => {
    const created = await createDemoWorkspace();
    const packet = created.payload.snapshot.packets[0];
    const key = crypto.randomUUID();
    const first = await sendDemoSigningEmails({
      presenterToken: created.presenterToken,
      packetId: packet.id,
      idempotencyKey: key,
    });
    expect(first.sent).toHaveLength(packet.signers.length);
    expect(send).toHaveBeenCalledTimes(packet.signers.length);
    for (const call of send.mock.calls) {
      expect(["jonahllarson@gmail.com", "kimberlydayanara08@gmail.com"]).toContain(
        String(call[0].to).toLowerCase(),
      );
      expect(call[0].subject).toContain("[DEMO]");
    }

    const repeated = await sendDemoSigningEmails({
      presenterToken: created.presenterToken,
      packetId: packet.id,
      idempotencyKey: key,
    });
    expect(repeated.duplicate).toHaveLength(packet.signers.length);
    expect(send).toHaveBeenCalledTimes(packet.signers.length);
    await deleteDemoWorkspace(created.presenterToken);
  });

  it("rate-limits the sixth send per recipient in a rolling 15-minute window", async () => {
    const created = await createDemoWorkspace();
    const packet = created.payload.snapshot.packets[0];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await sendDemoSigningEmails({
        presenterToken: created.presenterToken,
        packetId: packet.id,
        idempotencyKey: crypto.randomUUID(),
      });
      expect(result.sent).toHaveLength(packet.signers.length);
    }

    await expect(sendDemoSigningEmails({
      presenterToken: created.presenterToken,
      packetId: packet.id,
      idempotencyKey: crypto.randomUUID(),
    })).rejects.toThrow("DEMO_EMAIL_RATE_LIMITED");
    expect(send).toHaveBeenCalledTimes(packet.signers.length * 5);
    await deleteDemoWorkspace(created.presenterToken);
  });
});
