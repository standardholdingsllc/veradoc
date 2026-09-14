import { describe, it, expect } from "vitest";
import {
  computeIgvBreakdown,
  centimosToSoles,
  amountToSpanishWords,
} from "@/lib/services/apisperu/mapper";

describe("computeIgvBreakdown", () => {
  it("handles S/ 89.00 (8900 centimos)", () => {
    const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(8900);
    expect(subtotalCentimos).toBe(7542);
    expect(igvCentimos).toBe(1358);
    expect(subtotalCentimos + igvCentimos).toBe(8900);
  });

  it("handles S/ 1.00 (100 centimos)", () => {
    const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(100);
    expect(subtotalCentimos + igvCentimos).toBe(100);
    // floor((100*100+59)/118) = floor(10059/118) = 85
    expect(subtotalCentimos).toBe(85);
    expect(igvCentimos).toBe(15);
  });

  it("handles S/ 0.01 (1 centimo)", () => {
    const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(1);
    expect(subtotalCentimos + igvCentimos).toBe(1);
  });

  it("handles large amount S/ 10,000.00 (1000000 centimos)", () => {
    const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(1000000);
    expect(subtotalCentimos + igvCentimos).toBe(1000000);
    expect(subtotalCentimos).toBe(847458);
    expect(igvCentimos).toBe(152542);
  });

  it("throws on zero or negative total", () => {
    expect(() => computeIgvBreakdown(0)).toThrow();
    expect(() => computeIgvBreakdown(-100)).toThrow();
  });

  it("consistency: subtotal * 1.18 rounded should equal total", () => {
    const totals = [100, 500, 899, 1000, 4999, 8900, 10000, 50000, 100000, 999999];
    for (const total of totals) {
      const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(total);
      expect(subtotalCentimos + igvCentimos).toBe(total);
      expect(subtotalCentimos).toBeGreaterThanOrEqual(0);
      expect(igvCentimos).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("centimosToSoles", () => {
  it("converts correctly", () => {
    expect(centimosToSoles(8900)).toBe(89.0);
    expect(centimosToSoles(7542)).toBe(75.42);
    expect(centimosToSoles(1358)).toBe(13.58);
    expect(centimosToSoles(100)).toBe(1.0);
    expect(centimosToSoles(1)).toBe(0.01);
  });
});

describe("amountToSpanishWords", () => {
  it("converts S/ 89.00", () => {
    const result = amountToSpanishWords(8900);
    expect(result).toBe("OCHENTA Y NUEVE Y 00/100 SOLES");
  });

  it("converts S/ 1.00", () => {
    const result = amountToSpanishWords(100);
    expect(result).toBe("UNO Y 00/100 SOLES");
  });

  it("converts S/ 1,234.56", () => {
    const result = amountToSpanishWords(123456);
    expect(result).toBe("MIL DOSCIENTOS TREINTA Y CUATRO Y 56/100 SOLES");
  });

  it("converts S/ 0.01", () => {
    const result = amountToSpanishWords(1);
    expect(result).toBe("CERO Y 01/100 SOLES");
  });
});
