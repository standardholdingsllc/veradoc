import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

import { validateNotarialScan } from "@/lib/services/notary-scan-validation";
import { PDFDocument } from "pdf-lib";

async function createValidPdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  return Buffer.from(await doc.save());
}

describe("validateNotarialScan", () => {
  it("accepts a valid unencrypted PDF with correct structure", async () => {
    const buffer = await createValidPdf(3);
    const result = await validateNotarialScan(
      buffer,
      "source-doc-id",
      "abcdef1234567890",
      2,
      1,
    );
    expect(result.valid).toBe(true);
    expect(result.pdf_header_ok).toBe(true);
    expect(result.pdf_structure_ok).toBe(true);
    expect(result.not_encrypted).toBe(true);
    expect(result.page_count).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(result.file_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.source_document_id).toBe("source-doc-id");
    expect(result.source_document_hash).toBe("abcdef1234567890");
    expect(result.declared_added_pages).toBe(1);
    expect(result.validator_version).toMatch(/^veradoc-/);
    expect(result.validated_at).toBeTruthy();
  });

  it("rejects a non-PDF file", async () => {
    const buffer = Buffer.from("This is not a PDF file");
    const result = await validateNotarialScan(
      buffer,
      "source-doc-id",
      "hash",
      null,
      0,
    );
    expect(result.valid).toBe(false);
    expect(result.pdf_header_ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("encabezado PDF"))).toBe(true);
  });

  it("rejects a truncated PDF (missing %%EOF)", async () => {
    const validPdf = await createValidPdf(1);
    const truncated = validPdf.subarray(0, 100);
    const result = await validateNotarialScan(
      truncated,
      "source-doc-id",
      "hash",
      null,
      0,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("%%EOF") || e.includes("dañado"))).toBe(true);
  });

  it("rejects a file exceeding the 50 MB limit", async () => {
    const bigBuffer = Buffer.alloc(51 * 1024 * 1024, 0);
    bigBuffer.write("%PDF-1.4\n");
    bigBuffer.write("%%EOF", bigBuffer.length - 5);
    const result = await validateNotarialScan(
      bigBuffer,
      "source-doc-id",
      "hash",
      null,
      0,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("50 MB"))).toBe(true);
  });

  it("warns when page count does not match expected", async () => {
    const buffer = await createValidPdf(5);
    const result = await validateNotarialScan(
      buffer,
      "source-doc-id",
      "hash",
      3,
      1,
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("5 páginas");
    expect(result.warnings[0]).toContain("4");
  });

  it("records correct hash from exact uploaded bytes", async () => {
    const buffer = await createValidPdf(1);
    const result = await validateNotarialScan(
      buffer,
      "source-doc-id",
      "hash",
      null,
      0,
    );
    expect(result.file_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.file_size_bytes).toBe(buffer.length);
  });
});
