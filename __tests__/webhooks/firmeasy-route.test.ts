import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const WEBHOOK_SECRET = "test-webhook-secret-456";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    FIRMEASY_API_BASE_URL: "https://app.firmeasy.legal/api/v1",
    FIRMEASY_USER_INTEGRATION_TOKEN: "test-token",
    FIRMEASY_EMAIL: "test@example.com",
    FIRMEASY_PASSWORD: "test-password",
    FIRMEASY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    FIRMEASY_MODE: "sandbox",
    FIRMEASY_ALLOW_DEV_STUB: false,
    SITE_URL: "https://veradoc.pe",
  },
  isFirmEasyConfigured: () => true,
  validateFirmEasyConfig: () => {},
}));

const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  single: mockSingle,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: () => ({ download: vi.fn(), upload: vi.fn() }) },
  }),
}));

const mockGetDocument = vi.fn();
const mockGetSignedPdf = vi.fn();

vi.mock("@/lib/services/firmeasy", () => ({
  verifyFirmEasyWebhookSignature: (body: string, sig: string, secret: string) => {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return sig === expected;
  },
  FIRMEASY_SIGNATURE_HEADER: "x-firmeasy-signature",
  getFirmEasyClient: () => ({
    getDocument: mockGetDocument,
    getSignedPdf: mockGetSignedPdf,
  }),
}));

vi.mock("@/lib/services/firmeasy/db-helpers", () => ({
  insertWebhookLog: vi.fn().mockResolvedValue({ id: "log-uuid-1" }),
  findWebhookLogByHash: vi.fn().mockResolvedValue(null),
  claimWebhookForRetry: vi.fn().mockResolvedValue(null),
  markWebhookProcessed: vi.fn().mockResolvedValue(undefined),
  markWebhookFailed: vi.fn().mockResolvedValue(undefined),
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

function signPayload(body: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function makeRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature !== undefined) {
    headers["x-firmeasy-signature"] = signature;
  }
  return new Request("http://localhost:3000/api/webhooks/firmeasy", {
    method: "POST",
    headers,
    body,
  });
}

describe("FirmEasy Webhook Route Handler (POST)", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const route = await import("@/app/api/webhooks/firmeasy/route");
    POST = route.POST;
  });

  it("rejects requests with invalid HMAC signature", async () => {
    const body = JSON.stringify({ event: "document_signed", document_token: "abc" });
    const response = await POST(makeRequest(body, "invalid-sig"));

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("accepts requests with valid HMAC signature", async () => {
    const body = JSON.stringify({ event: "unknown_event", document_token: "abc" });
    const sig = signPayload(body);
    const response = await POST(makeRequest(body, sig));

    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid JSON", async () => {
    const body = "not-json-{{{";
    const sig = signPayload(body);
    const response = await POST(makeRequest(body, sig));

    expect(response.status).toBe(400);
  });

  it("uses logId from retry claim when initial insert returns null", async () => {
    const { insertWebhookLog, findWebhookLogByHash, claimWebhookForRetry, markWebhookProcessed } =
      await import("@/lib/services/firmeasy/db-helpers");

    // Simulate: insert returns null (conflict), existing row is failed
    vi.mocked(insertWebhookLog).mockResolvedValueOnce(null);
    vi.mocked(findWebhookLogByHash).mockResolvedValueOnce({
      id: "claimed-log-id",
      processing_state: "failed",
      processing_started_at: null,
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      retry_count: 1,
    });
    vi.mocked(claimWebhookForRetry).mockResolvedValueOnce({ id: "claimed-log-id" });

    const body = JSON.stringify({ event: "unknown_event", document_token: "test" });
    const sig = signPayload(body);
    const response = await POST(makeRequest(body, sig));

    expect(response.status).toBe(200);
    // The important assertion: markWebhookProcessed was called with the claimed log ID
    expect(markWebhookProcessed).toHaveBeenCalledWith(expect.anything(), "claimed-log-id");
  });

  it("returns 500 when event handler throws (allowing FirmEasy retry)", async () => {
    const { insertWebhookLog, markWebhookFailed } =
      await import("@/lib/services/firmeasy/db-helpers");

    vi.mocked(insertWebhookLog).mockResolvedValueOnce({ id: "fail-log-id" });

    // Mock the admin query chain to throw during handleDocumentSigned
    mockFrom.mockImplementationOnce(() => ({
      insert: mockInsert,
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
      }),
      in: mockIn,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const body = JSON.stringify({ event: "document_signed", document_token: "doc-abc" });
    const sig = signPayload(body);
    const response = await POST(makeRequest(body, sig));

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.status).toBe("error");
    expect(markWebhookFailed).toHaveBeenCalled();
  });

  it("marks already-processed payloads without reprocessing", async () => {
    const { insertWebhookLog, findWebhookLogByHash } =
      await import("@/lib/services/firmeasy/db-helpers");

    vi.mocked(insertWebhookLog).mockResolvedValueOnce(null);
    vi.mocked(findWebhookLogByHash).mockResolvedValueOnce({
      id: "existing-id",
      processing_state: "processed",
      processing_started_at: null,
      created_at: new Date().toISOString(),
      retry_count: 0,
    });

    const body = JSON.stringify({ event: "document_signed", document_token: "dup" });
    const sig = signPayload(body);
    const response = await POST(makeRequest(body, sig));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("already_processed");
  });
});
