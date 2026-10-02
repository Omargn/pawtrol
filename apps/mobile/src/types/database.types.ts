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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      content_flags: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_flags_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          owner_id: string
          report_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          owner_id: string
          report_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          owner_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pet_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          status: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_status: string
          id: number
          reason: string | null
          target_id: string
          target_type: string
          to_status: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_status: string
          id?: never
          reason?: string | null
          target_id: string
          target_type: string
          to_status: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_status?: string
          id?: never
          reason?: string | null
          target_id?: string
          target_type?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_reports: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          created_by: string
          description: string
          expires_at: string
          id: string
          kind: string
          last_seen_at: string
          location: unknown
          location_public: unknown
          pet_name: string | null
          public_lat: number | null
          public_lng: number | null
          resolved_at: string | null
          sighting_count: number
          size: string | null
          species_id: number
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          created_by: string
          description: string
          expires_at: string
          id?: string
          kind: string
          last_seen_at: string
          location: unknown
          location_public?: unknown
          pet_name?: string | null
          public_lat?: number | null
          public_lng?: number | null
          resolved_at?: string | null
          sighting_count?: number
          size?: string | null
          species_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string
          expires_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          location?: unknown
          location_public?: unknown
          pet_name?: string | null
          public_lat?: number | null
          public_lng?: number | null
          resolved_at?: string | null
          sighting_count?: number
          size?: string | null
          species_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_reports_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          report_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          report_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          report_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pet_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      sightings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          id: string
          location: unknown
          note: string | null
          photo_path: string | null
          public_lat: number | null
          public_lng: number | null
          report_id: string
          seen_at: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          location: unknown
          note?: string | null
          photo_path?: string | null
          public_lat?: number | null
          public_lng?: number | null
          report_id: string
          seen_at: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          location?: unknown
          note?: string | null
          photo_path?: string | null
          public_lat?: number | null
          public_lng?: number | null
          report_id?: string
          seen_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sightings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sightings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pet_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          id: number
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          id: number
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: number
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_sighting: {
        Args: {
          p_client_id: string
          p_lat: number
          p_lng: number
          p_note?: string
          p_photo_path?: string
          p_report_id: string
          p_seen_at: string
        }
        Returns: string
      }
      create_report: {
        Args: {
          p_client_id: string
          p_color?: string
          p_description: string
          p_kind: string
          p_last_seen_at: string
          p_lat: number
          p_lng: number
          p_pet_name?: string
          p_photo_paths?: string[]
          p_size?: string
          p_species_id: number
        }
        Returns: string
      }
      flag_content: {
        Args: {
          p_details?: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      has_role: { Args: { required_role: string }; Returns: boolean }
      mark_reunited: { Args: { p_report_id: string }; Returns: undefined }
      moderate: {
        Args: {
          p_action: string
          p_reason?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      renew_report: { Args: { p_report_id: string }; Returns: string }
      reports_in_bbox: {
        Args: {
          kinds?: string[]
          max_lat: number
          max_lng: number
          max_rows?: number
          min_lat: number
          min_lng: number
          species_ids?: number[]
        }
        Returns: {
          cover_photo: string
          id: string
          kind: string
          last_seen_at: string
          lat: number
          lng: number
          pet_name: string
          sighting_count: number
          species_id: number
        }[]
      }
      reports_near: {
        Args: {
          kinds?: string[]
          max_rows?: number
          origin_lat: number
          origin_lng: number
          radius_m?: number
          species_ids?: number[]
        }
        Returns: {
          cover_photo: string
          distance_m: number
          id: string
          kind: string
          last_seen_at: string
          lat: number
          lng: number
          pet_name: string
          sighting_count: number
          species_id: number
        }[]
      }
      start_conversation: { Args: { p_report_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
