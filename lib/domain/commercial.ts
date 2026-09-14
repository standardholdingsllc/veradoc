export const COMMERCIAL_POLICY_VERSION = "commercial_2026_09_v1";
export const PACKET_STANDARD_PRICE_CENTIMOS = 19_900;
export const DEFAULT_IGV_RATE_BPS = 1_800;
export const CONTRACT_NOTARY_PARTICIPATION_BPS = 4_000;

export interface TaxBreakdown {
  grossCentimos: number;
  valueOfSaleCentimos: number;
  igvCentimos: number;
}

export function calculateTaxIncludedBreakdown(
  grossCentimos: number,
  taxRateBps = DEFAULT_IGV_RATE_BPS,
): TaxBreakdown {
  if (!Number.isInteger(grossCentimos) || grossCentimos <= 0) {
    throw new Error("Gross amount must be a positive integer number of céntimos.");
  }
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0) {
    throw new Error("Tax rate must be a non-negative integer in basis points.");
  }

  const denominator = 10_000 + taxRateBps;
  const valueOfSaleCentimos = Math.floor(
    (grossCentimos * 10_000 + Math.floor(denominator / 2)) / denominator,
  );

  return {
    grossCentimos,
    valueOfSaleCentimos,
    igvCentimos: grossCentimos - valueOfSaleCentimos,
  };
}

export interface CommercialBreakdown extends TaxBreakdown {
  standardGrossCentimos: number;
  promoDiscountCentimos: number;
}

export function calculateCommercialBreakdown(
  standardGrossCentimos: number,
  promoDiscountCentimos = 0,
  taxRateBps = DEFAULT_IGV_RATE_BPS,
): CommercialBreakdown {
  if (!Number.isInteger(promoDiscountCentimos) || promoDiscountCentimos < 0) {
    throw new Error("Promotion discount must be a non-negative integer number of céntimos.");
  }
  if (promoDiscountCentimos >= standardGrossCentimos) {
    throw new Error("Promotion must leave a positive payable amount.");
  }

  return {
    standardGrossCentimos,
    promoDiscountCentimos,
    ...calculateTaxIncludedBreakdown(
      standardGrossCentimos - promoDiscountCentimos,
      taxRateBps,
    ),
  };
}

export interface NotaryParticipationBreakdown {
  actualMndCentimos: number;
  protectedMndCentimos: number;
  contractualParticipationCentimos: number;
  veraDocPromoTopUpCentimos: number;
  totalBeforeNotaryIgvCentimos: number;
}

export function calculateNotaryParticipation(params: {
  standardGrossCentimos: number;
  actualGrossCentimos: number;
  processingFeeCentimos: number;
  participationBps?: number;
  protectStandardPriceForPromo?: boolean;
}): NotaryParticipationBreakdown {
  const participationBps = params.participationBps ?? CONTRACT_NOTARY_PARTICIPATION_BPS;
  if (!Number.isInteger(params.processingFeeCentimos) || params.processingFeeCentimos < 0) {
    throw new Error("A reconciled, non-negative processing fee is required.");
  }
  if (!Number.isInteger(participationBps) || participationBps <= 0 || participationBps > 10_000) {
    throw new Error("Participation must be between 1 and 10,000 basis points.");
  }

  const actualSale = calculateTaxIncludedBreakdown(params.actualGrossCentimos).valueOfSaleCentimos;
  const standardSale = calculateTaxIncludedBreakdown(params.standardGrossCentimos).valueOfSaleCentimos;
  const actualMndCentimos = Math.max(actualSale - params.processingFeeCentimos, 0);
  const protectedMndCentimos = Math.max(standardSale - params.processingFeeCentimos, 0);
  const contractualParticipationCentimos = Math.round(
    (actualMndCentimos * participationBps) / 10_000,
  );
  const protectedParticipationCentimos = Math.round(
    (protectedMndCentimos * participationBps) / 10_000,
  );
  const veraDocPromoTopUpCentimos =
    params.protectStandardPriceForPromo !== false &&
    params.actualGrossCentimos < params.standardGrossCentimos
      ? Math.max(protectedParticipationCentimos - contractualParticipationCentimos, 0)
      : 0;

  return {
    actualMndCentimos,
    protectedMndCentimos,
    contractualParticipationCentimos,
    veraDocPromoTopUpCentimos,
    totalBeforeNotaryIgvCentimos:
      contractualParticipationCentimos + veraDocPromoTopUpCentimos,
  };
}

