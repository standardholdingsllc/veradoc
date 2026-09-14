import { describe, expect, it } from "vitest";
import {
  calculateCommercialBreakdown,
  calculateNotaryParticipation,
  calculateTaxIncludedBreakdown,
} from "./commercial";

describe("commercial accounting", () => {
  it("splits the S/199 tax-inclusive price using the CPE rounding rule", () => {
    expect(calculateTaxIncludedBreakdown(19_900)).toEqual({
      grossCentimos: 19_900,
      valueOfSaleCentimos: 16_864,
      igvCentimos: 3_036,
    });
  });

  it("applies a private promotion before calculating IGV", () => {
    expect(calculateCommercialBreakdown(19_900, 2_000)).toEqual({
      standardGrossCentimos: 19_900,
      promoDiscountCentimos: 2_000,
      grossCentimos: 17_900,
      valueOfSaleCentimos: 15_169,
      igvCentimos: 2_731,
    });
  });

  it("funds the promo top-up separately from the contractual share", () => {
    expect(
      calculateNotaryParticipation({
        standardGrossCentimos: 19_900,
        actualGrossCentimos: 17_900,
        processingFeeCentimos: 700,
      }),
    ).toEqual({
      actualMndCentimos: 14_469,
      protectedMndCentimos: 16_164,
      contractualParticipationCentimos: 5_788,
      veraDocPromoTopUpCentimos: 678,
      totalBeforeNotaryIgvCentimos: 6_466,
    });
  });
});
