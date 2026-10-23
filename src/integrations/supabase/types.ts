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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      action_events: {
        Row: {
          action_id: string
          actor_id: string | null
          at: string
          case_id: string
          id: string
          kind: string
          note: string | null
        }
        Insert: {
          action_id: string
          actor_id?: string | null
          at?: string
          case_id: string
          id?: string
          kind: string
          note?: string | null
        }
        Update: {
          action_id?: string
          actor_id?: string | null
          at?: string
          case_id?: string
          id?: string
          kind?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          cancel_reason: string | null
          case_id: string
          completed_on: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          due_confirmed: boolean
          due_date: string | null
          id: string
          instruction: string | null
          outcome: string | null
          owner: string
          reported_at: string | null
          requests_document: boolean
          source: Database["public"]["Enums"]["provenance"]
          status: Database["public"]["Enums"]["action_status"]
          title: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          cancel_reason?: string | null
          case_id: string
          completed_on?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_confirmed?: boolean
          due_date?: string | null
          id?: string
          instruction?: string | null
          outcome?: string | null
          owner?: string
          reported_at?: string | null
          requests_document?: boolean
          source?: Database["public"]["Enums"]["provenance"]
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          cancel_reason?: string | null
          case_id?: string
          completed_on?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_confirmed?: boolean
          due_date?: string | null
          id?: string
          instruction?: string | null
          outcome?: string | null
          owner?: string
          reported_at?: string | null
          requests_document?: boolean
          source?: Database["public"]["Enums"]["provenance"]
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_demo_fixtures: {
        Row: {
          applicant_user_id: string
          case_id: string
          created_at: string
          details: Json
          id: string
          kind: string
          occurred_on: string | null
          title: string
        }
        Insert: {
          applicant_user_id: string
          case_id: string
          created_at?: string
          details?: Json
          id: string
          kind: string
          occurred_on?: string | null
          title: string
        }
        Update: {
          applicant_user_id?: string
          case_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          occurred_on?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_demo_fixtures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_responses: {
        Row: {
          actor_id: string | null
          actor_role: string
          appointment_id: string
          case_id: string
          created_at: string
          id: string
          kind: string
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role: string
          appointment_id: string
          case_id: string
          created_at?: string
          id?: string
          kind: string
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          appointment_id?: string
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          acknowledged_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          case_id: string
          change_request: string | null
          checklist: Json
          confirmed: boolean
          created_at: string
          document_ids: string[]
          id: string
          location: string | null
          recap: string | null
          recap_reviewed_at: string | null
          recap_reviewed_by: string | null
          recorded_by: string | null
          remote_link: string | null
          starts_at: string | null
          status: string
          support_user_id: string | null
          timezone: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          case_id: string
          change_request?: string | null
          checklist?: Json
          confirmed?: boolean
          created_at?: string
          document_ids?: string[]
          id?: string
          location?: string | null
          recap?: string | null
          recap_reviewed_at?: string | null
          recap_reviewed_by?: string | null
          recorded_by?: string | null
          remote_link?: string | null
          starts_at?: string | null
          status?: string
          support_user_id?: string | null
          timezone?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          case_id?: string
          change_request?: string | null
          checklist?: Json
          confirmed?: boolean
          created_at?: string
          document_ids?: string[]
          id?: string
          location?: string | null
          recap?: string | null
          recap_reviewed_at?: string | null
          recap_reviewed_by?: string | null
          recorded_by?: string | null
          remote_link?: string | null
          starts_at?: string | null
          status?: string
          support_user_id?: string | null
          timezone?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessed_at: string
          baseline_seconds: number | null
          cohort: string | null
          correct_action: boolean | null
          correct_source: boolean | null
          external_ref: string | null
          followup_seconds: number | null
          id: string
          is_demo: boolean
          kind: string
          org_id: string
          outcome: string | null
          paired: boolean
          pseudo_user: string
          recorded_by: string | null
        }
        Insert: {
          assessed_at?: string
          baseline_seconds?: number | null
          cohort?: string | null
          correct_action?: boolean | null
          correct_source?: boolean | null
          external_ref?: string | null
          followup_seconds?: number | null
          id?: string
          is_demo?: boolean
          kind: string
          org_id: string
          outcome?: string | null
          paired?: boolean
          pseudo_user: string
          recorded_by?: string | null
        }
        Update: {
          assessed_at?: string
          baseline_seconds?: number | null
          cohort?: string | null
          correct_action?: boolean | null
          correct_source?: boolean | null
          external_ref?: string | null
          followup_seconds?: number | null
          id?: string
          is_demo?: boolean
          kind?: string
          org_id?: string
          outcome?: string | null
          paired?: boolean
          pseudo_user?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          case_id: string | null
          id: number
          org_id: string | null
          record_id: string | null
          record_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          case_id?: string | null
          id?: number
          org_id?: string | null
          record_id?: string | null
          record_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          case_id?: string | null
          id?: number
          org_id?: string | null
          record_id?: string | null
          record_type?: string
        }
        Relationships: []
      }
      bootstrap_codes: {
        Row: {
          code_hash: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code_hash: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      case_grants: {
        Row: {
          can_view_documents: boolean
          can_view_internal: boolean
          case_id: string
          created_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          can_view_documents?: boolean
          can_view_internal?: boolean
          case_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          can_view_documents?: boolean
          can_view_internal?: boolean
          case_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_grants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_status_history: {
        Row: {
          author_id: string | null
          case_id: string
          correction_note: string | null
          correction_requested: boolean
          correction_requested_at: string | null
          decision_ref: string | null
          explanation: string
          id: string
          is_demo: boolean
          previous_status: string | null
          recorded_at: string
          source: Database["public"]["Enums"]["provenance"]
          status: string
        }
        Insert: {
          author_id?: string | null
          case_id: string
          correction_note?: string | null
          correction_requested?: boolean
          correction_requested_at?: string | null
          decision_ref?: string | null
          explanation: string
          id?: string
          is_demo?: boolean
          previous_status?: string | null
          recorded_at?: string
          source: Database["public"]["Enums"]["provenance"]
          status: string
        }
        Update: {
          author_id?: string | null
          case_id?: string
          correction_note?: string | null
          correction_requested?: boolean
          correction_requested_at?: string | null
          decision_ref?: string | null
          explanation?: string
          id?: string
          is_demo?: boolean
          previous_status?: string | null
          recorded_at?: string
          source?: Database["public"]["Enums"]["provenance"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          applicant_user_id: string | null
          cohort_ref: string | null
          created_at: string
          display_label: string
          id: string
          is_demo: boolean
          needs_language_assistance: boolean
          org_id: string
          preferred_language: string | null
          procedure_path: string | null
          rollout_wave: string | null
          stage: string | null
          stage_recorded_at: string | null
          stage_source: Database["public"]["Enums"]["provenance"] | null
          workspace_ref: string | null
        }
        Insert: {
          applicant_user_id?: string | null
          cohort_ref?: string | null
          created_at?: string
          display_label: string
          id?: string
          is_demo?: boolean
          needs_language_assistance?: boolean
          org_id: string
          preferred_language?: string | null
          procedure_path?: string | null
          rollout_wave?: string | null
          stage?: string | null
          stage_recorded_at?: string | null
          stage_source?: Database["public"]["Enums"]["provenance"] | null
          workspace_ref?: string | null
        }
        Update: {
          applicant_user_id?: string | null
          cohort_ref?: string | null
          created_at?: string
          display_label?: string
          id?: string
          is_demo?: boolean
          needs_language_assistance?: boolean
          org_id?: string
          preferred_language?: string | null
          procedure_path?: string | null
          rollout_wave?: string | null
          stage?: string | null
          stage_recorded_at?: string | null
          stage_source?: Database["public"]["Enums"]["provenance"] | null
          workspace_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_documents: {
        Row: {
          purpose: string
          required: boolean
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          purpose: string
          required: boolean
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          purpose?: string
          required?: boolean
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          choice: boolean
          id: string
          purpose: string
          recorded_at: string
          user_id: string
          version: string
        }
        Insert: {
          choice: boolean
          id?: string
          purpose: string
          recorded_at?: string
          user_id: string
          version: string
        }
        Update: {
          choice?: boolean
          id?: string
          purpose?: string
          recorded_at?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_purpose_fkey"
            columns: ["purpose"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["purpose"]
          },
        ]
      }
      correspondence: {
        Row: {
          case_id: string
          created_at: string
          id: string
          kind: string
          occurred_on: string | null
          recorded_by: string | null
          summary: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          kind: string
          occurred_on?: string | null
          recorded_by?: string | null
          summary: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
          occurred_on?: string | null
          recorded_by?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          case_id: string
          created_at: string
          id: string
          kind: string
          notes: string | null
          requested_by: string | null
          review_notes: string | null
          status: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          requested_by?: string | null
          review_notes?: string | null
          status?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          requested_by?: string | null
          review_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          action_id: string | null
          case_id: string
          created_at: string
          doc_type: string
          expiry_date: string | null
          id: string
          is_sample: boolean
          mime: string
          removal_requested: boolean
          review_state: Database["public"]["Enums"]["review_state"]
          safe_name: string
          size_bytes: number
          source: Database["public"]["Enums"]["provenance"]
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          action_id?: string | null
          case_id: string
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          id?: string
          is_sample?: boolean
          mime: string
          removal_requested?: boolean
          review_state?: Database["public"]["Enums"]["review_state"]
          safe_name: string
          size_bytes: number
          source?: Database["public"]["Enums"]["provenance"]
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          action_id?: string | null
          case_id?: string
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          id?: string
          is_sample?: boolean
          mime?: string
          removal_requested?: boolean
          review_state?: Database["public"]["Enums"]["review_state"]
          safe_name?: string
          size_bytes?: number
          source?: Database["public"]["Enums"]["provenance"]
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_action_fk"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          case_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          owner_id: string | null
          responded_at: string | null
          response: string | null
          status: Database["public"]["Enums"]["help_status"]
        }
        Insert: {
          case_id: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          owner_id?: string | null
          responded_at?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["help_status"]
        }
        Update: {
          case_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          owner_id?: string | null
          responded_at?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["help_status"]
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_id: string | null
          body: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          case_id: string | null
          case_ids: string[]
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          last_error: string | null
          org_id: string
          role: Database["public"]["Enums"]["invite_role"]
          send_count: number
          send_status: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          case_id?: string | null
          case_ids?: string[]
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          last_error?: string | null
          org_id: string
          role: Database["public"]["Enums"]["invite_role"]
          send_count?: number
          send_status?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          case_id?: string | null
          case_ids?: string[]
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["invite_role"]
          send_count?: number
          send_status?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_events: {
        Row: {
          channel: string | null
          cohort: string | null
          dedupe_key: string | null
          device: string | null
          event: string
          id: number
          is_demo: boolean
          object_id: string | null
          occurred_at: string
          org_id: string | null
          outcome: string | null
          pseudo_user: string
          role: string | null
          session_id: string | null
        }
        Insert: {
          channel?: string | null
          cohort?: string | null
          dedupe_key?: string | null
          device?: string | null
          event: string
          id?: number
          is_demo?: boolean
          object_id?: string | null
          occurred_at?: string
          org_id?: string | null
          outcome?: string | null
          pseudo_user: string
          role?: string | null
          session_id?: string | null
        }
        Update: {
          channel?: string | null
          cohort?: string | null
          dedupe_key?: string | null
          device?: string | null
          event?: string
          id?: number
          is_demo?: boolean
          object_id?: string | null
          occurred_at?: string
          org_id?: string | null
          outcome?: string | null
          pseudo_user?: string
          role?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message_key: string
          outbox_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message_key?: string
          outbox_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message_key?: string
          outbox_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email_notifications: boolean
          id: string
          needs_language_assistance: boolean
          policy_ack_at: string | null
          policy_version: string | null
          preferred_language: string | null
          ui_locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id: string
          needs_language_assistance?: boolean
          policy_ack_at?: string | null
          policy_version?: string | null
          preferred_language?: string | null
          ui_locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          needs_language_assistance?: boolean
          policy_ack_at?: string | null
          policy_version?: string | null
          preferred_language?: string | null
          ui_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_outbox: {
        Row: {
          attempts: number
          case_id: string
          channel: string
          cohort_ref: string | null
          created_at: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          last_error: string | null
          opened_at: string | null
          provider_accepted_at: string | null
          send_at: string
          status: Database["public"]["Enums"]["outbox_status"]
          target_id: string
          target_type: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          case_id: string
          channel?: string
          cohort_ref?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          is_demo?: boolean
          last_error?: string | null
          opened_at?: string | null
          provider_accepted_at?: string | null
          send_at: string
          status?: Database["public"]["Enums"]["outbox_status"]
          target_id: string
          target_type: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          case_id?: string
          channel?: string
          cohort_ref?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          is_demo?: boolean
          last_error?: string | null
          opened_at?: string | null
          provider_accepted_at?: string | null
          send_at?: string
          status?: Database["public"]["Enums"]["outbox_status"]
          target_id?: string
          target_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_outbox_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_records: {
        Row: {
          case_id: string
          checklist: Json
          created_at: string
          document_type: string
          expiry_date: string | null
          expiry_reviewed: boolean
          id: string
          instructions: string | null
          prep_start_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          case_id: string
          checklist?: Json
          created_at?: string
          document_type: string
          expiry_date?: string | null
          expiry_reviewed?: boolean
          id?: string
          instructions?: string | null
          prep_start_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          case_id?: string
          checklist?: Json
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          expiry_reviewed?: boolean
          id?: string
          instructions?: string | null
          prep_start_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_records_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          applicability: string | null
          category: string
          created_at: string
          id: string
          last_reviewed_on: string | null
          locale: string
          org_id: string
          publisher: string
          reviewer_name: string | null
          source_url: string | null
          status: string
          summary: string
          title: string
        }
        Insert: {
          applicability?: string | null
          category?: string
          created_at?: string
          id?: string
          last_reviewed_on?: string | null
          locale?: string
          org_id: string
          publisher: string
          reviewer_name?: string | null
          source_url?: string | null
          status?: string
          summary: string
          title: string
        }
        Update: {
          applicability?: string | null
          category?: string
          created_at?: string
          id?: string
          last_reviewed_on?: string | null
          locale?: string
          org_id?: string
          publisher?: string
          reviewer_name?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_contacts: {
        Row: {
          created_at: string
          email: string | null
          hours: string | null
          id: string
          is_external: boolean
          name: string
          org_id: string
          phone: string | null
          role_label: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          hours?: string | null
          id?: string
          is_external?: boolean
          name: string
          org_id: string
          phone?: string | null
          role_label: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          hours?: string | null
          id?: string
          is_external?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          role_label?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "support_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          author_id: string | null
          body: string | null
          case_id: string
          correction_note: string | null
          correction_requested: boolean
          id: string
          linked_document_id: string | null
          recorded_at: string
          review_state: Database["public"]["Enums"]["review_state"]
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["provenance"]
          title: string
          version: number
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          case_id: string
          correction_note?: string | null
          correction_requested?: boolean
          id?: string
          linked_document_id?: string | null
          recorded_at?: string
          review_state?: Database["public"]["Enums"]["review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: Database["public"]["Enums"]["provenance"]
          title: string
          version?: number
        }
        Update: {
          author_id?: string | null
          body?: string | null
          case_id?: string
          correction_note?: string | null
          correction_requested?: boolean
          id?: string
          linked_document_id?: string | null
          recorded_at?: string
          review_state?: Database["public"]["Enums"]["review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["provenance"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_entries_linked_document_id_fkey"
            columns: ["linked_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_revisions: {
        Row: {
          body: string | null
          case_id: string
          changed_at: string
          changed_by: string | null
          entry_id: string
          id: string
          reason: string | null
          review_state: Database["public"]["Enums"]["review_state"]
          source: Database["public"]["Enums"]["provenance"]
          title: string
          version: number
        }
        Insert: {
          body?: string | null
          case_id: string
          changed_at?: string
          changed_by?: string | null
          entry_id: string
          id?: string
          reason?: string | null
          review_state: Database["public"]["Enums"]["review_state"]
          source: Database["public"]["Enums"]["provenance"]
          title: string
          version: number
        }
        Update: {
          body?: string | null
          case_id?: string
          changed_at?: string
          changed_by?: string | null
          entry_id?: string
          id?: string
          reason?: string | null
          review_state?: Database["public"]["Enums"]["review_state"]
          source?: Database["public"]["Enums"]["provenance"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "timeline_revisions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_revisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "timeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _hash: { Args: { _t: string }; Returns: string }
      _uid: { Args: never; Returns: string }
      accept_invitation: { Args: { _token: string }; Returns: Json }
      acknowledge_policy: { Args: { _version: string }; Returns: undefined }
      add_internal_note: {
        Args: { _body: string; _case: string }
        Returns: string
      }
      add_membership_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["org_role"]
          _user: string
        }
        Returns: undefined
      }
      add_timeline_entry: {
        Args: {
          _body: string
          _case: string
          _doc?: string
          _source?: Database["public"]["Enums"]["provenance"]
          _title: string
        }
        Returns: string
      }
      bootstrap_first_admin: {
        Args: { _code: string; _org_name: string }
        Returns: string
      }
      can_access_case: { Args: { _case: string }; Returns: boolean }
      can_case_docs: { Args: { _case: string }; Returns: boolean }
      can_case_internal: { Args: { _case: string }; Returns: boolean }
      cancel_action: {
        Args: { _action: string; _expected_version: number; _reason: string }
        Returns: undefined
      }
      cancel_appointment: {
        Args: { _appt: string; _reason: string }
        Returns: undefined
      }
      case_org: { Args: { _case: string }; Returns: string }
      consent_current: {
        Args: { _purpose: string; _u: string }
        Returns: boolean
      }
      create_action: {
        Args: {
          _case: string
          _doc: string
          _due: string
          _due_confirmed: boolean
          _instruction: string
          _owner: string
          _requests_document: boolean
          _source: Database["public"]["Enums"]["provenance"]
          _title: string
        }
        Returns: string
      }
      create_case: {
        Args: { _label: string; _org: string; _procedure: string }
        Returns: string
      }
      create_data_request: {
        Args: { _kind: string; _notes: string }
        Returns: string
      }
      create_help_request: {
        Args: { _case: string; _category: string; _message: string }
        Returns: string
      }
      create_invitation: {
        Args: {
          _case?: string
          _email: string
          _org: string
          _role: Database["public"]["Enums"]["invite_role"]
        }
        Returns: Json
      }
      create_invitation_v2: {
        Args: {
          _case: string
          _cases: string[]
          _email: string
          _org: string
          _role: Database["public"]["Enums"]["invite_role"]
        }
        Returns: Json
      }
      ensure_profile: { Args: never; Returns: undefined }
      grant_case_access: {
        Args: {
          _case: string
          _docs: boolean
          _internal: boolean
          _user: string
        }
        Returns: string
      }
      has_case_grant: { Args: { _case: string }; Returns: boolean }
      is_applicant_in_org: { Args: { _org: string }; Returns: boolean }
      is_case_admin: { Args: { _case: string }; Returns: boolean }
      is_case_applicant: { Args: { _case: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_staff: { Args: { _org: string }; Returns: boolean }
      latest_case_statuses: {
        Args: { _cases: string[] }
        Returns: {
          case_id: string
          correction_requested: boolean
          recorded_at: string
          status: string
        }[]
      }
      lisbon_9am: { Args: { _d: string }; Returns: string }
      log_event: {
        Args: {
          _device?: string
          _event: string
          _object?: string
          _session?: string
        }
        Returns: undefined
      }
      lookup_invitation: { Args: { _token: string }; Returns: Json }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      mark_notifications_read: { Args: never; Returns: undefined }
      mark_notifications_read_link: {
        Args: { _link: string }
        Returns: undefined
      }
      monitoring_summary: {
        Args: { _cohort?: string; _from: string; _org: string; _to: string }
        Returns: Json
      }
      my_caseload: {
        Args: {
          _filter?: string
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: {
          actions_due: number
          awaiting_review: number
          case_id: string
          expiry: string
          is_demo: boolean
          label: string
          next_due: string
          open_help: number
          overdue: number
          stage: string
          total: number
          workspace_ref: string
        }[]
      }
      my_context: { Args: never; Returns: Json }
      notify_applicant: {
        Args: { _case: string; _key: string; _link: string }
        Returns: undefined
      }
      notify_case_staff: {
        Args: { _case: string; _key: string }
        Returns: undefined
      }
      notify_user: {
        Args: { _key: string; _link: string; _user: string }
        Returns: undefined
      }
      onboarding_complete: { Args: { _u: string }; Returns: boolean }
      process_reminders: { Args: { _limit?: number }; Returns: number }
      pseudo_id: { Args: { _u: string }; Returns: string }
      record_application_status: {
        Args: {
          _case: string
          _decision_ref: string
          _explanation: string
          _source: Database["public"]["Enums"]["provenance"]
          _status: string
        }
        Returns: string
      }
      record_assessment: {
        Args: {
          _baseline: number
          _case: string
          _correct_action: boolean
          _correct_source: boolean
          _followup: number
          _kind: string
          _outcome: string
        }
        Returns: string
      }
      record_consents: { Args: { _choices: Json }; Returns: undefined }
      record_correspondence: {
        Args: {
          _case: string
          _kind: string
          _occurred: string
          _summary: string
        }
        Returns: string
      }
      record_invitation_send: {
        Args: { _err: string; _id: string; _ok: boolean }
        Returns: undefined
      }
      register_document: {
        Args: {
          _action: string
          _case: string
          _doc_type: string
          _expiry: string
          _mime: string
          _safe_name: string
          _size: number
        }
        Returns: Json
      }
      remove_membership: { Args: { _id: string }; Returns: undefined }
      report_action_complete: {
        Args: {
          _action: string
          _completed_on: string
          _doc?: string
          _expected_version: number
          _outcome: string
        }
        Returns: undefined
      }
      report_appointment_change: {
        Args: { _appt: string; _note: string }
        Returns: undefined
      }
      request_correction: {
        Args: { _entry: string; _note: string }
        Returns: undefined
      }
      request_document_removal: { Args: { _doc: string }; Returns: undefined }
      request_status_correction: {
        Args: { _entry: string; _note: string }
        Returns: undefined
      }
      respond_appointment: {
        Args: { _appt: string; _kind: string; _note: string }
        Returns: undefined
      }
      respond_help_request: {
        Args: {
          _id: string
          _response: string
          _status: Database["public"]["Enums"]["help_status"]
        }
        Returns: undefined
      }
      return_action: {
        Args: { _action: string; _expected_version: number; _note: string }
        Returns: undefined
      }
      review_data_request: {
        Args: { _id: string; _notes: string; _status: string }
        Returns: undefined
      }
      review_document: {
        Args: {
          _doc: string
          _expiry: string
          _state: Database["public"]["Enums"]["review_state"]
        }
        Returns: undefined
      }
      review_timeline_entry: {
        Args: {
          _body: string
          _entry: string
          _expected_version: number
          _reason: string
          _source: Database["public"]["Enums"]["provenance"]
          _title: string
        }
        Returns: number
      }
      revoke_case_access: { Args: { _grant: string }; Returns: undefined }
      revoke_invitation: { Args: { _id: string }; Returns: undefined }
      rotate_invitation_token: { Args: { _id: string }; Returns: Json }
      save_recap: {
        Args: { _appt: string; _recap: string }
        Returns: undefined
      }
      schedule_reminder: {
        Args: {
          _case: string
          _key: string
          _send_at: string
          _target: string
          _type: string
        }
        Returns: undefined
      }
      send_case_message: {
        Args: { _body: string; _case: string }
        Returns: string
      }
      set_case_stage: {
        Args: {
          _case: string
          _path: string
          _source: Database["public"]["Enums"]["provenance"]
          _stage: string
        }
        Returns: undefined
      }
      set_resource_category: {
        Args: { _category: string; _id: string }
        Returns: undefined
      }
      toggle_appointment_item: {
        Args: { _appt: string; _done: boolean; _idx: number }
        Returns: undefined
      }
      toggle_renewal_item: {
        Args: { _case: string; _done: boolean; _idx: number }
        Returns: undefined
      }
      update_action_due: {
        Args: {
          _action: string
          _confirmed: boolean
          _due: string
          _expected_version: number
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          _display_name: string
          _email_notifications: boolean
          _needs_assistance: boolean
          _preferred_language: string
          _ui_locale: string
        }
        Returns: undefined
      }
      upsert_appointment: {
        Args: {
          _case: string
          _checklist: Json
          _confirmed: boolean
          _doc_ids: string[]
          _id: string
          _location: string
          _remote_link: string
          _starts_at: string
          _support_user: string
          _title: string
        }
        Returns: string
      }
      upsert_contact: {
        Args: {
          _email: string
          _external: boolean
          _hours: string
          _id: string
          _name: string
          _org: string
          _phone: string
          _role_label: string
          _verified: boolean
        }
        Returns: string
      }
      upsert_renewal: {
        Args: {
          _case: string
          _checklist: Json
          _document_type: string
          _expiry: string
          _expiry_reviewed: boolean
          _instructions: string
          _prep_start: string
        }
        Returns: undefined
      }
      upsert_resource: {
        Args: {
          _applicability: string
          _id: string
          _locale: string
          _org: string
          _publisher: string
          _reviewed: string
          _reviewer: string
          _status: string
          _summary: string
          _title: string
          _url: string
        }
        Returns: string
      }
      verify_action: {
        Args: { _action: string; _expected_version: number; _note?: string }
        Returns: undefined
      }
    }
    Enums: {
      action_status:
        | "pending"
        | "reported_complete"
        | "verified_complete"
        | "cancelled"
      help_status: "open" | "in_progress" | "resolved"
      invite_role: "applicant" | "practitioner" | "admin"
      invite_status: "pending" | "accepted" | "revoked"
      org_role: "admin" | "practitioner"
      outbox_status:
        | "scheduled"
        | "provider_accepted"
        | "delivery_failed"
        | "delivered"
        | "cancelled"
      provenance:
        | "applicant_reported"
        | "practitioner_reviewed"
        | "linked_correspondence"
        | "officially_synchronised"
      review_state: "unreviewed" | "reviewed" | "corrected"
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {
      action_status: [
        "pending",
        "reported_complete",
        "verified_complete",
        "cancelled",
      ],
      help_status: ["open", "in_progress", "resolved"],
      invite_role: ["applicant", "practitioner", "admin"],
      invite_status: ["pending", "accepted", "revoked"],
      org_role: ["admin", "practitioner"],
      outbox_status: [
        "scheduled",
        "provider_accepted",
        "delivery_failed",
        "delivered",
        "cancelled",
      ],
      provenance: [
        "applicant_reported",
        "practitioner_reviewed",
        "linked_correspondence",
        "officially_synchronised",
      ],
      review_state: ["unreviewed", "reviewed", "corrected"],
    },
  },
} as const
