/**
 * Types for the API PERÚ RUC lookup product (apiperu.net).
 * This is a separate service from the Facturación v1.3 host.
 */

export interface RucLookupSuccessData {
  ruc: string;
  nombre_o_razon_social: string;
  direccion: string;
  direccion_completa?: string;
  estado: string;
  condicion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo?: string[];
  ubigeo2?: string;
}

export interface RucLookupSuccessResponse {
  success: true;
  data: RucLookupSuccessData;
}

export interface RucLookupFailureResponse {
  success: false;
  message?: string;
}

export type RucLookupResponse =
  | RucLookupSuccessResponse
  | RucLookupFailureResponse;

export interface NormalizedRucResult {
  ruc: string;
  razonSocial: string;
  direccion: string;
  estado: string;
  condicion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo: string | null;
}

export type RucLookupErrorKind =
  | "not_found"
  | "inactive"
  | "not_habido"
  | "ruc_mismatch"
  | "invalid_response"
  | "auth_error"
  | "timeout"
  | "provider_error";

export class RucLookupError extends Error {
  constructor(
    public readonly kind: RucLookupErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RucLookupError";
  }
}
