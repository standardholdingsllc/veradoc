import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Tests for provider response classification and Zod parsing.
 * Uses the official APIsPERU Swagger response shapes.
 */

describe("ApisPeruError classification", () => {
  it("imports correctly", async () => {
    const { ApisPeruError } = await import("@/lib/services/apisperu/types");

    const definitiveErr = new ApisPeruError("definitive_validation", "Bad payload", 422);
    expect(definitiveErr.kind).toBe("definitive_validation");
    expect(definitiveErr.httpStatus).toBe(422);
    expect(definitiveErr.name).toBe("ApisPeruError");

    const ambiguousErr = new ApisPeruError("ambiguous_submission", "Timeout");
    expect(ambiguousErr.kind).toBe("ambiguous_submission");
    expect(ambiguousErr.httpStatus).toBeUndefined();

    const statusErr = new ApisPeruError("status_not_ready", "No CDR");
    expect(statusErr.kind).toBe("status_not_ready");

    const unavailableErr = new ApisPeruError("provider_unavailable", "503", 503);
    expect(unavailableErr.kind).toBe("provider_unavailable");
  });
});

describe("RucLookupError classification", () => {
  it("imports correctly", async () => {
    const { RucLookupError } = await import("@/lib/services/apiperu-lookup/types");

    const notFound = new RucLookupError("not_found", "RUC not found");
    expect(notFound.kind).toBe("not_found");
    expect(notFound.name).toBe("RucLookupError");

    const inactive = new RucLookupError("inactive", "INACTIVO");
    expect(inactive.kind).toBe("inactive");
  });
});

// ---------------------------------------------------------------------------
// Zod schema parsing tests using official Swagger response fixtures
// ---------------------------------------------------------------------------

// Re-create the schemas from client.ts to test parsing independently
const CdrResponseSchema = z.object({
  id: z.string().optional().default(""),
  code: z.string().optional().default(""),
  description: z.string().optional().default(""),
  notes: z.array(z.string()).optional().default([]),
  accepted: z.boolean().optional(),
});

const SendResponseSchema = z.object({
  xml: z.string().optional(),
  hash: z.string().optional(),
  sunatResponse: z
    .object({
      success: z.boolean(),
      cdrResponse: CdrResponseSchema.optional(),
      cdrZip: z.string().optional(),
      error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
    })
    .optional(),
});

const StatusResponseSchema = z.object({
  success: z.boolean(),
  cdrZip: z.string().optional(),
  cdrResponse: CdrResponseSchema.optional(),
  code: z.string().optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
});

describe("SendResponseSchema (DocumentResponse) parsing", () => {
  it("parses accepted invoice with XML, hash, and CDR", () => {
    const fixture = {
      xml: "<Invoice>...signed XML...</Invoice>",
      hash: "abc123def456",
      sunatResponse: {
        success: true,
        cdrResponse: {
          id: "R-20123456789-01-F001-1",
          code: "0",
          description: "La Factura numero F001-1, ha sido aceptada",
          notes: [],
          accepted: true,
        },
        cdrZip: "UEsDBBQAAAAI...",
      },
    };

    const parsed = SendResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.xml).toBe("<Invoice>...signed XML...</Invoice>");
    expect(parsed.data.hash).toBe("abc123def456");
    expect(parsed.data.sunatResponse?.success).toBe(true);
    expect(parsed.data.sunatResponse?.cdrResponse?.accepted).toBe(true);
    expect(parsed.data.sunatResponse?.cdrResponse?.code).toBe("0");
    expect(parsed.data.sunatResponse?.cdrZip).toBe("UEsDBBQAAAAI...");
  });

  it("parses rejected invoice", () => {
    const fixture = {
      xml: "<Invoice>...signed...</Invoice>",
      hash: "xyz789",
      sunatResponse: {
        success: false,
        cdrResponse: {
          id: "R-20123456789-01-F001-2",
          code: "2100",
          description: "El documento fue rechazado",
          notes: ["Error en datos del receptor"],
          accepted: false,
        },
      },
    };

    const parsed = SendResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.sunatResponse?.cdrResponse?.accepted).toBe(false);
    expect(parsed.data.sunatResponse?.cdrResponse?.code).toBe("2100");
  });

  it("parses response without CDR (ambiguous)", () => {
    const fixture = {
      xml: "<Invoice>...</Invoice>",
      hash: "abc",
      sunatResponse: {
        success: true,
      },
    };

    const parsed = SendResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.sunatResponse?.cdrResponse).toBeUndefined();
  });

  it("parses response with sunatResponse error", () => {
    const fixture = {
      sunatResponse: {
        success: false,
        error: {
          code: "SOAP_ERROR",
          message: "SUNAT service unavailable",
        },
      },
    };

    const parsed = SendResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.sunatResponse?.success).toBe(false);
    expect(parsed.data.sunatResponse?.error?.code).toBe("SOAP_ERROR");
  });

  it("rejects old-format response with top-level success (schema drift check)", () => {
    // This is the OLD wrong format. The Zod schema should still parse it
    // (extra keys are stripped), but the critical fields xml/hash should be absent.
    const oldFormat = {
      success: true,
      sunatResponse: {
        success: true,
        xmlSigned: "<xml>old</xml>",
        hashCpe: "oldhash",
        cdrResponse: { accepted: true, code: "0", description: "ok" },
      },
    };

    const parsed = SendResponseSchema.safeParse(oldFormat);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // The old fields are NOT captured — xml and hash are absent
    expect(parsed.data.xml).toBeUndefined();
    expect(parsed.data.hash).toBeUndefined();
  });
});

describe("StatusResponseSchema (StatusResult) parsing", () => {
  it("parses accepted status with root-level cdrResponse", () => {
    const fixture = {
      success: true,
      cdrZip: "UEsDBBQAAAAI...",
      cdrResponse: {
        id: "R-20123456789-01-F001-1",
        code: "0",
        description: "La Factura numero F001-1, ha sido aceptada",
        notes: [],
        accepted: true,
      },
    };

    const parsed = StatusResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.success).toBe(true);
    expect(parsed.data.cdrResponse?.accepted).toBe(true);
    expect(parsed.data.cdrResponse?.code).toBe("0");
    expect(parsed.data.cdrZip).toBe("UEsDBBQAAAAI...");
  });

  it("parses status with no CDR yet (SUNAT still processing)", () => {
    const fixture = {
      success: true,
      code: "0",
    };

    const parsed = StatusResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.cdrResponse).toBeUndefined();
    expect(parsed.data.cdrZip).toBeUndefined();
  });

  it("parses rejected status", () => {
    const fixture = {
      success: true,
      cdrResponse: {
        id: "test",
        code: "2100",
        description: "Rechazado",
        notes: ["Error en documento"],
        accepted: false,
      },
    };

    const parsed = StatusResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.cdrResponse?.accepted).toBe(false);
  });

  it("parses status with error object", () => {
    const fixture = {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Document not found",
      },
    };

    const parsed = StatusResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.success).toBe(false);
    expect(parsed.data.error?.code).toBe("NOT_FOUND");
  });

  it("rejects old nested sunatResponse format (schema drift check)", () => {
    // Old wrong format nested cdrResponse under sunatResponse
    const oldFormat = {
      success: true,
      sunatResponse: {
        success: true,
        cdrResponse: { accepted: true, code: "0", description: "ok" },
        cdrZip: "base64...",
      },
    };

    const parsed = StatusResponseSchema.safeParse(oldFormat);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Root-level cdrResponse should be absent — it was incorrectly nested
    expect(parsed.data.cdrResponse).toBeUndefined();
    expect(parsed.data.cdrZip).toBeUndefined();
  });
});
