// ---------------------------------------------------------------------------
// FirmEasy API request/response types
// Based on: https://docs.firmeasy.legal/documentos/crear_documento/
// ---------------------------------------------------------------------------

export interface FirmEasySignerPlacement {
  type: "signature";
  page_number: number;
  relative_position_left: number;
  relative_position_top?: number;
  relative_position_bottom?: number;
  relative_size_width?: number;
  relative_size_height?: number;
}

export interface CreateDocumentSignerParams {
  name: string;
  country_code: string;
  phone: string;
  email: string;
  external_id: string;
  standard_flow?: (
    | "holographic_signature"
    | "otp_email"
    | "otp_whatsapp"
  )[];
  advanced_flow?: (
    | "selfie"
    | "identity_document_verification"
    | "doc_identidad"
    | "live_video_authentication"
  )[];
  redirect_link?: string;
  relative_position_left?: number;
  relative_position_top?: number;
  relative_position_bottom?: number;
  placements?: FirmEasySignerPlacement[];
}

export interface CreateDocumentParams {
  name: string;
  document_pdf_base64?: string;
  document_pdf_url?: string;
  folder_token?: string;
  external_id?: string;
  signature_deadline?: string;
  disable_owner_notifications?: boolean;
  disable_signer_notifications?: boolean;
  send_automatic_invitations?: boolean;
  is_signature_order_active?: boolean;
  is_rejection_allowed?: boolean;
  redirect_link?: string;
  observers?: string[];
  metadata?: Record<string, string>;
  signers: CreateDocumentSignerParams[];
}

export interface FirmEasySignerResponse {
  token: string;
  link: string;
  status: string;
  external_id: string;
  name: string;
  email: string;
  signed_at?: string;
  signed_at_hour?: string;
}

export interface FirmEasyTrackingEntry {
  signer_token?: string;
  signer_name?: string;
  action?: string;
  timestamp?: string;
  ip_address?: string;
  user_agent?: string;
  certificate_subject?: string;
  certificate_issuer?: string;
  certificate_serial?: string;
  certificate_valid_from?: string;
  certificate_valid_to?: string;
  chain_validation?: string;
  revocation_status?: string;
  timestamp_authority?: string;
  verification_url?: string;
}

export interface FirmEasyDocumentResponse {
  token: string;
  status: string;
  name: string;
  external_id?: string;
  original_file?: string;
  signed_file?: string;
  signers: FirmEasySignerResponse[];
  tracking?: FirmEasyTrackingEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface FirmEasyWebhookResponse {
  id: string;
  target_url: string;
  event: string;
  secret_key: string;
}

export interface FirmEasyWebhookPayload {
  event: string;
  document_token?: string;
  signer_token?: string;
  signer_external_id?: string;
  data?: Record<string, unknown>;
}

export interface FirmEasyAuthResponse {
  access: string;
  token_type: string;
  expires_in: number;
}

export interface FirmEasyErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
  detail?: string;
}
