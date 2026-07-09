export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          metadata: Json | null
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          metadata?: Json | null
          role: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          metadata?: Json | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_packets: {
        Row: {
          certified_at: string | null
          created_at: string | null
          created_by: string
          department: string | null
          deposit_amount: number | null
          district: string | null
          document_hash: string | null
          id: string
          lease_end_date: string | null
          lease_start_date: string | null
          packet_code: string | null
          parent_packet_id: string | null
          property_address: string | null
          property_unit: string | null
          province: string | null
          rental_amount: number | null
          renewed_by_packet_id: string | null
          status: string
          submitted_to_notary_at: string | null
          updated_at: string | null
        }
        Insert: {
          certified_at?: string | null
          created_at?: string | null
          created_by: string
          department?: string | null
          deposit_amount?: number | null
          district?: string | null
          document_hash?: string | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          packet_code?: string | null
          parent_packet_id?: string | null
          property_address?: string | null
          property_unit?: string | null
          province?: string | null
          rental_amount?: number | null
          renewed_by_packet_id?: string | null
          status?: string
          submitted_to_notary_at?: string | null
          updated_at?: string | null
        }
        Update: {
          certified_at?: string | null
          created_at?: string | null
          created_by?: string
          department?: string | null
          deposit_amount?: number | null
          district?: string | null
          document_hash?: string | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          packet_code?: string | null
          parent_packet_id?: string | null
          property_address?: string | null
          property_unit?: string | null
          province?: string | null
          rental_amount?: number | null
          renewed_by_packet_id?: string | null
          status?: string
          submitted_to_notary_at?: string | null
          updated_at?: string | null
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
          decided_at: string | null
          decision: string | null
          id: string
          notary_id: string
          observations: string | null
          packet_id: string
          review_started_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          decided_at?: string | null
          decision?: string | null
          id?: string
          notary_id: string
          observations?: string | null
          packet_id: string
          review_started_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          decided_at?: string | null
          decision?: string | null
          id?: string
          notary_id?: string
          observations?: string | null
          packet_id?: string
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
        ]
      }
      notary_certifications: {
        Row: {
          certification_type: string
          certified_at: string | null
          checklist_data: Json | null
          id: string
          notary_id: string
          observations: string | null
          packet_id: string
        }
        Insert: {
          certification_type: string
          certified_at?: string | null
          checklist_data?: Json | null
          id?: string
          notary_id: string
          observations?: string | null
          packet_id: string
        }
        Update: {
          certification_type?: string
          certified_at?: string | null
          checklist_data?: Json | null
          id?: string
          notary_id?: string
          observations?: string | null
          packet_id?: string
        }
        Relationships: [
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
      notary_review_checklists: {
        Row: {
          checklist_data: Json
          id: string
          notary_id: string
          packet_id: string
          updated_at: string | null
        }
        Insert: {
          checklist_data?: Json
          id?: string
          notary_id: string
          packet_id: string
          updated_at?: string | null
        }
        Update: {
          checklist_data?: Json
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
          ip_address: string | null
          metadata: Json | null
          packet_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          packet_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
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
          created_at: string | null
          document_type: string
          file_hash: string | null
          id: string
          packet_id: string
          storage_path: string
          uploaded_by: string
          version: number
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_hash?: string | null
          id?: string
          packet_id: string
          storage_path: string
          uploaded_by: string
          version?: number
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_hash?: string | null
          id?: string
          packet_id?: string
          storage_path?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "packet_documents_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "lease_packets"
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
      payment_webhook_events: {
        Row: {
          id: string
          provider: string
          event_type: string
          object_id: string
          payload_hash: string
          raw_payload: Json | null
          processing_result: string
          attempt_count: number
          last_attempt_at: string | null
          received_at: string | null
          processed_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          provider?: string
          event_type: string
          object_id: string
          payload_hash: string
          raw_payload?: Json | null
          processing_result?: string
          attempt_count?: number
          last_attempt_at?: string | null
          received_at?: string | null
          processed_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          provider?: string
          event_type?: string
          object_id?: string
          payload_hash?: string
          raw_payload?: Json | null
          processing_result?: string
          attempt_count?: number
          last_attempt_at?: string | null
          received_at?: string | null
          processed_at?: string | null
          error_message?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_centimos: number | null
          challenge_nonce: string | null
          created_at: string | null
          currency: string
          device_finger_print_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          packet_id: string
          paid_at: string | null
          payment_confirmation_attempts: number
          payment_confirmation_claimed_at: string | null
          payment_confirmation_error: string | null
          payment_confirmation_sent_at: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_provider_ref: string | null
          realtor_id: string
          source_token_hash: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_centimos?: number | null
          challenge_nonce?: string | null
          created_at?: string | null
          currency?: string
          device_finger_print_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          packet_id: string
          paid_at?: string | null
          payment_confirmation_attempts?: number
          payment_confirmation_claimed_at?: string | null
          payment_confirmation_error?: string | null
          payment_confirmation_sent_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_provider_ref?: string | null
          realtor_id: string
          source_token_hash?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_centimos?: number | null
          challenge_nonce?: string | null
          created_at?: string | null
          currency?: string
          device_finger_print_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          packet_id?: string
          paid_at?: string | null
          payment_confirmation_attempts?: number
          payment_confirmation_claimed_at?: string | null
          payment_confirmation_error?: string | null
          payment_confirmation_sent_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_provider_ref?: string | null
          realtor_id?: string
          source_token_hash?: string | null
          status?: string
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
          id: string
          product_code: string
          amount_centimos: number
          currency: string
          description: string
          active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_code: string
          amount_centimos: number
          currency?: string
          description?: string
          active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_code?: string
          amount_centimos?: number
          currency?: string
          description?: string
          active?: boolean
          created_at?: string | null
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
          invited_by: string | null
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
          invited_by?: string | null
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
          invited_by?: string | null
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
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          raw_validation_data: Json | null
          revocation_result: string | null
          signature_valid: boolean | null
          signed_document_hash: string | null
          timestamp_result: string | null
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
          raw_validation_data?: Json | null
          revocation_result?: string | null
          signature_valid?: boolean | null
          signed_document_hash?: string | null
          timestamp_result?: string | null
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
          raw_validation_data?: Json | null
          revocation_result?: string | null
          signature_valid?: boolean | null
          signed_document_hash?: string | null
          timestamp_result?: string | null
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
      [_ in never]: never
    }
    Functions: {
      advance_signer_status: {
        Args: {
          p_signer_id: string
          p_new_status: string
          p_profile_id?: string | null
        }
        Returns: undefined
      }
      claim_charging: {
        Args: {
          p_payment_id: string
          p_realtor_id: string
          p_from_status: string
          p_device_finger_print_id?: string | null
          p_source_token_hash?: string | null
        }
        Returns: {
          payment_id: string | null
          packet_id: string | null
          amount_centimos: number | null
          currency: string | null
          device_finger_print_id: string | null
          source_token_hash: string | null
          challenge_nonce: string | null
        }
      }
      claim_payment_attempt: {
        Args: {
          p_packet_id: string
          p_realtor_id: string
          p_amount_centimos: number
          p_currency: string
          p_idempotency_key: string
          p_challenge_nonce: string
        }
        Returns: {
          payment_id: string | null
          existing_status: string | null
          amount_centimos: number | null
          currency: string | null
          challenge_nonce: string | null
          claimed: boolean | null
        }
      }
      claim_webhook_processing: {
        Args: {
          p_provider: string
          p_event_type: string
          p_object_id: string
          p_payload_hash: string
          p_raw_payload: Json
          p_stale_threshold_seconds?: number
        }
        Returns: {
          event_id: string | null
          owned: boolean | null
          already_processed: boolean | null
        }
      }
      check_duplicate_lease: {
        Args: {
          p_property_address: string
          p_property_unit: string | null
          p_lease_start: string
          p_lease_end: string
        }
        Returns: {
          overlap_count: number
          earliest_start: string | null
          latest_end: string | null
        }[]
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
      complete_notary_decision: {
        Args: {
          p_packet_id: string
          p_notary_id: string
          p_decision: string
          p_observations?: string | null
          p_checklist_data?: Json
        }
        Returns: undefined
      }
      expire_signing_tokens: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      generate_packet_code: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_active_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_active_realtor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      lookup_invitation: {
        Args: { p_token: string }
        Returns: {
          id: string
          email: string
          role: string
          status: string
          expires_at: string
          invited_by: string
        }[]
      }
      process_payment_success: {
        Args: {
          p_payment_id: string
          p_charge_id: string
          p_charge_amount_centimos: number
          p_charge_currency: string
          p_payment_method: string
          p_actor_id: string | null
        }
        Returns: {
          outcome: string | null
        }
      }
      lookup_signing_context: {
        Args: { p_token_hash: string }
        Returns: {
          token_id: string
          packet_id: string
          signer_email: string
          signer_full_name: string
          role_in_lease: string
          token_status: string
          expires_at: string
        }[]
      }
      set_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      transition_packet_status: {
        Args: {
          p_packet_id: string
          p_new_status: string
          p_actor_id: string
          p_action: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      verify_signing_otp: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
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
        challenge_nonce: string | null
        claimed: boolean | null
      }
      claim_charging_result: {
        payment_id: string | null
        packet_id: string | null
        amount_centimos: number | null
        currency: string | null
        device_finger_print_id: string | null
        source_token_hash: string | null
        challenge_nonce: string | null
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
