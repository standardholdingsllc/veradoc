import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock env module
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    FIRMEASY_API_BASE_URL: "https://app.firmeasy.legal/api/v1",
    FIRMEASY_USER_INTEGRATION_TOKEN: "test-token",
    FIRMEASY_EMAIL: "test@example.com",
    FIRMEASY_PASSWORD: "test-password",
  },
  isFirmEasyConfigured: () => true,
}));

import { FirmEasyClient, FirmEasyApiError } from "@/lib/services/firmeasy/client";

describe("FirmEasyClient", () => {
  let client: FirmEasyClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new FirmEasyClient({
      baseUrl: "https://app.firmeasy.legal/api/v1",
      integrationToken: "test-integration-token",
      email: "test@firmeasy.com",
      password: "test-password",
    });

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authenticate", () => {
    it("authenticates and caches the token", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access: "jwt-token-123",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      await client.authenticate();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://app.firmeasy.legal/api/v1/auth/test-integration-token/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@firmeasy.com",
            password: "test-password",
          }),
        }),
      );

      // Second call should use cached token (no new fetch)
      await client.authenticate();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws FirmEasyApiError on auth failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid credentials" }),
      });

      await expect(client.authenticate()).rejects.toThrow(FirmEasyApiError);
    });
  });

  describe("createDocument", () => {
    it("sends correct request and returns document response", async () => {
      // Auth call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access: "jwt-token-123",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      // Create document call
      const mockResponse = {
        token: "doc-token-abc",
        status: "pending",
        name: "Contrato PKT-2026-0001.pdf",
        signers: [
          {
            token: "signer-token-1",
            link: "https://app.firmeasy.legal/sign/signer-token-1",
            status: "pending",
            external_id: "signer-uuid-1",
            name: "Juan Pérez",
            email: "juan@example.com",
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createDocument({
        name: "Contrato PKT-2026-0001.pdf",
        document_pdf_base64: "JVBER...",
        external_id: "packet-uuid-1",
        send_automatic_invitations: false,
        disable_signer_notifications: true,
        disable_owner_notifications: true,
        signers: [
          {
            name: "Juan Pérez",
            email: "juan@example.com",
            country_code: "+51",
            phone: "926481357",
            external_id: "signer-uuid-1",
            standard_flow: ["holographic_signature", "otp_whatsapp"],
          },
        ],
      });

      expect(result.token).toBe("doc-token-abc");
      expect(result.signers).toHaveLength(1);
      expect(result.signers[0].link).toContain("signer-token-1");
    });
  });

  describe("getDocument", () => {
    it("fetches document with includes", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access: "jwt-token-123",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "doc-123",
          status: "signed",
          signed_file: "https://firmeasy.legal/files/signed.pdf",
          signers: [],
          tracking: [],
        }),
      });

      const result = await client.getDocument("doc-123", ["signers", "tracking"]);

      expect(result.token).toBe("doc-123");
      expect(result.status).toBe("signed");

      const fetchCall = fetchMock.mock.calls[1];
      const url = fetchCall[0] as string;
      expect(url).toContain("include");
      expect(url).toContain("signers");
      expect(url).toContain("tracking");
    });
  });

  describe("error handling", () => {
    it("throws FirmEasyApiError with status code", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access: "jwt-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Validation failed",
          errors: { name: ["required"] },
        }),
      });

      try {
        await client.createDocument({
          name: "",
          signers: [],
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FirmEasyApiError);
        expect((err as FirmEasyApiError).statusCode).toBe(422);
      }
    });
  });
});
