import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyFirmEasyWebhookSignature } from "@/lib/services/firmeasy/hmac";

describe("verifyFirmEasyWebhookSignature", () => {
  const secret = "test-webhook-secret-key-12345";
  const rawBody = JSON.stringify({
    event: "document_signed",
    document_token: "abc123",
  });

  function computeValidSignature(body: string, key: string): string {
    return crypto.createHmac("sha256", key).update(body).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const signature = computeValidSignature(rawBody, secret);
    expect(verifyFirmEasyWebhookSignature(rawBody, signature, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const badSignature = "deadbeef".repeat(8);
    expect(verifyFirmEasyWebhookSignature(rawBody, badSignature, secret)).toBe(false);
  });

  it("returns false when signature header is empty", () => {
    expect(verifyFirmEasyWebhookSignature(rawBody, "", secret)).toBe(false);
  });

  it("returns false when secret is empty", () => {
    const signature = computeValidSignature(rawBody, secret);
    expect(verifyFirmEasyWebhookSignature(rawBody, signature, "")).toBe(false);
  });

  it("returns false when body is tampered with", () => {
    const signature = computeValidSignature(rawBody, secret);
    const tamperedBody = rawBody + " ";
    expect(verifyFirmEasyWebhookSignature(tamperedBody, signature, secret)).toBe(false);
  });

  it("works with Buffer input", () => {
    const bodyBuffer = Buffer.from(rawBody, "utf-8");
    const signature = computeValidSignature(rawBody, secret);
    expect(verifyFirmEasyWebhookSignature(bodyBuffer, signature, secret)).toBe(true);
  });

  it("returns false for truncated signatures", () => {
    const validSig = computeValidSignature(rawBody, secret);
    const truncated = validSig.slice(0, 32);
    expect(verifyFirmEasyWebhookSignature(rawBody, truncated, secret)).toBe(false);
  });
});
