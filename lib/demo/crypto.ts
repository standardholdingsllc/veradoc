import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { demoConfig } from "./config";

function encryptionKey(): Buffer {
  const configured = demoConfig.tokenEncryptionKey;
  if (configured) {
    const decoded = Buffer.from(configured, "base64url");
    if (decoded.length === 32) return decoded;
    return createHash("sha256").update(configured).digest();
  }
  if (process.env.NODE_ENV !== "production") {
    return createHash("sha256").update("veradoc-demo-development-only-key").digest();
  }
  throw new Error("DEMO_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
}
export function hashDemoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createDemoToken(prefix: "presenter" | "notary" | "signer"): string {
  return `demo_${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function encryptDemoToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptDemoToken(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("INVALID_DEMO_TOKEN_CIPHERTEXT");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
