/**
 * Pure functions to build immutable APIsPERU v1.3 payloads.
 * No database or network access — all data comes from arguments.
 */

import type {
  ApisPeruInvoiceRequest,
  ApisPeruCreditNoteRequest,
  ApisPeruDetailLine,
  ApisPeruCompany,
  ApisPeruClient,
  ApisPeruAddress,
  ApisPeruPdfRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Integer-centimo IGV arithmetic (18%)
// ---------------------------------------------------------------------------

/**
 * Compute subtotal (base imponible) and IGV from a total that includes 18% IGV.
 * All values are in integer céntimos.
 *
 * Formula: subtotal = floor((total * 100 + 59) / 118)
 * This produces the same result as rounding total / 1.18 to two decimal places
 * while staying in integer math.
 */
export function computeIgvBreakdown(totalCentimos: number): {
  subtotalCentimos: number;
  igvCentimos: number;
} {
  if (totalCentimos <= 0) {
    throw new Error(`Total must be positive, got ${totalCentimos}`);
  }
  const subtotalCentimos = Math.floor((totalCentimos * 100 + 59) / 118);
  const igvCentimos = totalCentimos - subtotalCentimos;

  if (subtotalCentimos + igvCentimos !== totalCentimos) {
    throw new Error(
      `IGV breakdown inconsistency: ${subtotalCentimos} + ${igvCentimos} != ${totalCentimos}`,
    );
  }
  return { subtotalCentimos, igvCentimos };
}

/**
 * Convert integer céntimos to a two-decimal number string for provider JSON.
 * Never use for stored values — only at the provider boundary.
 */
export function centimosToSoles(centimos: number): number {
  return Number((centimos / 100).toFixed(2));
}

// ---------------------------------------------------------------------------
// Spanish number-to-words for legends
// ---------------------------------------------------------------------------

const UNITS = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO",
  "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
  "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO",
  "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];

const TENS = [
  "", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
  "OCHENTA", "NOVENTA",
];

const HUNDREDS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function numberToWordsBelow1000(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  if (n < 30) return UNITS[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return unit === 0 ? TENS[ten] : `${TENS[ten]} Y ${UNITS[unit]}`;
  }
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  return remainder === 0
    ? (n === 100 ? "CIEN" : HUNDREDS[hundred])
    : `${HUNDREDS[hundred]} ${numberToWordsBelow1000(remainder)}`;
}

function integerToWords(n: number): string {
  if (n === 0) return "CERO";
  if (n < 0) return `MENOS ${integerToWords(-n)}`;

  const parts: string[] = [];

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  if (millions > 0) {
    parts.push(
      millions === 1
        ? "UN MILLÓN"
        : `${numberToWordsBelow1000(millions)} MILLONES`,
    );
  }
  if (thousands > 0) {
    parts.push(
      thousands === 1 ? "MIL" : `${numberToWordsBelow1000(thousands)} MIL`,
    );
  }
  if (remainder > 0 || parts.length === 0) {
    parts.push(numberToWordsBelow1000(remainder));
  }

  return parts.join(" ").trim();
}

/**
 * Convert a total in céntimos to the SUNAT legend 1000 format.
 * Example: 8900 -> "OCHENTA Y NUEVE Y 00/100 SOLES"
 */
export function amountToSpanishWords(totalCentimos: number): string {
  const soles = Math.floor(totalCentimos / 100);
  const cents = totalCentimos % 100;
  const centsStr = cents.toString().padStart(2, "0");
  return `${integerToWords(soles)} Y ${centsStr}/100 SOLES`;
}

// ---------------------------------------------------------------------------
// Service line constant
// ---------------------------------------------------------------------------

const SERVICE_DESCRIPTION = "Servicio de certificación notarial digital VeraDoc";
const SERVICE_CODE = "73311"; // UNSPSC: Legal consultation services
const SERVICE_UNIT = "ZZ"; // Mutually defined unit

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

export interface EmitterConfig {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion: string;
  ubigueo: string;
  provincia: string;
  departamento: string;
  distrito: string;
}

export interface PurchaserSnapshot {
  tipoDoc: string;
  numDoc: string;
  razonSocial: string;
  address?: {
    direccion?: string;
    provincia?: string;
    departamento?: string;
    distrito?: string;
    ubigueo?: string;
  };
}

function buildCompany(emitter: EmitterConfig): ApisPeruCompany {
  return {
    ruc: emitter.ruc,
    razonSocial: emitter.razonSocial,
    nombreComercial: emitter.nombreComercial,
    address: {
      direccion: emitter.direccion,
      ubigueo: emitter.ubigueo,
      provincia: emitter.provincia,
      departamento: emitter.departamento,
      distrito: emitter.distrito,
    },
  };
}

function buildClient(purchaser: PurchaserSnapshot): ApisPeruClient {
  const client: ApisPeruClient = {
    tipoDoc: purchaser.tipoDoc,
    numDoc: purchaser.numDoc,
    rznSocial: purchaser.razonSocial,
  };
  if (purchaser.address) {
    const addr: ApisPeruAddress = {};
    if (purchaser.address.direccion) addr.direccion = purchaser.address.direccion;
    if (purchaser.address.provincia) addr.provincia = purchaser.address.provincia;
    if (purchaser.address.departamento) addr.departamento = purchaser.address.departamento;
    if (purchaser.address.distrito) addr.distrito = purchaser.address.distrito;
    if (purchaser.address.ubigueo) addr.ubigueo = purchaser.address.ubigueo;
    if (Object.keys(addr).length > 0) client.address = addr;
  }
  return client;
}

function buildServiceLine(
  subtotalCentimos: number,
  igvCentimos: number,
  totalCentimos: number,
): ApisPeruDetailLine {
  const subtotal = centimosToSoles(subtotalCentimos);
  const igv = centimosToSoles(igvCentimos);
  const total = centimosToSoles(totalCentimos);

  return {
    codProducto: SERVICE_CODE,
    unidad: SERVICE_UNIT,
    descripcion: SERVICE_DESCRIPTION,
    cantidad: 1,
    mtoValorUnitario: subtotal,
    mtoValorVenta: subtotal,
    mtoBaseIgv: subtotal,
    porcentajeIgv: 18,
    igv,
    tipAfeIgv: "10",
    totalImpuestos: igv,
    mtoPrecioUnitario: total,
  };
}

/**
 * Format a Lima-timezone ISO datetime for APIsPERU.
 * Returns "YYYY-MM-DDTHH:mm:ss-05:00".
 */
export function limaDateTime(iso: string): string {
  const d = new Date(iso);
  const lima = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  return `${lima.replace(" ", "T")}-05:00`;
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

export interface InvoiceBuildInput {
  tipoDoc: "01" | "03";
  serie: string;
  correlativo: string;
  issuedAt: string;
  purchaser: PurchaserSnapshot;
  totalCentimos: number;
  emitter: EmitterConfig;
}

/**
 * Build an immutable factura (01) or boleta (03) payload.
 */
export function buildInvoicePayload(
  input: InvoiceBuildInput,
): ApisPeruInvoiceRequest {
  const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(
    input.totalCentimos,
  );
  const subtotal = centimosToSoles(subtotalCentimos);
  const igv = centimosToSoles(igvCentimos);
  const total = centimosToSoles(input.totalCentimos);

  return {
    ublVersion: "2.1",
    tipoOperacion: "0101",
    tipoDoc: input.tipoDoc,
    serie: input.serie,
    correlativo: input.correlativo,
    fechaEmision: limaDateTime(input.issuedAt),
    formaPago: { moneda: "PEN", tipo: "Contado" },
    tipoMoneda: "PEN",
    client: buildClient(input.purchaser),
    company: buildCompany(input.emitter),
    mtoOperGravadas: subtotal,
    mtoIGV: igv,
    valorVenta: subtotal,
    totalImpuestos: igv,
    subTotal: total,
    mtoImpVenta: total,
    details: [buildServiceLine(subtotalCentimos, igvCentimos, input.totalCentimos)],
    legends: [{ code: "1000", value: amountToSpanishWords(input.totalCentimos) }],
  };
}

export interface CreditNoteBuildInput {
  serie: string;
  correlativo: string;
  issuedAt: string;
  originalTipoDoc: "01" | "03";
  originalSerie: string;
  originalCorrelativo: string;
  purchaser: PurchaserSnapshot;
  refundAmountCentimos: number;
  reasonCode: string;
  reasonDescription: string;
  emitter: EmitterConfig;
}

/**
 * Build an immutable credit note (07) payload.
 * Provider intentionally spells it `numDocfectado` (not `numDocAfectado`).
 */
export function buildCreditNotePayload(
  input: CreditNoteBuildInput,
): ApisPeruCreditNoteRequest {
  const { subtotalCentimos, igvCentimos } = computeIgvBreakdown(
    input.refundAmountCentimos,
  );
  const subtotal = centimosToSoles(subtotalCentimos);
  const igv = centimosToSoles(igvCentimos);
  const total = centimosToSoles(input.refundAmountCentimos);

  return {
    ublVersion: "2.1",
    tipoDoc: "07",
    serie: input.serie,
    correlativo: input.correlativo,
    fechaEmision: limaDateTime(input.issuedAt),
    tipDocAfectado: input.originalTipoDoc,
    numDocfectado: `${input.originalSerie}-${input.originalCorrelativo}`,
    codMotivo: input.reasonCode,
    desMotivo: input.reasonDescription,
    tipoMoneda: "PEN",
    client: buildClient(input.purchaser),
    company: buildCompany(input.emitter),
    mtoOperGravadas: subtotal,
    mtoIGV: igv,
    totalImpuestos: igv,
    mtoImpVenta: total,
    details: [buildServiceLine(subtotalCentimos, igvCentimos, input.refundAmountCentimos)],
    legends: [{ code: "1000", value: amountToSpanishWords(input.refundAmountCentimos) }],
  };
}

/**
 * Reconstruct a PDF-request payload from a stored invoice/credit-note request payload.
 * The PDF endpoint accepts the same shape as the send endpoint.
 */
export function buildPdfPayload(
  storedPayload: ApisPeruInvoiceRequest | ApisPeruCreditNoteRequest,
): ApisPeruPdfRequest {
  return { ...storedPayload } as ApisPeruPdfRequest;
}
