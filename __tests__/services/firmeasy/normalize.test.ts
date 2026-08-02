import { describe, it, expect } from "vitest";
import { parseWhatsappForFirmEasy } from "@/lib/services/firmeasy/normalize";

describe("parseWhatsappForFirmEasy", () => {
  it("parses a standard Peru number", () => {
    const result = parseWhatsappForFirmEasy("+51926481357");
    expect(result.country_code).toBe("+51");
    expect(result.phone).toBe("926481357");
  });

  it("parses a number with 2-digit country code", () => {
    // The regex matches greedily up to 3 digits for country code.
    // For "+51XXXXXXXXX" (Peru), this works correctly.
    // For ambiguous codes, the caller must normalize to a known format.
    const result = parseWhatsappForFirmEasy("+51987654321");
    expect(result.country_code).toBe("+51");
    expect(result.phone).toBe("987654321");
  });

  it("parses a number with 3-digit country code", () => {
    const result = parseWhatsappForFirmEasy("+593987654321");
    expect(result.country_code).toBe("+593");
    expect(result.phone).toBe("987654321");
  });

  it("strips spaces before parsing", () => {
    const result = parseWhatsappForFirmEasy(" +51 926481357 ");
    expect(result.country_code).toBe("+51");
    expect(result.phone).toBe("926481357");
  });

  it("throws for invalid format without plus sign", () => {
    expect(() => parseWhatsappForFirmEasy("51926481357")).toThrow(
      "Invalid whatsapp format",
    );
  });

  it("throws for invalid format with too few digits", () => {
    expect(() => parseWhatsappForFirmEasy("+5112345")).toThrow(
      "Invalid whatsapp format",
    );
  });

  it("throws for empty string", () => {
    expect(() => parseWhatsappForFirmEasy("")).toThrow(
      "Invalid whatsapp format",
    );
  });
});
