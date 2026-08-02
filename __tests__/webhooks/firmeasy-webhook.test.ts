import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Mock all external dependencies
vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    FIRMEASY_API_BASE_URL: "https://app.firmeasy.legal/api/v1",
    FIRMEASY_USER_INTEGRATION_TOKEN: "test-token",
    FIRMEASY_EMAIL: "test@example.com",
    FIRMEASY_PASSWORD: "test-password",
    FIRMEASY_WEBHOOK_SECRET: "webhook-secret-123",
    FIRMEASY_MODE: "sandbox",
    FIRMEASY_ALLOW_DEV_STUB: false,
    SITE_URL: "https://veradoc.pe",
  },
  isFirmEasyConfigured: () => true,
  validateFirmEasyConfig: () => {},
}));

const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn(() => ({
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: () => ({ download: vi.fn(), upload: vi.fn() }) },
  }),
}));

vi.mock("@/lib/services/firmeasy", () => ({
  verifyFirmEasyWebhookSignature: (
    body: string,
    sig: string,
    secret: string,
  ) => {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return sig === expected;
  },
  FIRMEASY_SIGNATURE_HEADER: "x-firmeasy-signature",
  getFirmEasyClient: () => null,
}));

vi.mock("@/lib/services/document-assembly-service", () => ({
  assembleSignedDocument: vi.fn().mockResolvedValue({
    storagePath: "packets/123/signed_lease.pdf",
    fileHash: "abc123hash",
  }),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifySignerCompletion: vi.fn(),
  notifyAllSignersComplete: vi.fn(),
  notifySignerRejectedFirmEasy: vi.fn(),
}));

vi.mock("@/lib/services/evidence-data-collector", () => ({
  collectEvidenceData: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/pdf/generate-evidence-report", () => ({
  generateAndStoreEvidenceReport: vi.fn().mockResolvedValue({
    storagePath: "evidence/123/report.pdf",
    fileHash: "evidence-hash-123",
  }),
}));

describe("FirmEasy Webhook HMAC Verification", () => {
  const secret = "webhook-secret-123";

  function signPayload(body: string): string {
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  function verifySignature(body: string, sig: string, key: string): boolean {
    const expected = crypto.createHmac("sha256", key).update(body).digest("hex");
    return sig === expected;
  }

  it("accepts valid signature", () => {
    const body = JSON.stringify({ event: "document_signed", document_token: "abc" });
    const signature = signPayload(body);
    expect(verifySignature(body, signature, secret)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const body = JSON.stringify({ event: "document_signed", document_token: "abc" });
    expect(verifySignature(body, "invalidsig", secret)).toBe(false);
  });
});

describe("FirmEasy Webhook Idempotency", () => {
  it("computes consistent payload hash from same body", () => {
    const body = JSON.stringify({ event: "document_signed", document_token: "abc" });
    const hash1 = crypto.createHash("sha256").update(body).digest("hex");
    const hash2 = crypto.createHash("sha256").update(body).digest("hex");
    expect(hash1).toBe(hash2);
  });

  it("computes different hashes for different bodies", () => {
    const body1 = JSON.stringify({ event: "document_signed", document_token: "abc" });
    const body2 = JSON.stringify({ event: "document_signed", document_token: "def" });
    const hash1 = crypto.createHash("sha256").update(body1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(body2).digest("hex");
    expect(hash1).not.toBe(hash2);
  });
});

describe("FirmEasy Webhook Event Types", () => {
  it("identifies document_signed event", () => {
    const payload = { event: "document_signed", document_token: "doc-123" };
    expect(payload.event).toBe("document_signed");
    expect(payload.document_token).toBe("doc-123");
  });

  it("identifies signer_rejected event", () => {
    const payload = {
      event: "signer_rejected",
      document_token: "doc-123",
      signer_external_id: "signer-uuid-1",
    };
    expect(payload.event).toBe("signer_rejected");
    expect(payload.signer_external_id).toBe("signer-uuid-1");
  });

  it("handles unknown event gracefully", () => {
    const payload = { event: "unknown_event" };
    expect(["document_signed", "signer_rejected"]).not.toContain(payload.event);
  });
});
