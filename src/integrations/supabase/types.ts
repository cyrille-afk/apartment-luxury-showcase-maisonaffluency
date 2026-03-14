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
      profiles: {
        Row: {
          company: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
        }
        Insert: {
          company?: string
          created_at?: string
          email: string
          first_name?: string
          id: string
          last_name?: string
          phone?: string
        }
        Update: {
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
          created_at: string
          document_type: string
          file_size_bytes: number | null
          file_url: string
          id: string
          title: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          title: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
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
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quote_id: string
          unit_price_cents: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          quote_id: string
          unit_price_cents?: number | null
        }
        Update: {
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
          created_at: string
          id: string
          notes: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trade_user"
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
      app_role: ["admin", "trade_user"],
      trade_application_status: ["pending", "approved", "rejected"],
    },
  },
} as const
