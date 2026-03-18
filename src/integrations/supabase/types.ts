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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      axonometric_gallery: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string
          is_published: boolean
          project_name: string | null
          request_id: string | null
          style_preset: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url: string
          is_published?: boolean
          project_name?: string | null
          request_id?: string | null
          style_preset?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string
          is_published?: boolean
          project_name?: string | null
          request_id?: string | null
          style_preset?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "axonometric_gallery_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "axonometric_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      axonometric_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          image_url: string
          notes: string | null
          project_name: string
          request_type: string
          result_image_url: string | null
          status: Database["public"]["Enums"]["axonometric_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url: string
          notes?: string | null
          project_name?: string
          request_type?: string
          result_image_url?: string | null
          status?: Database["public"]["Enums"]["axonometric_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url?: string
          notes?: string | null
          project_name?: string
          request_type?: string
          result_image_url?: string | null
          status?: Database["public"]["Enums"]["axonometric_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_thumbnails: {
        Row: {
          brand_name: string
          created_at: string
          id: string
          thumbnail_url: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          id?: string
          thumbnail_url: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          id?: string
          thumbnail_url?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      gallery_hotspots: {
        Row: {
          created_at: string
          designer_name: string | null
          dimensions: string | null
          id: string
          image_identifier: string
          link_url: string | null
          materials: string | null
          product_image_url: string | null
          product_name: string
          x_percent: number
          y_percent: number
        }
        Insert: {
          created_at?: string
          designer_name?: string | null
          dimensions?: string | null
          id?: string
          image_identifier: string
          link_url?: string | null
          materials?: string | null
          product_image_url?: string | null
          product_name: string
          x_percent: number
          y_percent: number
        }
        Update: {
          created_at?: string
          designer_name?: string | null
          dimensions?: string | null
          id?: string
          image_identifier?: string
          link_url?: string | null
          materials?: string | null
          product_image_url?: string | null
          product_name?: string
          x_percent?: number
          y_percent?: number
        }
        Relationships: []
      }
      journal_articles: {
        Row: {
          author: string
          category: Database["public"]["Enums"]["journal_category"]
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          gallery_images: string[] | null
          id: string
          is_published: boolean
          pdf_url: string | null
          published_at: string | null
          read_time_minutes: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          category?: Database["public"]["Enums"]["journal_category"]
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          gallery_images?: string[] | null
          id?: string
          is_published?: boolean
          pdf_url?: string | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: Database["public"]["Enums"]["journal_category"]
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          gallery_images?: string[] | null
          id?: string
          is_published?: boolean
          pdf_url?: string | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          phone?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
        }
        Relationships: []
      }
      provenance_certificates: {
        Row: {
          appreciation_notes: string | null
          authenticity_statement: string | null
          certificate_number: string | null
          comparable_references: string | null
          created_at: string
          created_by: string | null
          designer_id: string
          edition_number: string | null
          edition_total: string | null
          estimated_value_range: string | null
          id: string
          is_published: boolean
          piece_title: string
          updated_at: string
          year_created: number | null
        }
        Insert: {
          appreciation_notes?: string | null
          authenticity_statement?: string | null
          certificate_number?: string | null
          comparable_references?: string | null
          created_at?: string
          created_by?: string | null
          designer_id: string
          edition_number?: string | null
          edition_total?: string | null
          estimated_value_range?: string | null
          id?: string
          is_published?: boolean
          piece_title: string
          updated_at?: string
          year_created?: number | null
        }
        Update: {
          appreciation_notes?: string | null
          authenticity_statement?: string | null
          certificate_number?: string | null
          comparable_references?: string | null
          created_at?: string
          created_by?: string | null
          designer_id?: string
          edition_number?: string | null
          edition_total?: string | null
          estimated_value_range?: string | null
          id?: string
          is_published?: boolean
          piece_title?: string
          updated_at?: string
          year_created?: number | null
        }
        Relationships: []
      }
      provenance_events: {
        Row: {
          certificate_id: string
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          sort_order: number
          title: string
        }
        Insert: {
          certificate_id: string
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          location?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          certificate_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "provenance_events_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "provenance_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      room_planner_projects: {
        Row: {
          created_at: string
          id: string
          name: string
          pixels_per_meter: number
          placed_products: Json
          plan_image_url: string | null
          rooms: Json
          updated_at: string
          user_id: string
          wall_height: number
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          pixels_per_meter?: number
          placed_products?: Json
          plan_image_url?: string | null
          rooms?: Json
          updated_at?: string
          user_id: string
          wall_height?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pixels_per_meter?: number
          placed_products?: Json
          plan_image_url?: string | null
          rooms?: Json
          updated_at?: string
          user_id?: string
          wall_height?: number
        }
        Relationships: []
      }
      sample_request_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          request_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          request_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_request_audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "trade_sample_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      section_heroes: {
        Row: {
          created_at: string
          gravity: string
          id: string
          image_url: string
          section_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gravity?: string
          id?: string
          image_url: string
          section_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gravity?: string
          id?: string
          image_url?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trade_applications: {
        Row: {
          certification_details: string | null
          city: string
          company_name: string
          company_website: string | null
          country: string
          created_at: string
          id: string
          is_certified_professional: boolean
          job_title: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["trade_application_status"]
          user_id: string
        }
        Insert: {
          certification_details?: string | null
          city?: string
          company_name: string
          company_website?: string | null
          country?: string
          created_at?: string
          id?: string
          is_certified_professional?: boolean
          job_title?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["trade_application_status"]
          user_id: string
        }
        Update: {
          certification_details?: string | null
          city?: string
          company_name?: string
          company_website?: string | null
          country?: string
          created_at?: string
          id?: string
          is_certified_professional?: boolean
          job_title?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["trade_application_status"]
          user_id?: string
        }
        Relationships: []
      }
      trade_documents: {
        Row: {
          brand_name: string
          cover_image_url: string | null
          created_at: string
          document_type: string
          file_size_bytes: number | null
          file_url: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          brand_name: string
          cover_image_url?: string | null
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          brand_name?: string
          cover_image_url?: string | null
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      trade_products: {
        Row: {
          brand_name: string
          category: string
          created_at: string
          currency: string
          description: string | null
          dimensions: string | null
          gallery_images: string[] | null
          id: string
          image_url: string | null
          is_active: boolean
          lead_time: string | null
          materials: string | null
          product_name: string
          rrp_price_cents: number | null
          sku: string | null
          spec_sheet_url: string | null
          subcategory: string | null
          trade_price_cents: number | null
          updated_at: string
        }
        Insert: {
          brand_name: string
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          dimensions?: string | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time?: string | null
          materials?: string | null
          product_name: string
          rrp_price_cents?: number | null
          sku?: string | null
          spec_sheet_url?: string | null
          subcategory?: string | null
          trade_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          brand_name?: string
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          dimensions?: string | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time?: string | null
          materials?: string | null
          product_name?: string
          rrp_price_cents?: number | null
          sku?: string | null
          spec_sheet_url?: string | null
          subcategory?: string | null
          trade_price_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      trade_quote_items: {
        Row: {
          axonometric_image_url: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quote_id: string
          unit_price_cents: number | null
        }
        Insert: {
          axonometric_image_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          quote_id: string
          unit_price_cents?: number | null
        }
        Update: {
          axonometric_image_url?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          quote_id?: string
          unit_price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quotes: {
        Row: {
          admin_notes: string | null
          client_name: string | null
          confirmed_at: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          responded_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          client_name?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          client_name?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_sample_requests: {
        Row: {
          admin_notes: string | null
          brand_name: string
          client_name: string
          created_at: string
          id: string
          image_url: string | null
          notes: string | null
          product_name: string
          project_name: string
          return_by: string | null
          shipping_address: string
          shipping_city: string
          shipping_country: string
          status: Database["public"]["Enums"]["sample_request_status"]
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          brand_name: string
          client_name?: string
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          product_name: string
          project_name?: string
          return_by?: string | null
          shipping_address?: string
          shipping_city?: string
          shipping_country?: string
          status?: Database["public"]["Enums"]["sample_request_status"]
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          brand_name?: string
          client_name?: string
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          product_name?: string
          project_name?: string
          return_by?: string | null
          shipping_address?: string
          shipping_city?: string
          shipping_country?: string
          status?: Database["public"]["Enums"]["sample_request_status"]
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_gallery_product_to_quote: {
        Args: {
          _brand_name: string
          _category?: string
          _dimensions?: string
          _image_url?: string
          _materials?: string
          _product_name: string
          _quantity?: number
          _quote_id: string
          _user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "trade_user" | "super_admin"
      axonometric_request_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
      journal_category:
        | "designer_interview"
        | "collection_story"
        | "design_trend"
        | "project_showcase"
        | "international_editorial"
      sample_request_status:
        | "requested"
        | "approved"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      trade_application_status: "pending" | "approved" | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "trade_user", "super_admin"],
      axonometric_request_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
      ],
      journal_category: [
        "designer_interview",
        "collection_story",
        "design_trend",
        "project_showcase",
        "international_editorial",
      ],
      sample_request_status: [
        "requested",
        "approved",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      trade_application_status: ["pending", "approved", "rejected"],
    },
  },
} as const
