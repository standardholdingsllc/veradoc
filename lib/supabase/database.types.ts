export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      complaints: {
        Row: {
          amount: number | null
          code: string
          complaint_type: string
          consumer_address: string | null
          consumer_dni: string
          consumer_email: string
          consumer_is_minor: boolean
          consumer_name: string
          consumer_phone: string | null
          created_at: string
          description: string
          guardian_dni: string | null
          guardian_name: string | null
          id: number
          ip_address: string | null
          order_number: string | null
          product_or_service: string
          requested_remedy: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          amount?: number | null
          code?: string
          complaint_type: string
          consumer_address?: string | null
          consumer_dni: string
          consumer_email: string
          consumer_is_minor?: boolean
          consumer_name: string
          consumer_phone?: string | null
          created_at?: string
          description: string
          guardian_dni?: string | null
          guardian_name?: string | null
          id?: never
          ip_address?: string | null
          order_number?: string | null
          product_or_service: string
          requested_remedy: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          amount?: number | null
          code?: string
          complaint_type?: string
          consumer_address?: string | null
          consumer_dni?: string
          consumer_email?: string
          consumer_is_minor?: boolean
          consumer_name?: string
          consumer_phone?: string | null
          created_at?: string
          description?: string
          guardian_dni?: string | null
          guardian_name?: string | null
          id?: never
          ip_address?: string | null
          order_number?: string | null
          product_or_service?: string
          requested_remedy?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      firmeasy_webhook_log: {
        Row: {
          created_at: string | null
          document_token: string | null
          error_message: string | null
          event_type: string
          id: string
          payload_hash: string
          processed_at: string | null
          processing_started_at: string | null
          processing_state: string
          raw_payload: Json
          retry_count: number
          signer_token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_token?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload_hash: string
          processed_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          raw_payload?: Json
          retry_count?: number
          signer_token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_token?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload_hash?: string
          processed_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          raw_payload?: Json
          retry_count?: number
          signer_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          accepted_at: string | null
          available_at: string | null
          cdr_storage_path: string | null
          cdr_zip_base64: string | null
          claim_operation: string | null
          claim_token: string | null
          claimed_at: string | null
          correlativo: string
          created_at: string
          currency: string
          document_hash: string | null
          error_detail: string | null
          id: string
          igv_centimos: number
          issue_date: string
          issued_at: string
          last_error_code: string | null
          last_error_operation: string | null
          next_operation: string
          operation_status: string
          packet_id: string
          payment_id: string
          pdf_storage_path: string | null
          provider_response: Json | null
          purchaser_address: Json | null
          purchaser_num_doc: string
          purchaser_razon_social: string
          purchaser_tipo_doc: string
          realtor_id: string
          refund_id: string | null
          related_invoice_id: string | null
          request_payload: Json | null
          serie: string
          signed_xml: string | null
          status: string
          submission_intent_at: string | null
          subtotal_centimos: number
          sunat_cdr_description: string | null
          sunat_cdr_notes: string[] | null
          sunat_response_code: string | null
          tipo_doc: string
          total_centimos: number
          updated_at: string
          xml_storage_path: string | null
        }
        Insert: {
          accepted_at?: string | null
          available_at?: string | null
          cdr_storage_path?: string | null
          cdr_zip_base64?: string | null
          claim_operation?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          correlativo: string
          created_at?: string
          currency: string
          document_hash?: string | null
          error_detail?: string | null
          id?: string
          igv_centimos: number
          issue_date: string
          issued_at: string
          last_error_code?: string | null
          last_error_operation?: string | null
          next_operation: string
          operation_status: string
          packet_id: string
          payment_id: string
          pdf_storage_path?: string | null
          provider_response?: Json | null
          purchaser_address?: Json | null
          purchaser_num_doc: string
          purchaser_razon_social: string
          purchaser_tipo_doc: string
          realtor_id: string
          refund_id?: string | null
          related_invoice_id?: string | null
          request_payload?: Json | null
          serie: string
          signed_xml?: string | null
          status: string
          submission_intent_at?: string | null
          subtotal_centimos: number
          sunat_cdr_description?: string | null
          sunat_cdr_notes?: string[] | null
          sunat_response_code?: string | null
          tipo_doc: string
          total_centimos: number
          updated_at?: string
          xml_storage_path?: string | null
        }
        Update: {
          accepted_at?: string | null
          available_at?: string | null
          cdr_storage_path?: string | null
          cdr_zip_base64?: string | null
          claim_operation?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          correlativo?: string
          created_at?: string
          currency?: string
          document_hash?: string | null
          error_detail?: string | null
          id?: string
          igv_centimos?: number
          issue_date?: string
          issued_at?: string
          last_error_code?: string | null
          last_error_operation?: string | null
          next_operation?: string
          operation_status?: string
          packet_id?: string
          payment_id?: string
          pdf_storage_path?: string | null
          provider_response?: Json | null
          purchaser_address?: Json | null
          purchaser_num_doc?: string
          purchaser_razon_social?: string
          purchaser_tipo_doc?: string
          realtor_id?: string
          refund_id?: string | null
          related_invoice_id?: string | null
          request_payload?: Json | null
          serie?: string
          signed_xml?: string | null
          status?: string
          submission_intent_at?: string | null
          subtotal_centimos?: number
          sunat_cdr_description?: string | null
          sunat_cdr_notes?: string[] | null
          sunat_response_code?: string | null
          tipo_doc?: string
          total_centimos?: number
          updated_at?: string
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "payment_refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_packets: {
        Row: {
          archive_policy_version: string | null
          archive_reason: string | null
          archived_at: string | null
          archival_hold_approved_by: string | null
          archival_hold_reason: string | null
          archival_hold_until: string | null
          certified_at: string | null
          cleanup_claim_expires_at: string | null
          cleanup_claim_token: string | null
          created_at: string | null
          created_by: string
          creation_state: string
          department: string | null
          deposit_amount: number | null
          district: string | null
          document_hash: string | null
          firmeasy_document_status: string | null
          firmeasy_document_token: string | null
          id: string
          lease_end_date: string | null
          lease_start_date: string | null
          notary_workflow_version: string
          packet_code: string | null
          parent_packet_id: string | null
          property_address: string | null
          property_unit: string | null
          province: string | null
          renewed_by_packet_id: string | null
          rental_amount: number | null
          service_window_ends_at: string | null
          service_window_started_at: string | null
          status: string
          submitted_to_notary_at: string | null
          updated_at: string | null
          upload_reservation_expires_at: string | null
        }
        Insert: {
          archive_policy_version?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archival_hold_approved_by?: string | null
          archival_hold_reason?: string | null
          archival_hold_until?: string | null
          certified_at?: string | null
          cleanup_claim_expires_at?: string | null
          cleanup_claim_token?: string | null
          created_at?: string | null
          created_by: string
          creation_state?: string
          department?: string | null
          deposit_amount?: number | null
          district?: string | null
          document_hash?: string | null
          firmeasy_document_status?: string | null
          firmeasy_document_token?: string | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          notary_workflow_version?: string
          packet_code?: string | null
          parent_packet_id?: string | null
          property_address?: string | null
          property_unit?: string | null
          province?: string | null
          renewed_by_packet_id?: string | null
          rental_amount?: number | null
          service_window_ends_at?: string | null
          service_window_started_at?: string | null
          status?: string
          submitted_to_notary_at?: string | null
          updated_at?: string | null
          upload_reservation_expires_at?: string | null
        }
        Update: {
          archive_policy_version?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archival_hold_approved_by?: string | null
          archival_hold_reason?: string | null
          archival_hold_until?: string | null
          certified_at?: string | null
          cleanup_claim_expires_at?: string | null
          cleanup_claim_token?: string | null
          created_at?: string | null
          created_by?: string
          creation_state?: string
          department?: string | null
          deposit_amount?: number | null
          district?: string | null
          document_hash?: string | null
          firmeasy_document_status?: string | null
          firmeasy_document_token?: string | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          notary_workflow_version?: string
          packet_code?: string | null
          parent_packet_id?: string | null
          property_address?: string | null
          property_unit?: string | null
          province?: string | null
          renewed_by_packet_id?: string | null
          rental_amount?: number | null
          service_window_ends_at?: string | null
          service_window_started_at?: string | null
          status?: string
          submitted_to_notary_at?: string | null
          updated_at?: string | null
          upload_reservation_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_packets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_packets_parent_packet_id_fkey"
            columns: ["parent_packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_packets_renewed_by_packet_id_fkey"
            columns: ["renewed_by_packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_assignments: {
        Row: {
          assigned_at: string | null
          correction_scope: string | null
          decided_at: string | null
          decision: string | null
          decision_version: number
          id: string
          notary_id: string
          observations: string | null
          packet_id: string
          prioritized_at: string | null
          prioritized_by: string | null
          priority: string
          priority_reason: string | null
          review_started_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          correction_scope?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_version?: number
          id?: string
          notary_id: string
          observations?: string | null
          packet_id: string
          prioritized_at?: string | null
          prioritized_by?: string | null
          priority?: string
          priority_reason?: string | null
          review_started_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          correction_scope?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_version?: number
          id?: string
          notary_id?: string
          observations?: string | null
          packet_id?: string
          prioritized_at?: string | null
          prioritized_by?: string | null
          priority?: string
          priority_reason?: string | null
          review_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notary_assignments_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_assignments_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: true
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_assignments_prioritized_by_fkey"
            columns: ["prioritized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_attestations: {
        Row: {
          attestation_data: Json
          attestation_text: string
          attestation_text_hash: string
          attestation_text_version: string
          attested_at: string
          created_at: string | null
          id: string
          ip_address: unknown
          notarial_scan_document_id: string
          notarial_scan_hash: string
          notary_id: string
          packet_id: string
          source_document_hash: string
          source_signed_document_id: string
          user_agent: string | null
        }
        Insert: {
          attestation_data?: Json
          attestation_text: string
          attestation_text_hash: string
          attestation_text_version: string
          attested_at?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          notarial_scan_document_id: string
          notarial_scan_hash: string
          notary_id: string
          packet_id: string
          source_document_hash: string
          source_signed_document_id: string
          user_agent?: string | null
        }
        Update: {
          attestation_data?: Json
          attestation_text?: string
          attestation_text_hash?: string
          attestation_text_version?: string
          attested_at?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          notarial_scan_document_id?: string
          notarial_scan_hash?: string
          notary_id?: string
          packet_id?: string
          source_document_hash?: string
          source_signed_document_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notary_attestations_notarial_scan_document_id_fkey"
            columns: ["notarial_scan_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_attestations_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_attestations_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_attestations_source_signed_document_id_fkey"
            columns: ["source_signed_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_certifications: {
        Row: {
          attestation_id: string | null
          certification_report_document_id: string | null
          certification_type: string
          certified_at: string | null
          checklist_data: Json | null
          checklist_version: number
          id: string
          notarial_scan_document_id: string | null
          notary_id: string
          observations: string | null
          packet_id: string
          prepared_at: string | null
          publication_status: string
          published_at: string | null
        }
        Insert: {
          attestation_id?: string | null
          certification_report_document_id?: string | null
          certification_type: string
          certified_at?: string | null
          checklist_data?: Json | null
          checklist_version?: number
          id?: string
          notarial_scan_document_id?: string | null
          notary_id: string
          observations?: string | null
          packet_id: string
          prepared_at?: string | null
          publication_status?: string
          published_at?: string | null
        }
        Update: {
          attestation_id?: string | null
          certification_report_document_id?: string | null
          certification_type?: string
          certified_at?: string | null
          checklist_data?: Json | null
          checklist_version?: number
          id?: string
          notarial_scan_document_id?: string | null
          notary_id?: string
          observations?: string | null
          packet_id?: string
          prepared_at?: string | null
          publication_status?: string
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notary_certifications_attestation_id_fkey"
            columns: ["attestation_id"]
            isOneToOne: false
            referencedRelation: "notary_attestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_certifications_certification_report_document_id_fkey"
            columns: ["certification_report_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_certifications_notarial_scan_document_id_fkey"
            columns: ["notarial_scan_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_certifications_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_certifications_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_coverage: {
        Row: {
          active: boolean
          created_at: string | null
          department: string | null
          id: string
          notary_id: string
          province: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          department?: string | null
          id?: string
          notary_id: string
          province: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          department?: string | null
          id?: string
          notary_id?: string
          province?: string
        }
        Relationships: [
          {
            foreignKeyName: "notary_coverage_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_monthly_payouts: {
        Row: {
          certification_count: number
          confirmed_at: string | null
          confirmed_by: string | null
          contractual_amount_centimos: number
          created_at: string
          currency: string
          formula_version: string
          gross_amount: number
          id: string
          notary_id: string
          notary_comprobante_received_at: string | null
          notary_comprobante_reference: string | null
          notary_igv_centimos: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_reference: string | null
          period_month: string
          prepared_at: string | null
          prepared_by: string | null
          promo_top_up_centimos: number
          status: string
          updated_at: string
        }
        Insert: {
          certification_count?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          contractual_amount_centimos?: number
          created_at?: string
          currency?: string
          formula_version?: string
          gross_amount?: number
          id?: string
          notary_id: string
          notary_comprobante_received_at?: string | null
          notary_comprobante_reference?: string | null
          notary_igv_centimos?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          period_month: string
          prepared_at?: string | null
          prepared_by?: string | null
          promo_top_up_centimos?: number
          status?: string
          updated_at?: string
        }
        Update: {
          certification_count?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          contractual_amount_centimos?: number
          created_at?: string
          currency?: string
          formula_version?: string
          gross_amount?: number
          id?: string
          notary_id?: string
          notary_comprobante_received_at?: string | null
          notary_comprobante_reference?: string | null
          notary_igv_centimos?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          period_month?: string
          prepared_at?: string | null
          prepared_by?: string | null
          promo_top_up_centimos?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notary_monthly_payouts_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_monthly_payouts_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_monthly_payouts_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_payout_items: {
        Row: {
          certification_id: string
          created_at: string
          id: string
          payout_id: string
          rate_id: string
          unit_amount: number
        }
        Insert: {
          certification_id: string
          created_at?: string
          id?: string
          payout_id: string
          rate_id: string
          unit_amount: number
        }
        Update: {
          certification_id?: string
          created_at?: string
          id?: string
          payout_id?: string
          rate_id?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "notary_payout_items_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: true
            referencedRelation: "notary_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "notary_monthly_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_payout_items_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "notary_payout_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_payout_rates: {
        Row: {
          amount_per_certification: number | null
          contract_reference: string | null
          created_at: string
          created_by: string
          currency: string
          effective_from: string
          effective_to: string | null
          formula_version: string
          id: string
          notary_id: string
          participation_bps: number
          protect_standard_price_for_promos: boolean
        }
        Insert: {
          amount_per_certification?: number | null
          contract_reference?: string | null
          created_at?: string
          created_by: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          formula_version?: string
          id?: string
          notary_id: string
          participation_bps?: number
          protect_standard_price_for_promos?: boolean
        }
        Update: {
          amount_per_certification?: number | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          formula_version?: string
          id?: string
          notary_id?: string
          participation_bps?: number
          protect_standard_price_for_promos?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notary_payout_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_payout_rates_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_review_checklists: {
        Row: {
          checklist_data: Json
          checklist_version: number
          id: string
          notary_id: string
          packet_id: string
          updated_at: string | null
        }
        Insert: {
          checklist_data?: Json
          checklist_version?: number
          id?: string
          notary_id: string
          packet_id: string
          updated_at?: string | null
        }
        Update: {
          checklist_data?: Json
          checklist_version?: number
          id?: string
          notary_id?: string
          packet_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notary_review_checklists_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_review_checklists_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: true
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_workflow_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          certification_id: string | null
          claim_token: string | null
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          job_type: string
          last_error: string | null
          packet_id: string
          payload: Json
          processing_started_at: string | null
          result: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          certification_id?: string | null
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          job_type: string
          last_error?: string | null
          packet_id: string
          payload?: Json
          processing_started_at?: string | null
          result?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          certification_id?: string | null
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          job_type?: string
          last_error?: string | null
          packet_id?: string
          payload?: Json
          processing_started_at?: string | null
          result?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notary_workflow_jobs_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "notary_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_workflow_jobs_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      notary_workflow_settings: {
        Row: {
          enabled_at: string | null
          enabled_by: string | null
          notary_id: string
          physical_seal_v1_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          enabled_at?: string | null
          enabled_by?: string | null
          notary_id: string
          physical_seal_v1_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          enabled_at?: string | null
          enabled_by?: string | null
          notary_id?: string
          physical_seal_v1_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notary_workflow_settings_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notary_workflow_settings_notary_id_fkey"
            columns: ["notary_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          claim_token: string | null
          created_at: string | null
          event_type: string
          id: string
          last_error: string | null
          packet_id: string
          payload: Json
          processing_started_at: string | null
          recipient_key: string
          sent_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          packet_id: string
          payload?: Json
          processing_started_at?: string | null
          recipient_key: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          packet_id?: string
          payload?: Json
          processing_started_at?: string | null
          recipient_key?: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          signing_token_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash: string
          signing_token_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          signing_token_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "otp_codes_signing_token_id_fkey"
            columns: ["signing_token_id"]
            isOneToOne: false
            referencedRelation: "signing_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          packet_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          packet_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          packet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packet_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_audit_log_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_documents: {
        Row: {
          certification_id: string | null
          created_at: string | null
          document_type: string
          file_hash: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json
          original_filename: string | null
          packet_id: string
          page_count: number | null
          source_document_id: string | null
          status: string
          storage_path: string
          supersedes_document_id: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          certification_id?: string | null
          created_at?: string | null
          document_type: string
          file_hash?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          original_filename?: string | null
          packet_id: string
          page_count?: number | null
          source_document_id?: string | null
          status?: string
          storage_path: string
          supersedes_document_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          certification_id?: string | null
          created_at?: string | null
          document_type?: string
          file_hash?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          original_filename?: string | null
          packet_id?: string
          page_count?: number | null
          source_document_id?: string | null
          status?: string
          storage_path?: string
          supersedes_document_id?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "packet_documents_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "notary_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_documents_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_documents_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "packet_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_signers: {
        Row: {
          completed_at: string | null
          created_at: string | null
          firmeasy_signer_link: string | null
          firmeasy_signer_status: string | null
          firmeasy_signer_token: string | null
          id: string
          packet_id: string
          profile_id: string | null
          role_in_lease: string
          signed_at: string | null
          signer_dni: string
          signer_email: string
          signer_full_name: string
          signer_whatsapp: string
          signing_token_id: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          firmeasy_signer_link?: string | null
          firmeasy_signer_status?: string | null
          firmeasy_signer_token?: string | null
          id?: string
          packet_id: string
          profile_id?: string | null
          role_in_lease: string
          signed_at?: string | null
          signer_dni: string
          signer_email: string
          signer_full_name: string
          signer_whatsapp: string
          signing_token_id?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          firmeasy_signer_link?: string | null
          firmeasy_signer_status?: string | null
          firmeasy_signer_token?: string | null
          id?: string
          packet_id?: string
          profile_id?: string | null
          role_in_lease?: string
          signed_at?: string | null
          signer_dni?: string
          signer_email?: string
          signer_full_name?: string
          signer_whatsapp?: string
          signing_token_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "packet_signers_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_signers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_signers_signing_token_id_fkey"
            columns: ["signing_token_id"]
            isOneToOne: false
            referencedRelation: "signing_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refunds: {
        Row: {
          approval_evidence: string | null
          amount_centimos: number
          created_at: string
          currency: string
          id: string
          packet_id: string
          policy_approved_by: string | null
          policy_reason: string | null
          policy_version: string | null
          payment_id: string
          provider: string
          provider_idempotency_key: string
          provider_refund_id: string | null
          provider_response: Json | null
          realtor_id: string
          reason_code: string
          reason_description: string
          refunded_at: string | null
          request_id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_evidence?: string | null
          amount_centimos: number
          created_at?: string
          currency: string
          id?: string
          packet_id: string
          policy_approved_by?: string | null
          policy_reason?: string | null
          policy_version?: string | null
          payment_id: string
          provider: string
          provider_idempotency_key: string
          provider_refund_id?: string | null
          provider_response?: Json | null
          realtor_id: string
          reason_code: string
          reason_description: string
          refunded_at?: string | null
          request_id: string
          requested_by: string
          status: string
          updated_at?: string
        }
        Update: {
          approval_evidence?: string | null
          amount_centimos?: number
          created_at?: string
          currency?: string
          id?: string
          packet_id?: string
          policy_approved_by?: string | null
          policy_reason?: string | null
          policy_version?: string | null
          payment_id?: string
          provider?: string
          provider_idempotency_key?: string
          provider_refund_id?: string | null
          provider_response?: Json | null
          realtor_id?: string
          reason_code?: string
          reason_description?: string
          refunded_at?: string | null
          request_id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          attempt_count: number
          error_message: string | null
          event_type: string
          id: string
          last_attempt_at: string | null
          object_id: string
          payload_hash: string
          processed_at: string | null
          processing_result: string | null
          provider: string
          raw_payload: Json | null
          received_at: string | null
        }
        Insert: {
          attempt_count?: number
          error_message?: string | null
          event_type: string
          id?: string
          last_attempt_at?: string | null
          object_id: string
          payload_hash: string
          processed_at?: string | null
          processing_result?: string | null
          provider: string
          raw_payload?: Json | null
          received_at?: string | null
        }
        Update: {
          attempt_count?: number
          error_message?: string | null
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          object_id?: string
          payload_hash?: string
          processed_at?: string | null
          processing_result?: string | null
          provider?: string
          raw_payload?: Json | null
          received_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_centimos: number | null
          comprobante_type: string | null
          cpe_snapshot_version: number | null
          created_at: string | null
          currency: string
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          packet_id: string
          paid_at: string | null
          pricing_config_id: string | null
          processing_fee_centimos: number | null
          promo_code_hint: string | null
          promo_discount_centimos: number
          recognized_at: string | null
          payment_confirmation_attempts: number
          payment_confirmation_claimed_at: string | null
          payment_confirmation_error: string | null
          payment_confirmation_sent_at: string | null
          payment_method: string | null
          payment_provider: string
          payment_provider_ref: string | null
          purchaser_address: Json | null
          purchaser_num_doc: string | null
          purchaser_razon_social: string | null
          purchaser_tipo_doc: string | null
          realtor_id: string
          status: string
          standard_amount_centimos: number | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_centimos?: number | null
          comprobante_type?: string | null
          cpe_snapshot_version?: number | null
          created_at?: string | null
          currency?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          packet_id: string
          paid_at?: string | null
          pricing_config_id?: string | null
          processing_fee_centimos?: number | null
          promo_code_hint?: string | null
          promo_discount_centimos?: number
          recognized_at?: string | null
          payment_confirmation_attempts?: number
          payment_confirmation_claimed_at?: string | null
          payment_confirmation_error?: string | null
          payment_confirmation_sent_at?: string | null
          payment_method?: string | null
          payment_provider: string
          payment_provider_ref?: string | null
          purchaser_address?: Json | null
          purchaser_num_doc?: string | null
          purchaser_razon_social?: string | null
          purchaser_tipo_doc?: string | null
          realtor_id: string
          status?: string
          standard_amount_centimos?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_centimos?: number | null
          comprobante_type?: string | null
          cpe_snapshot_version?: number | null
          created_at?: string | null
          currency?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          packet_id?: string
          paid_at?: string | null
          pricing_config_id?: string | null
          processing_fee_centimos?: number | null
          promo_code_hint?: string | null
          promo_discount_centimos?: number
          recognized_at?: string | null
          payment_confirmation_attempts?: number
          payment_confirmation_claimed_at?: string | null
          payment_confirmation_error?: string | null
          payment_confirmation_sent_at?: string | null
          payment_method?: string | null
          payment_provider?: string
          payment_provider_ref?: string | null
          purchaser_address?: Json | null
          purchaser_num_doc?: string | null
          purchaser_razon_social?: string | null
          purchaser_tipo_doc?: string | null
          realtor_id?: string
          status?: string
          standard_amount_centimos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_realtor_id_fkey"
            columns: ["realtor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          active: boolean
          amount_centimos: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          currency: string
          description: string
          effective_from: string
          effective_to: string | null
          excluded_services: Json
          id: string
          included_services: Json
          policy_version: string
          product_code: string
          service_window_days: number
          tax_included: boolean
          tax_rate_bps: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          amount_centimos: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          currency?: string
          description?: string
          effective_from?: string
          effective_to?: string | null
          excluded_services?: Json
          id?: string
          included_services?: Json
          policy_version?: string
          product_code: string
          service_window_days?: number
          tax_included?: boolean
          tax_rate_bps?: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          amount_centimos?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          currency?: string
          description?: string
          effective_from?: string
          effective_to?: string | null
          excluded_services?: Json
          id?: string
          included_services?: Json
          policy_version?: string
          product_code?: string
          service_window_days?: number
          tax_included?: boolean
          tax_rate_bps?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accreditation_number: string | null
          approved_at: string | null
          approved_by: string | null
          company_name: string | null
          created_at: string | null
          department: string | null
          dni: string | null
          email: string
          full_name: string
          id: string
          license_number: string | null
          phone: string | null
          province: string | null
          role: string
          ruc: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          accreditation_number?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          created_at?: string | null
          department?: string | null
          dni?: string | null
          email: string
          full_name: string
          id: string
          license_number?: string | null
          phone?: string | null
          province?: string | null
          role: string
          ruc?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          accreditation_number?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_name?: string | null
          created_at?: string | null
          department?: string | null
          dni?: string | null
          email?: string
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          province?: string | null
          role?: string
          ruc?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_authority_checks: {
        Row: {
          checked_at: string
          checked_by: string
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          owner_names: string[]
          packet_id: string
          provider: string
          query_reference: string | null
          registry_office: string | null
          registry_zone: string | null
          source_url: string | null
          title_number: string
          verification_status: string
        }
        Insert: {
          checked_at: string
          checked_by: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          owner_names?: string[]
          packet_id: string
          provider?: string
          query_reference?: string | null
          registry_office?: string | null
          registry_zone?: string | null
          source_url?: string | null
          title_number: string
          verification_status: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          owner_names?: string[]
          packet_id?: string
          provider?: string
          query_reference?: string | null
          registry_office?: string | null
          registry_zone?: string | null
          source_url?: string | null
          title_number?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_authority_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_authority_checks_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_entries: {
        Row: {
          certified_at: string | null
          created_at: string | null
          district: string | null
          id: string
          landlord_dni: string
          lease_end_date: string
          lease_start_date: string
          packet_id: string
          property_address: string
          property_unit: string | null
          province: string | null
          renter_dni: string
          status: string
        }
        Insert: {
          certified_at?: string | null
          created_at?: string | null
          district?: string | null
          id?: string
          landlord_dni: string
          lease_end_date: string
          lease_start_date: string
          packet_id: string
          property_address: string
          property_unit?: string | null
          province?: string | null
          renter_dni: string
          status?: string
        }
        Update: {
          certified_at?: string | null
          created_at?: string | null
          district?: string | null
          id?: string
          landlord_dni?: string
          lease_end_date?: string
          lease_start_date?: string
          packet_id?: string
          property_address?: string
          property_unit?: string | null
          province?: string | null
          renter_dni?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_entries_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_records: {
        Row: {
          certificate_issuer: string | null
          certificate_serial: string | null
          certificate_subject: string | null
          certificate_valid_from: string | null
          certificate_valid_to: string | null
          chain_validation_result: string | null
          created_at: string | null
          id: string
          packet_signer_id: string
          pdf_integrity_valid: boolean | null
          provider_document_token: string | null
          provider_name: string | null
          provider_signed_at: string | null
          provider_signer_token: string | null
          raw_validation_data: Json | null
          revocation_result: string | null
          signature_valid: boolean | null
          signed_document_hash: string | null
          timestamp_result: string | null
          verification_url: string | null
        }
        Insert: {
          certificate_issuer?: string | null
          certificate_serial?: string | null
          certificate_subject?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          chain_validation_result?: string | null
          created_at?: string | null
          id?: string
          packet_signer_id: string
          pdf_integrity_valid?: boolean | null
          provider_document_token?: string | null
          provider_name?: string | null
          provider_signed_at?: string | null
          provider_signer_token?: string | null
          raw_validation_data?: Json | null
          revocation_result?: string | null
          signature_valid?: boolean | null
          signed_document_hash?: string | null
          timestamp_result?: string | null
          verification_url?: string | null
        }
        Update: {
          certificate_issuer?: string | null
          certificate_serial?: string | null
          certificate_subject?: string | null
          certificate_valid_from?: string | null
          certificate_valid_to?: string | null
          chain_validation_result?: string | null
          created_at?: string | null
          id?: string
          packet_signer_id?: string
          pdf_integrity_valid?: boolean | null
          provider_document_token?: string | null
          provider_name?: string | null
          provider_signed_at?: string | null
          provider_signer_token?: string | null
          raw_validation_data?: Json | null
          revocation_result?: string | null
          signature_valid?: boolean | null
          signed_document_hash?: string | null
          timestamp_result?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_records_packet_signer_id_fkey"
            columns: ["packet_signer_id"]
            isOneToOne: false
            referencedRelation: "packet_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signer_evidence: {
        Row: {
          created_at: string | null
          evidence_type: string
          id: string
          metadata: Json | null
          packet_signer_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string | null
          evidence_type: string
          id?: string
          metadata?: Json | null
          packet_signer_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string | null
          evidence_type?: string
          id?: string
          metadata?: Json | null
          packet_signer_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signer_evidence_packet_signer_id_fkey"
            columns: ["packet_signer_id"]
            isOneToOne: false
            referencedRelation: "packet_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_tokens: {
        Row: {
          auth_user_id: string | null
          consumed_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          otp_verified_at: string | null
          packet_id: string
          role_in_lease: string
          signer_dni: string
          signer_email: string
          signer_full_name: string
          signer_whatsapp: string
          status: string
          token_hash: string
        }
        Insert: {
          auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_verified_at?: string | null
          packet_id: string
          role_in_lease: string
          signer_dni: string
          signer_email: string
          signer_full_name: string
          signer_whatsapp: string
          status?: string
          token_hash: string
        }
        Update: {
          auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_verified_at?: string | null
          packet_id?: string
          role_in_lease?: string
          signer_dni?: string
          signer_email?: string
          signer_full_name?: string
          signer_whatsapp?: string
          status?: string
          token_hash?: string
        }
        Relationships: []
      }
    }
    Views: {
      packet_financial_summary: {
        Row: {
          adjusted_net_revenue_centimos: number | null
          archived_at: string | null
          direct_cost_centimos: number | null
          gross_collected_centimos: number | null
          included_igv_centimos: number | null
          missing_cost_categories: string[] | null
          notary_igv_centimos: number | null
          packet_id: string | null
          payment_id: string | null
          platform_contribution_margin_centimos: number | null
          policy_version: string | null
          processing_fee_centimos: number | null
          processing_fee_missing: boolean | null
          promo_discount_centimos: number | null
          recognized_at: string | null
          recorded_cost_categories: string[] | null
          service_window_ends_at: string | null
          standard_gross_centimos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_lease_upload_cleanup: {
        Args: { p_limit?: number }
        Returns: {
          claim_token: string
          packet_id: string
          storage_path: string
        }[]
      }
      complete_lease_upload_cleanup: {
        Args: { p_claim_token: string; p_packet_id: string }
        Returns: boolean
      }
      finalize_lease_packet: {
        Args: {
          p_department: string
          p_deposit_amount: number
          p_district: string
          p_lease_end: string
          p_lease_start: string
          p_packet_id: string
          p_property_address: string
          p_property_unit: string
          p_province: string
          p_rental_amount: number
          p_signers: Json
        }
        Returns: Json
      }
      mark_lease_packet_uploaded: {
        Args: {
          p_actor_id: string
          p_document_hash: string
          p_packet_id: string
        }
        Returns: {
          creation_state: string
          packet_id: string
        }[]
      }
      reserve_lease_packet_upload: {
        Args: { p_document_hash: string; p_packet_id: string }
        Returns: {
          creation_state: string
          document_hash: string
          packet_id: string
          upload_reservation_expires_at: string
        }[]
      }
      approve_notary_monthly_payout: {
        Args: {
          p_notary_comprobante_reference: string
          p_notary_igv_centimos?: number
          p_notes?: string
          p_payout_id: string
        }
        Returns: undefined
      }
      claim_commercial_payment_attempt: {
        Args: {
          p_comprobante_type: string
          p_idempotency_key: string
          p_packet_id: string
          p_payment_provider: string
          p_promo_code_hash?: string
          p_purchaser_address?: Json
          p_purchaser_num_doc: string
          p_purchaser_razon_social: string
          p_purchaser_tipo_doc: string
          p_realtor_id: string
        }
        Returns: Json
      }
      claim_policy_payment_refund: {
        Args: {
          p_amount_centimos: number
          p_approval_evidence: string
          p_idempotency_key: string
          p_payment_id: string
          p_policy_reason: string
          p_reason_code: string
          p_reason_description: string
          p_request_id: string
          p_requested_by: string
        }
        Returns: Json
      }
      create_private_promo_code: {
        Args: {
          p_bound_realtor_id?: string
          p_code_hash: string
          p_code_hint: string
          p_description: string
          p_discount_centimos: number
          p_max_redemptions?: number
          p_valid_until: string
        }
        Returns: Json
      }
      prepare_notary_monthly_payout_v2: {
        Args: { p_notary_id: string; p_notes?: string; p_period_month: string }
        Returns: Json
      }
      preview_private_promo: {
        Args: { p_code_hash: string; p_realtor_id: string }
        Returns: Json
      }
      process_commercial_payment_success: {
        Args: {
          p_actor_id: string
          p_payment_id: string
          p_payment_method: string
          p_payment_provider: string
          p_processing_fee_centimos?: number
          p_provider_amount_centimos: number
          p_provider_currency: string
          p_provider_payment_id: string
        }
        Returns: Json
      }
      record_packet_direct_cost: {
        Args: {
          p_allocation_method: string | null
          p_amount_centimos: number
          p_category: string
          p_cost_status: string
          p_evidence_reference: string
          p_packet_id: string
          p_payment_id: string | null
          p_provider: string
          p_source_id: string
        }
        Returns: string
      }
      schedule_commercial_lifecycle: { Args: never; Returns: Json }
      set_notary_percentage_terms: {
        Args: {
          p_contract_reference?: string
          p_effective_from: string
          p_notary_id: string
          p_participation_percent: number
          p_protect_promos?: boolean
        }
        Returns: string
      }
      set_packet_archival_hold: {
        Args: { p_hold_until: string; p_packet_id: string; p_reason: string }
        Returns: undefined
      }
      advance_signer_status: {
        Args: {
          p_new_status: string
          p_profile_id?: string
          p_signer_id: string
        }
        Returns: undefined
      }
      allocate_cpe_correlativo: {
        Args: { p_serie: string; p_series_type?: string }
        Returns: string
      }
      approve_evidence_for_seal: {
        Args: { p_actor_id: string; p_packet_id: string }
        Returns: undefined
      }
      check_duplicate_lease: {
        Args: {
          p_lease_end: string
          p_lease_start: string
          p_property_address: string
          p_property_unit: string
        }
        Returns: {
          earliest_start: string
          latest_end: string
          overlap_count: number
        }[]
      }
      claim_cpe_operation: {
        Args: {
          p_claim_token: string
          p_invoice_id: string
          p_operation: string
          p_stale_seconds?: number
        }
        Returns: Json
      }
      claim_notary_workflow_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          certification_id: string
          claim_token: string
          id: string
          job_type: string
          packet_id: string
          payload: Json
        }[]
      }
      claim_notification_outbox: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          claim_token: string
          event_type: string
          id: string
          packet_id: string
          payload: Json
          recipient_key: string
        }[]
      }
      claim_or_create_credit_note: {
        Args: {
          p_claim_token: string
          p_cn_boleta_serie?: string
          p_cn_factura_serie?: string
          p_refund_id: string
          p_stale_seconds?: number
        }
        Returns: Json
      }
      claim_or_create_primary_cpe: {
        Args: {
          p_boleta_serie?: string
          p_claim_token: string
          p_factura_serie?: string
          p_payment_id: string
          p_stale_seconds?: number
        }
        Returns: Json
      }
      claim_payment_attempt: {
        Args: {
          p_amount_centimos: number
          p_comprobante_type?: string
          p_currency: string
          p_idempotency_key: string
          p_packet_id: string
          p_payment_provider: string
          p_purchaser_address?: Json
          p_purchaser_num_doc?: string
          p_purchaser_razon_social?: string
          p_purchaser_tipo_doc?: string
          p_realtor_id: string
        }
        Returns: Database["public"]["CompositeTypes"]["claim_attempt_result"]
        SetofOptions: {
          from: "*"
          to: "claim_attempt_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_payment_refund: {
        Args: {
          p_amount_centimos: number
          p_idempotency_key: string
          p_payment_id: string
          p_reason_code: string
          p_reason_description: string
          p_request_id: string
          p_requested_by: string
        }
        Returns: Json
      }
      claim_signing_token: {
        Args: { p_token_hash: string }
        Returns: {
          id: string
          packet_id: string
          role_in_lease: string
          signer_dni: string
          signer_email: string
          signer_full_name: string
          signer_whatsapp: string
        }[]
      }
      claim_webhook_for_retry: {
        Args: { p_log_id: string; p_stale_threshold_seconds?: number }
        Returns: boolean
      }
      claim_webhook_processing: {
        Args: {
          p_event_type: string
          p_object_id: string
          p_payload_hash: string
          p_provider: string
          p_raw_payload: Json
          p_stale_threshold_seconds?: number
        }
        Returns: Database["public"]["CompositeTypes"]["webhook_claim_result"]
        SetofOptions: {
          from: "*"
          to: "webhook_claim_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_cpe_artifacts: {
        Args: {
          p_cdr_storage_path?: string
          p_claim_token: string
          p_invoice_id: string
          p_pdf_storage_path: string
          p_xml_storage_path?: string
        }
        Returns: boolean
      }
      complete_cpe_preparation: {
        Args: {
          p_claim_token: string
          p_igv_centimos: number
          p_invoice_id: string
          p_request_payload: Json
          p_subtotal_centimos: number
          p_total_centimos: number
        }
        Returns: boolean
      }
      complete_payment_refund: {
        Args: {
          p_provider_amount_centimos: number
          p_provider_refund_id: string
          p_provider_response: Json
          p_refund_id: string
        }
        Returns: Json
      }
      confirm_notary_monthly_payout: {
        Args: { p_notary_id: string; p_notes?: string; p_period_month: string }
        Returns: Json
      }
      escalate_cpe_manual_review: {
        Args: { p_error_detail?: string; p_invoice_id: string }
        Returns: boolean
      }
      expire_signing_tokens: { Args: never; Returns: number }
      finalize_legacy_certification_job: {
        Args: {
          p_certification_id: string
          p_claim_token: string
          p_job_id: string
        }
        Returns: Json
      }
      finalize_notarized_certification: {
        Args: {
          p_certification_id: string
          p_notary_id: string
          p_packet_id: string
        }
        Returns: Json
      }
      is_active_admin: { Args: never; Returns: boolean }
      is_active_notary: { Args: { p_user_id: string }; Returns: boolean }
      is_active_realtor: { Args: never; Returns: boolean }
      lookup_signing_context: {
        Args: { p_token_hash: string }
        Returns: {
          expires_at: string
          packet_id: string
          role_in_lease: string
          signer_email: string
          signer_full_name: string
          token_id: string
          token_status: string
        }[]
      }
      mark_notary_payout_paid: {
        Args: {
          p_notes?: string
          p_payment_reference: string
          p_payout_id: string
        }
        Returns: undefined
      }
      my_packet_signer_ids: { Args: never; Returns: string[] }
      packets_as_notary: { Args: never; Returns: string[] }
      packets_as_realtor: { Args: never; Returns: string[] }
      packets_as_signer: { Args: never; Returns: string[] }
      participant_can_see_document: {
        Args: {
          p_doc_row: Database["public"]["Tables"]["packet_documents"]["Row"]
        }
        Returns: boolean
      }
      prepare_notarized_certification: {
        Args: {
          p_notarial_scan_document_id: string
          p_notary_id: string
          p_observations?: string
          p_packet_id: string
        }
        Returns: Json
      }
      process_payment_success: {
        Args: {
          p_actor_id: string
          p_payment_id: string
          p_payment_method: string
          p_payment_provider: string
          p_provider_amount_centimos: number
          p_provider_currency: string
          p_provider_payment_id: string
        }
        Returns: Database["public"]["CompositeTypes"]["payment_success_result"]
        SetofOptions: {
          from: "*"
          to: "payment_success_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_cpe_accepted: {
        Args: {
          p_cdr_zip_base64?: string
          p_claim_token: string
          p_document_hash?: string
          p_invoice_id: string
          p_provider_response: Json
          p_signed_xml?: string
          p_sunat_cdr_description?: string
          p_sunat_cdr_notes?: string[]
          p_sunat_response_code?: string
        }
        Returns: boolean
      }
      record_cpe_ambiguous: {
        Args: {
          p_claim_token: string
          p_error_detail?: string
          p_invoice_id: string
        }
        Returns: boolean
      }
      record_cpe_operation_error: {
        Args: {
          p_claim_token: string
          p_error_code?: string
          p_error_detail?: string
          p_invoice_id: string
          p_operation: string
        }
        Returns: boolean
      }
      record_cpe_rejected: {
        Args: {
          p_claim_token: string
          p_invoice_id: string
          p_provider_response: Json
          p_sunat_cdr_description?: string
          p_sunat_cdr_notes?: string[]
          p_sunat_response_code?: string
        }
        Returns: boolean
      }
      record_property_authority_check: {
        Args: {
          p_checked_at: string
          p_metadata?: Json
          p_notes?: string
          p_owner_names?: string[]
          p_packet_id: string
          p_query_reference?: string
          p_registry_office?: string
          p_registry_zone?: string
          p_source_url?: string
          p_title_number: string
          p_verification_status: string
        }
        Returns: string
      }
      record_submission_intent: {
        Args: { p_claim_token: string; p_invoice_id: string }
        Returns: boolean
      }
      replace_packet_document: {
        Args: {
          p_certification_id?: string
          p_document_id?: string
          p_document_type: string
          p_file_hash: string
          p_file_size_bytes?: number
          p_metadata?: Json
          p_original_filename?: string
          p_packet_id: string
          p_page_count?: number
          p_source_document_id?: string
          p_storage_path: string
          p_uploaded_by: string
        }
        Returns: Json
      }
      safe_cast_uuid: { Args: { p_text: string }; Returns: string }
      set_notary_assignment_priority: {
        Args: { p_packet_id: string; p_priority: string; p_reason?: string }
        Returns: undefined
      }
      set_notary_contracted_rate: {
        Args: {
          p_amount: number
          p_contract_reference?: string
          p_effective_from: string
          p_notary_id: string
        }
        Returns: string
      }
      signer_ids_on_notary_packets: { Args: never; Returns: string[] }
      signer_ids_on_own_packets: { Args: never; Returns: string[] }
      start_notary_review:
        | {
            Args: {
              p_actor_id: string
              p_packet_id: string
              p_workflow_version: string
            }
            Returns: undefined
          }
        | {
            Args: { p_packet_id: string; p_workflow_version: string }
            Returns: undefined
          }
      submit_notary_decision: {
        Args: {
          p_correction_scope?: string
          p_decision: string
          p_observations?: string
          p_packet_id: string
        }
        Returns: Json
      }
      transition_packet_status: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_new_status: string
          p_packet_id: string
        }
        Returns: undefined
      }
      update_notary_checklist_item: {
        Args: {
          p_checked: boolean
          p_context?: Json
          p_item_key: string
          p_packet_id: string
        }
        Returns: Json
      }
      user_is_notary_for_signer: {
        Args: { p_signer_id: string }
        Returns: boolean
      }
      user_is_notary_on_packet: {
        Args: { p_packet_id: string }
        Returns: boolean
      }
      user_is_packet_signer: { Args: { p_signer_id: string }; Returns: boolean }
      user_is_signer_on_packet: {
        Args: { p_packet_id: string }
        Returns: boolean
      }
      user_owns_packet: { Args: { p_packet_id: string }; Returns: boolean }
      user_owns_signer_packet: {
        Args: { p_signer_id: string }
        Returns: boolean
      }
      validate_notary_checklist: {
        Args: { p_checklist: Json; p_version: number }
        Returns: undefined
      }
      verify_signing_otp: { Args: { p_token_hash: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      claim_attempt_result: {
        payment_id: string | null
        existing_status: string | null
        amount_centimos: number | null
        currency: string | null
        claimed: boolean | null
      }
      payment_success_result: {
        outcome: string | null
      }
      webhook_claim_result: {
        event_id: string | null
        owned: boolean | null
        already_processed: boolean | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
