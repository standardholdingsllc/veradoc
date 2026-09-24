import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createDemoInvoiceDocument } from "@/lib/demo/invoice-document";
import { MOCK_PACKETS } from "@/lib/store/initial-data";

describe("demo invoice sample", () => {
  it("generates a clearly labeled sample PDF without using invoice services", async () => {
    const packet = MOCK_PACKETS.find((entry) => entry.id === "pkt-2024-002");
    expect(packet).toBeDefined();
    const bytes = await createDemoInvoiceDocument(packet!);
    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("Muestra de comprobante demo");
    expect(pdf.getSubject()).toContain("sin validez tributaria");
  });
});
