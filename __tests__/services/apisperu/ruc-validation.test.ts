import { describe, it, expect } from "vitest";
import {
  isValidRuc,
  isValidDni,
  normalizeDocNumber,
  normalizeRazonSocial,
} from "@/lib/utils/ruc-validation";

describe("isValidRuc", () => {
  it("accepts valid RUC with correct checksum (20616178548)", () => {
    expect(isValidRuc("20616178548")).toBe(true);
  });

  it("accepts another known valid RUC (20100017491 — BCP)", () => {
    expect(isValidRuc("20100017491")).toBe(true);
  });

  it("rejects RUC with bad checksum", () => {
    expect(isValidRuc("20616178549")).toBe(false);
  });

  it("rejects non-digit strings", () => {
    expect(isValidRuc("2061617854A")).toBe(false);
    expect(isValidRuc("ABCDEFGHIJK")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidRuc("2061617854")).toBe(false);
    expect(isValidRuc("206161785480")).toBe(false);
    expect(isValidRuc("")).toBe(false);
  });

  it("rejects RUC starting with 0 or 3-9", () => {
    expect(isValidRuc("00616178548")).toBe(false);
    expect(isValidRuc("30616178548")).toBe(false);
  });
});

describe("isValidDni", () => {
  it("accepts exactly 8 digits", () => {
    expect(isValidDni("12345678")).toBe(true);
    expect(isValidDni("00000001")).toBe(true);
  });

  it("rejects non-8-digit strings", () => {
    expect(isValidDni("1234567")).toBe(false);
    expect(isValidDni("123456789")).toBe(false);
    expect(isValidDni("1234567A")).toBe(false);
    expect(isValidDni("")).toBe(false);
  });
});

describe("normalizeDocNumber", () => {
  it("removes spaces", () => {
    expect(normalizeDocNumber(" 20616 178 548 ")).toBe("20616178548");
  });
});

describe("normalizeRazonSocial", () => {
  it("trims, collapses whitespace, and uppercases", () => {
    expect(normalizeRazonSocial("  veradoc  s.a.c.s.  ")).toBe("VERADOC S.A.C.S.");
  });
});
