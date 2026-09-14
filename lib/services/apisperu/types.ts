/**
 * TypeScript types for APIsPERU Facturación v1.3 request/response payloads.
 *
 * These are provider wire types and must NOT leak into UI/domain layers.
 * See: https://facturacion.apisperu.com/doc
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface ApisPeruClient {
  tipoDoc: string;
  numDoc: string;
  rznSocial: string;
  address?: ApisPeruAddress;
}

export interface ApisPeruAddress {
  direccion?: string;
  provincia?: string;
  departamento?: string;
  distrito?: string;
  ubigueo?: string;
}

export interface ApisPeruCompany {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  address: ApisPeruAddress;
}

export interface ApisPeruDetailLine {
  codProducto: string;
  unidad: string;
  descripcion: string;
  cantidad: number;
  mtoValorUnitario: number;
  mtoValorVenta: number;
  mtoBaseIgv: number;
  porcentajeIgv: number;
  igv: number;
  tipAfeIgv: string;
  totalImpuestos: number;
  mtoPrecioUnitario: number;
}

export interface ApisPeruLegend {
  code: string;
  value: string;
}

export interface ApisPeruFormaPago {
  moneda: string;
  tipo: string;
}

// ---------------------------------------------------------------------------
// Invoice (01/03) request
// ---------------------------------------------------------------------------

export interface ApisPeruInvoiceRequest {
  ublVersion: string;
  tipoOperacion: string;
  tipoDoc: "01" | "03";
  serie: string;
  correlativo: string;
  fechaEmision: string;
  formaPago: ApisPeruFormaPago;
  tipoMoneda: string;
  client: ApisPeruClient;
  company: ApisPeruCompany;
  mtoOperGravadas: number;
  mtoIGV: number;
  valorVenta: number;
  totalImpuestos: number;
  subTotal: number;
  mtoImpVenta: number;
  details: ApisPeruDetailLine[];
  legends: ApisPeruLegend[];
}

// ---------------------------------------------------------------------------
// Credit note (07) request
// ---------------------------------------------------------------------------

export interface ApisPeruCreditNoteRequest {
  ublVersion: string;
  tipoDoc: "07";
  serie: string;
  correlativo: string;
  fechaEmision: string;
  tipDocAfectado: "01" | "03";
  numDocfectado: string;
  codMotivo: string;
  desMotivo: string;
  tipoMoneda: string;
  client: ApisPeruClient;
  company: ApisPeruCompany;
  mtoOperGravadas: number;
  mtoIGV: number;
  totalImpuestos: number;
  mtoImpVenta: number;
  details: ApisPeruDetailLine[];
  legends: ApisPeruLegend[];
}

// ---------------------------------------------------------------------------
// Provider responses
// ---------------------------------------------------------------------------

export interface ApisPeruCdrResponse {
  id: string;
  code: string;
  description: string;
  notes: string[];
  accepted?: boolean;
}

/**
 * /invoice/send and /note/send → DocumentResponse (Swagger).
 * Top-level: xml (signed XML), hash (digital signature hash).
 * Nested: sunatResponse (BillResult) contains the SUNAT CDR.
 */
export interface ApisPeruSendResponse {
  xml?: string;
  hash?: string;
  sunatResponse?: {
    success: boolean;
    cdrResponse?: ApisPeruCdrResponse;
    cdrZip?: string;
    error?: { code?: string; message?: string };
  };
}

/**
 * /invoice/status → StatusResult (Swagger).
 * Root-level: success, cdrZip, cdrResponse, code, error.
 * There is NO "sunatResponse" nesting — cdrResponse is at the root.
 */
export interface ApisPeruStatusResult {
  success: boolean;
  cdrZip?: string;
  cdrResponse?: ApisPeruCdrResponse;
  code?: string;
  error?: { code?: string; message?: string };
}

export interface ApisPeruPdfRequest {
  ublVersion: string;
  tipoDoc: string;
  serie: string;
  correlativo: string;
  fechaEmision: string;
  tipoMoneda: string;
  client: ApisPeruClient;
  company: ApisPeruCompany;
  mtoOperGravadas: number;
  mtoIGV: number;
  valorVenta: number;
  totalImpuestos: number;
  subTotal: number;
  mtoImpVenta: number;
  details: ApisPeruDetailLine[];
  legends: ApisPeruLegend[];
  formaPago?: ApisPeruFormaPago;
  // Credit note specific
  tipDocAfectado?: string;
  numDocfectado?: string;
  codMotivo?: string;
  desMotivo?: string;
}

// ---------------------------------------------------------------------------
// Typed errors for workflow control
// ---------------------------------------------------------------------------

export type ApisPeruErrorKind =
  | "definitive_validation"
  | "ambiguous_submission"
  | "status_not_ready"
  | "provider_unavailable";

export class ApisPeruError extends Error {
  constructor(
    public readonly kind: ApisPeruErrorKind,
    message: string,
    public readonly httpStatus?: number,
    public readonly providerMessage?: string,
  ) {
    super(message);
    this.name = "ApisPeruError";
  }
}
