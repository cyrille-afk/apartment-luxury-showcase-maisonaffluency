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
      ai_response_cache: {
        Row: {
          completion_tokens: number | null
          created_at: string
          expires_at: string
          feature: string
          hits: number
          id: string
          last_hit_at: string | null
          model: string
          prompt_hash: string
          prompt_tokens: number | null
          response_json: Json
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          expires_at: string
          feature: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model: string
          prompt_hash: string
          prompt_tokens?: number | null
          response_json: Json
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          expires_at?: string
          feature?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model?: string
          prompt_hash?: string
          prompt_tokens?: number | null
          response_json?: Json
        }
        Relationships: []
      }
      ai_semantic_cache: {
        Row: {
          completion_tokens: number | null
          created_at: string
          embedding: string | null
          expires_at: string
          feature: string
          hits: number
          id: string
          last_hit_at: string | null
          model: string
          prompt: string
          prompt_hash: string
          prompt_tokens: number | null
          response_json: Json
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          embedding?: string | null
          expires_at: string
          feature: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model: string
          prompt: string
          prompt_hash: string
          prompt_tokens?: number | null
          response_json: Json
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          embedding?: string | null
          expires_at?: string
          feature?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model?: string
          prompt?: string
          prompt_hash?: string
          prompt_tokens?: number | null
          response_json?: Json
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          cached: boolean
          completion_tokens: number
          created_at: string
          error_code: string | null
          estimated_cost_usd: number
          feature: string
          id: string
          latency_ms: number | null
          model: string
          prompt_hash: string | null
          prompt_tokens: number
          status: string
          tier: string | null
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          cached?: boolean
          completion_tokens?: number
          created_at?: string
          error_code?: string | null
          estimated_cost_usd?: number
          feature: string
          id?: string
          latency_ms?: number | null
          model: string
          prompt_hash?: string | null
          prompt_tokens?: number
          status?: string
          tier?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          cached?: boolean
          completion_tokens?: number
          created_at?: string
          error_code?: string | null
          estimated_cost_usd?: number
          feature?: string
          id?: string
          latency_ms?: number | null
          model?: string
          prompt_hash?: string | null
          prompt_tokens?: number
          status?: string
          tier?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      auction_benchmarks: {
        Row: {
          auction_house: string
          created_at: string
          currency: string
          designer_name: string
          estimate_high_usd: number | null
          estimate_low_usd: number | null
          id: string
          lot_url: string | null
          piece_title: string
          sale_date: string | null
          sold_price_usd: number | null
        }
        Insert: {
          auction_house: string
          created_at?: string
          currency?: string
          designer_name: string
          estimate_high_usd?: number | null
          estimate_low_usd?: number | null
          id?: string
          lot_url?: string | null
          piece_title: string
          sale_date?: string | null
          sold_price_usd?: number | null
        }
        Update: {
          auction_house?: string
          created_at?: string
          currency?: string
          designer_name?: string
          estimate_high_usd?: number | null
          estimate_low_usd?: number | null
          id?: string
          lot_url?: string | null
          piece_title?: string
          sale_date?: string | null
          sold_price_usd?: number | null
        }
        Relationships: []
      }
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
          camera_angles: string | null
          created_at: string
          file_formats: string | null
          id: string
          image_url: string
          lighting_mood: string | null
          linked_favorite_product_ids: Json | null
          notes: string | null
          project_name: string
          render_engine: string | null
          request_type: string
          resolution: string | null
          result_image_url: string | null
          room_type: string | null
          status: Database["public"]["Enums"]["axonometric_request_status"]
          style_direction: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          camera_angles?: string | null
          created_at?: string
          file_formats?: string | null
          id?: string
          image_url: string
          lighting_mood?: string | null
          linked_favorite_product_ids?: Json | null
          notes?: string | null
          project_name?: string
          render_engine?: string | null
          request_type?: string
          resolution?: string | null
          result_image_url?: string | null
          room_type?: string | null
          status?: Database["public"]["Enums"]["axonometric_request_status"]
          style_direction?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          camera_angles?: string | null
          created_at?: string
          file_formats?: string | null
          id?: string
          image_url?: string
          lighting_mood?: string | null
          linked_favorite_product_ids?: Json | null
          notes?: string | null
          project_name?: string
          render_engine?: string | null
          request_type?: string
          resolution?: string | null
          result_image_url?: string | null
          room_type?: string | null
          status?: Database["public"]["Enums"]["axonometric_request_status"]
          style_direction?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      board_recommendations: {
        Row: {
          board_id: string
          created_at: string
          id: string
          product_id: string
          reason: string
          score: number
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          product_id: string
          reason?: string
          score?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          product_id?: string
          reason?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_recommendations_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "client_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "designer_curator_picks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "designer_curator_picks_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_lead_times: {
        Row: {
          brand_name: string
          created_at: string
          default_lead_weeks_max: number | null
          default_lead_weeks_min: number | null
          default_stock_status: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          default_lead_weeks_max?: number | null
          default_lead_weeks_min?: number | null
          default_stock_status?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          default_lead_weeks_max?: number | null
          default_lead_weeks_min?: number | null
          default_stock_status?: string
          id?: string
          notes?: string | null
          updated_at?: string
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
      brief_drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cad_asset_downloads: {
        Row: {
          cad_asset_id: string
          country: string
          created_at: string
          file_format: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          cad_asset_id: string
          country?: string
          created_at?: string
          file_format: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          cad_asset_id?: string
          country?: string
          created_at?: string
          file_format?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      cad_documents: {
        Row: {
          created_at: string
          error: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          format: string
          id: string
          parsed_at: string | null
          parsed_geometry: Json | null
          status: string
          studio_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          format: string
          id?: string
          parsed_at?: string | null
          parsed_geometry?: Json | null
          status?: string
          studio_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          format?: string
          id?: string
          parsed_at?: string | null
          parsed_geometry?: Json | null
          status?: string
          studio_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_documents_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      cad_fit_edit_audit: {
        Row: {
          batch_id: string | null
          cad_document_id: string | null
          clearance_mm: number | null
          created_at: string
          failed_validation: string | null
          field: string
          id: string
          outcome: string
          product_id: string | null
          reason: string | null
          requested_value: string | null
          resolved_value: string | null
          room_label: string | null
          session_id: string | null
          turns_since_confirm: number | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          batch_id?: string | null
          cad_document_id?: string | null
          clearance_mm?: number | null
          created_at?: string
          failed_validation?: string | null
          field: string
          id?: string
          outcome: string
          product_id?: string | null
          reason?: string | null
          requested_value?: string | null
          resolved_value?: string | null
          room_label?: string | null
          session_id?: string | null
          turns_since_confirm?: number | null
          user_id: string
          verdict?: string | null
        }
        Update: {
          batch_id?: string | null
          cad_document_id?: string | null
          clearance_mm?: number | null
          created_at?: string
          failed_validation?: string | null
          field?: string
          id?: string
          outcome?: string
          product_id?: string | null
          reason?: string | null
          requested_value?: string | null
          resolved_value?: string | null
          room_label?: string | null
          session_id?: string | null
          turns_since_confirm?: number | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: []
      }
      cad_fit_reports: {
        Row: {
          cad_document_id: string
          created_at: string
          created_by: string
          id: string
          product_bbox_mm: Json | null
          product_id: string
          reasons: Json | null
          room_bbox_mm: Json | null
          room_label: string | null
          variant_label: string | null
          verdict: string
        }
        Insert: {
          cad_document_id: string
          created_at?: string
          created_by: string
          id?: string
          product_bbox_mm?: Json | null
          product_id: string
          reasons?: Json | null
          room_bbox_mm?: Json | null
          room_label?: string | null
          variant_label?: string | null
          verdict: string
        }
        Update: {
          cad_document_id?: string
          created_at?: string
          created_by?: string
          id?: string
          product_bbox_mm?: Json | null
          product_id?: string
          reasons?: Json | null
          room_bbox_mm?: Json | null
          room_label?: string | null
          variant_label?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_fit_reports_cad_document_id_fkey"
            columns: ["cad_document_id"]
            isOneToOne: false
            referencedRelation: "cad_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_board_comments: {
        Row: {
          author_name: string
          board_id: string
          content: string
          created_at: string
          id: string
          is_client: boolean
          item_id: string | null
        }
        Insert: {
          author_name?: string
          board_id: string
          content: string
          created_at?: string
          id?: string
          is_client?: boolean
          item_id?: string | null
        }
        Update: {
          author_name?: string
          board_id?: string
          content?: string
          created_at?: string
          id?: string
          is_client?: boolean
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_board_comments_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "client_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_board_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "client_board_items"
            referencedColumns: ["id"]
          },
        ]
      }
      client_board_items: {
        Row: {
          approval_status: string
          board_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          sort_order: number
          subfolder: string | null
        }
        Insert: {
          approval_status?: string
          board_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          sort_order?: number
          subfolder?: string | null
        }
        Update: {
          approval_status?: string
          board_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          sort_order?: number
          subfolder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "client_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_board_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_boards: {
        Row: {
          client_email: string | null
          client_name: string
          created_at: string
          hide_maison_branding: boolean
          id: string
          project_id: string | null
          share_token: string
          status: string
          studio_id: string | null
          studio_logo_url: string | null
          studio_name: string | null
          title: string
          token_expires_at: string | null
          token_rotated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          hide_maison_branding?: boolean
          id?: string
          project_id?: string | null
          share_token?: string
          status?: string
          studio_id?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          title?: string
          token_expires_at?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          hide_maison_branding?: boolean
          id?: string
          project_id?: string | null
          share_token?: string
          status?: string
          studio_id?: string | null
          studio_logo_url?: string | null
          studio_name?: string | null
          title?: string
          token_expires_at?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_boards_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string
          notes: string | null
          phone: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          doc_type: Database["public"]["Enums"]["client_document_type"]
          expires_at: string | null
          external_url: string | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          label: string
          mime_type: string | null
          notes: string | null
          signed_at: string | null
          storage_kind: Database["public"]["Enums"]["client_document_storage"]
          storage_path: string | null
          studio_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["client_document_type"]
          expires_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          label: string
          mime_type?: string | null
          notes?: string | null
          signed_at?: string | null
          storage_kind?: Database["public"]["Enums"]["client_document_storage"]
          storage_path?: string | null
          studio_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["client_document_type"]
          expires_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          label?: string
          mime_type?: string | null
          notes?: string | null
          signed_at?: string | null
          storage_kind?: Database["public"]["Enums"]["client_document_storage"]
          storage_path?: string | null
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      client_taste_profiles: {
        Row: {
          cluster_description: string | null
          cluster_label: string
          computed_at: string
          created_at: string
          engagement_score: number | null
          id: string
          raw_signals: Json | null
          style_keywords: string[] | null
          top_brands: string[] | null
          top_categories: string[] | null
          top_designers: string[] | null
          top_materials: string[] | null
          total_favorites: number | null
          total_quotes: number | null
          total_samples: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_description?: string | null
          cluster_label?: string
          computed_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          raw_signals?: Json | null
          style_keywords?: string[] | null
          top_brands?: string[] | null
          top_categories?: string[] | null
          top_designers?: string[] | null
          top_materials?: string[] | null
          total_favorites?: number | null
          total_quotes?: number | null
          total_samples?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_description?: string | null
          cluster_label?: string
          computed_at?: string
          created_at?: string
          engagement_score?: number | null
          id?: string
          raw_signals?: Json | null
          style_keywords?: string[] | null
          top_brands?: string[] | null
          top_categories?: string[] | null
          top_designers?: string[] | null
          top_materials?: string[] | null
          total_favorites?: number | null
          total_quotes?: number | null
          total_samples?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_region: string | null
          created_at: string
          created_by: string
          default_currency: string | null
          id: string
          name: string
          notes: string | null
          studio_id: string
          tax_id: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_region?: string | null
          created_at?: string
          created_by: string
          default_currency?: string | null
          id?: string
          name: string
          notes?: string | null
          studio_id: string
          tax_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_region?: string | null
          created_at?: string
          created_by?: string
          default_currency?: string | null
          id?: string
          name?: string
          notes?: string | null
          studio_id?: string
          tax_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_designers: {
        Row: {
          created_at: string
          designer_name: string
          gallery_id: string
          id: string
          is_overlap: boolean
          profile_url: string | null
        }
        Insert: {
          created_at?: string
          designer_name: string
          gallery_id: string
          id?: string
          is_overlap?: boolean
          profile_url?: string | null
        }
        Update: {
          created_at?: string
          designer_name?: string
          gallery_id?: string
          id?: string
          is_overlap?: boolean
          profile_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_designers_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "competitor_galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_galleries: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_scraped_at: string | null
          location: string
          logo_url: string | null
          name: string
          region: string
          scrape_status: string
          updated_at: string
          website_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_scraped_at?: string | null
          location?: string
          logo_url?: string | null
          name: string
          region?: string
          scrape_status?: string
          updated_at?: string
          website_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_scraped_at?: string | null
          location?: string
          logo_url?: string | null
          name?: string
          region?: string
          scrape_status?: string
          updated_at?: string
          website_url?: string
        }
        Relationships: []
      }
      competitor_traffic: {
        Row: {
          avg_duration_seconds: number | null
          bounce_rate: number | null
          created_at: string
          gallery_id: string
          id: string
          month: string
          monthly_visits: number | null
          source: string
        }
        Insert: {
          avg_duration_seconds?: number | null
          bounce_rate?: number | null
          created_at?: string
          gallery_id: string
          id?: string
          month: string
          monthly_visits?: number | null
          source?: string
        }
        Update: {
          avg_duration_seconds?: number | null
          bounce_rate?: number | null
          created_at?: string
          gallery_id?: string
          id?: string
          month?: string
          monthly_visits?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_traffic_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "competitor_galleries"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_leads: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          first_message: string | null
          id: string
          intent: string | null
          name: string | null
          notified_at: string | null
          path: string | null
          qualified_score: number
          referrer: string | null
          session_id: string
          signals: Json
          surface: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          first_message?: string | null
          id?: string
          intent?: string | null
          name?: string | null
          notified_at?: string | null
          path?: string | null
          qualified_score?: number
          referrer?: string | null
          session_id: string
          signals?: Json
          surface: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          first_message?: string | null
          id?: string
          intent?: string | null
          name?: string | null
          notified_at?: string | null
          path?: string | null
          qualified_score?: number
          referrer?: string | null
          session_id?: string
          signals?: Json
          surface?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      concierge_rag_traces: {
        Row: {
          context_text: string | null
          created_at: string
          id: string
          match_count: number
          matches: Json
          query: string
          top_similarity: number | null
          used_in_answer: boolean
          user_id: string | null
        }
        Insert: {
          context_text?: string | null
          created_at?: string
          id?: string
          match_count?: number
          matches?: Json
          query: string
          top_similarity?: number | null
          used_in_answer?: boolean
          user_id?: string | null
        }
        Update: {
          context_text?: string | null
          created_at?: string
          id?: string
          match_count?: number
          matches?: Json
          query?: string
          top_similarity?: number | null
          used_in_answer?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      concierge_rate_limits: {
        Row: {
          count: number
          key: string
          reset_at: string
          updated_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at: string
          updated_at?: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_audit_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      cpd_attendance: {
        Row: {
          attended: boolean
          attended_at: string | null
          event_id: string
          id: string
          registered_at: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          attended_at?: string | null
          event_id: string
          id?: string
          registered_at?: string
          user_id: string
        }
        Update: {
          attended?: boolean
          attended_at?: string | null
          event_id?: string
          id?: string
          registered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cpd_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "cpd_events"
            referencedColumns: ["id"]
          },
        ]
      }
      cpd_events: {
        Row: {
          brand_name: string | null
          created_at: string
          date: string | null
          description: string | null
          duration_minutes: number | null
          event_type: string
          id: string
          is_published: boolean
          location: string | null
          max_attendees: number | null
          presenter: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_type?: string
          id?: string
          is_published?: boolean
          location?: string | null
          max_attendees?: number | null
          presenter?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          duration_minutes?: number | null
          event_type?: string
          id?: string
          is_published?: boolean
          location?: string | null
          max_attendees?: number | null
          presenter?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      cron_http_call_log: {
        Row: {
          created_at: string
          jobname: string
          request_id: number
          url: string
        }
        Insert: {
          created_at?: string
          jobname: string
          request_id: number
          url: string
        }
        Update: {
          created_at?: string
          jobname?: string
          request_id?: number
          url?: string
        }
        Relationships: []
      }
      designer_curator_picks: {
        Row: {
          base_axis_label: string | null
          category: string | null
          created_at: string
          currency: string
          default_ship_mode: string | null
          description: string | null
          designer_id: string
          dimensions: string | null
          edition: string | null
          edition_number: string | null
          edition_signing: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_source_hash: string | null
          gallery_captions: Json | null
          gallery_images: string[] | null
          hover_image_url: string | null
          hs_code: string | null
          id: string
          image_url: string
          is_hidden: boolean
          lead_time: string | null
          materials: string | null
          materials_description: string | null
          origin: string | null
          pack_carton_count: number | null
          pack_cbm: number | null
          pack_weight_kg: number | null
          pdf_filename: string | null
          pdf_url: string | null
          pdf_urls: Json | null
          photo_credit: string | null
          pickup_address: string | null
          pickup_country: string | null
          pickup_postcode: string | null
          price_per_sqm_cents: number | null
          price_prefix: string | null
          size_variants: Json | null
          sort_order: number
          subcategory: string | null
          subtitle: string | null
          tags: string[] | null
          title: string
          top_axis_label: string | null
          trade_price_cents: number | null
          variant_image_map: Json | null
          variant_placeholder: string | null
        }
        Insert: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          default_ship_mode?: string | null
          description?: string | null
          designer_id: string
          dimensions?: string | null
          edition?: string | null
          edition_number?: string | null
          edition_signing?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          gallery_captions?: Json | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string
          is_hidden?: boolean
          lead_time?: string | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_per_sqm_cents?: number | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          top_axis_label?: string | null
          trade_price_cents?: number | null
          variant_image_map?: Json | null
          variant_placeholder?: string | null
        }
        Update: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          default_ship_mode?: string | null
          description?: string | null
          designer_id?: string
          dimensions?: string | null
          edition?: string | null
          edition_number?: string | null
          edition_signing?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          gallery_captions?: Json | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string
          is_hidden?: boolean
          lead_time?: string | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_per_sqm_cents?: number | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          top_axis_label?: string | null
          trade_price_cents?: number | null
          variant_image_map?: Json | null
          variant_placeholder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designer_curator_picks_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_heritage_slides: {
        Row: {
          caption: string | null
          created_at: string
          designer_id: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          designer_id: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          designer_id?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "designer_heritage_slides_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designer_instagram_posts: {
        Row: {
          caption: string | null
          created_at: string
          designer_id: string
          hidden: boolean
          id: string
          image_url: string | null
          post_url: string
          posted_at: string | null
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          designer_id: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          post_url: string
          posted_at?: string | null
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          designer_id?: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          post_url?: string
          posted_at?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "designer_instagram_posts_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
      designers: {
        Row: {
          biography: string
          biography_images: string[] | null
          created_at: string
          display_name: string | null
          founder: string | null
          hero_image_url: string | null
          hero_photo_credit: string | null
          id: string
          image_url: string
          instagram_handle: string | null
          instagram_handle_2: string | null
          is_independent: boolean
          is_published: boolean
          links: Json | null
          logo_url: string | null
          name: string
          new_in_order: number | null
          notable_works: string
          philosophy: string
          slug: string
          sort_order: number
          source: string
          specialty: string
          updated_at: string
        }
        Insert: {
          biography?: string
          biography_images?: string[] | null
          created_at?: string
          display_name?: string | null
          founder?: string | null
          hero_image_url?: string | null
          hero_photo_credit?: string | null
          id?: string
          image_url?: string
          instagram_handle?: string | null
          instagram_handle_2?: string | null
          is_independent?: boolean
          is_published?: boolean
          links?: Json | null
          logo_url?: string | null
          name: string
          new_in_order?: number | null
          notable_works?: string
          philosophy?: string
          slug: string
          sort_order?: number
          source?: string
          specialty?: string
          updated_at?: string
        }
        Update: {
          biography?: string
          biography_images?: string[] | null
          created_at?: string
          display_name?: string | null
          founder?: string | null
          hero_image_url?: string | null
          hero_photo_credit?: string | null
          id?: string
          image_url?: string
          instagram_handle?: string | null
          instagram_handle_2?: string | null
          is_independent?: boolean
          is_published?: boolean
          links?: Json | null
          logo_url?: string | null
          name?: string
          new_in_order?: number | null
          notable_works?: string
          philosophy?: string
          slug?: string
          sort_order?: number
          source?: string
          specialty?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_downloads: {
        Row: {
          country: string
          created_at: string
          document_id: string | null
          document_label: string
          id: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          document_id?: string | null
          document_label?: string
          id?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          document_id?: string | null
          document_label?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_downloads_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trade_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_click_log: {
        Row: {
          clicked_at: string
          destination_url: string
          id: string
          ip_hash: string | null
          link_id: string
          recipient_email: string | null
          referer: string | null
          template_name: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          destination_url: string
          id?: string
          ip_hash?: string | null
          link_id: string
          recipient_email?: string | null
          referer?: string | null
          template_name: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          destination_url?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
          recipient_email?: string | null
          referer?: string | null
          template_name?: string
          user_agent?: string | null
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
      favorite_folder_items: {
        Row: {
          created_at: string
          favorite_id: string
          folder_id: string
          id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          favorite_id: string
          folder_id: string
          id?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          favorite_id?: string
          folder_id?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorite_folder_items_favorite_id_fkey"
            columns: ["favorite_id"]
            isOneToOne: false
            referencedRelation: "trade_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_folder_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "favorite_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_folders: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      featured_studios: {
        Row: {
          bio: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          disciplines: string[]
          founded_year: number | null
          gallery_images: string[] | null
          hero_image_url: string | null
          id: string
          instagram_handle: string | null
          is_featured: boolean
          is_published: boolean
          location: string | null
          logo_url: string | null
          name: string
          notable_projects: string | null
          owner_user_id: string | null
          project_types: string[]
          slug: string
          sort_order: number
          tagline: string | null
          team_size: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          bio?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          disciplines?: string[]
          founded_year?: number | null
          gallery_images?: string[] | null
          hero_image_url?: string | null
          id?: string
          instagram_handle?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          logo_url?: string | null
          name: string
          notable_projects?: string | null
          owner_user_id?: string | null
          project_types?: string[]
          slug: string
          sort_order?: number
          tagline?: string | null
          team_size?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          bio?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          disciplines?: string[]
          founded_year?: number | null
          gallery_images?: string[] | null
          hero_image_url?: string | null
          id?: string
          instagram_handle?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          logo_url?: string | null
          name?: string
          notable_projects?: string | null
          owner_user_id?: string | null
          project_types?: string[]
          slug?: string
          sort_order?: number
          tagline?: string | null
          team_size?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      ffe_entitlements: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id?: string
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
      guide_views: {
        Row: {
          created_at: string
          id: string
          slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          user_id?: string | null
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
          is_featured: boolean
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
          is_featured?: boolean
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
          is_featured?: boolean
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
      journal_pipeline: {
        Row: {
          angle: string | null
          article_id: string | null
          author: string
          category: Database["public"]["Enums"]["journal_category"]
          created_at: string
          designer_or_brand: string | null
          id: string
          notes: string | null
          seo_keywords: string | null
          status: Database["public"]["Enums"]["pipeline_status"]
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          angle?: string | null
          article_id?: string | null
          author?: string
          category?: Database["public"]["Enums"]["journal_category"]
          created_at?: string
          designer_or_brand?: string | null
          id?: string
          notes?: string | null
          seo_keywords?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          angle?: string | null
          article_id?: string | null
          author?: string
          category?: Database["public"]["Enums"]["journal_category"]
          created_at?: string
          designer_or_brand?: string | null
          id?: string
          notes?: string | null
          seo_keywords?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_pipeline_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "journal_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_badge_events: {
        Row: {
          country: string | null
          created_at: string
          document_id: string | null
          document_label: string | null
          event_type: string
          id: string
          source: string
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          document_id?: string | null
          document_label?: string | null
          event_type: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          document_id?: string | null
          document_label?: string | null
          event_type?: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magazine_badge_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trade_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      markup_annotations: {
        Row: {
          created_at: string
          id: string
          image_url: string
          pins: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          pins?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          pins?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      material_swatches: {
        Row: {
          application: string | null
          brand_name: string
          category: string
          color_family: string | null
          created_at: string
          finish: string | null
          id: string
          image_url: string | null
          is_active: boolean
          material_type: string | null
          name: string
          notes: string | null
          swatch_code: string | null
          updated_at: string
        }
        Insert: {
          application?: string | null
          brand_name?: string
          category?: string
          color_family?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material_type?: string | null
          name: string
          notes?: string | null
          swatch_code?: string | null
          updated_at?: string
        }
        Update: {
          application?: string | null
          brand_name?: string
          category?: string
          color_family?: string | null
          created_at?: string
          finish?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material_type?: string | null
          name?: string
          notes?: string | null
          swatch_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      og_rescrape_runs: {
        Row: {
          build_id: string | null
          created_at: string
          current_snapshot_size: number | null
          error: string | null
          forced: boolean
          id: string
          manifest_size: number | null
          previous_snapshot_size: number | null
          rescrape_result: Json | null
          rescraped_count: number
          skipped: boolean
          skipped_reason: string | null
          trigger_source: string
          truncated: boolean
        }
        Insert: {
          build_id?: string | null
          created_at?: string
          current_snapshot_size?: number | null
          error?: string | null
          forced?: boolean
          id?: string
          manifest_size?: number | null
          previous_snapshot_size?: number | null
          rescrape_result?: Json | null
          rescraped_count?: number
          skipped?: boolean
          skipped_reason?: string | null
          trigger_source?: string
          truncated?: boolean
        }
        Update: {
          build_id?: string | null
          created_at?: string
          current_snapshot_size?: number | null
          error?: string | null
          forced?: boolean
          id?: string
          manifest_size?: number | null
          previous_snapshot_size?: number | null
          rescrape_result?: Json | null
          rescraped_count?: number
          skipped?: boolean
          skipped_reason?: string | null
          trigger_source?: string
          truncated?: boolean
        }
        Relationships: []
      }
      onboarding_flow_config: {
        Row: {
          buttons: Json
          greeting_template: string
          id: string
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          buttons?: Json
          greeting_template?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          buttons?: Json
          greeting_template?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      onboarding_tour_steps: {
        Row: {
          body: string
          created_at: string
          cta_label: string
          icon: string
          id: string
          is_active: boolean
          path: string
          sort_order: number
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          cta_label?: string
          icon?: string
          id?: string
          is_active?: boolean
          path: string
          sort_order?: number
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          cta_label?: string
          icon?: string
          id?: string
          is_active?: boolean
          path?: string
          sort_order?: number
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_duration_templates: {
        Row: {
          brand_name: string
          category: string
          created_at: string
          customs_days: number
          id: string
          production_weeks: number
          shipping_weeks: number
          updated_at: string
        }
        Insert: {
          brand_name: string
          category?: string
          created_at?: string
          customs_days?: number
          id?: string
          production_weeks?: number
          shipping_weeks?: number
          updated_at?: string
        }
        Update: {
          brand_name?: string
          category?: string
          created_at?: string
          customs_days?: number
          id?: string
          production_weeks?: number
          shipping_weeks?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_timeline: {
        Row: {
          actual_delivery_at: string | null
          admin_notes: string | null
          balance_due_at: string | null
          balance_paid_at: string | null
          created_at: string
          customs_cleared_at: string | null
          customs_days: number
          customs_start_at: string | null
          deposit_paid_at: string | null
          estimated_delivery_at: string | null
          id: string
          incoterm: string | null
          kanban_status: string
          production_end_at: string | null
          production_start_at: string | null
          production_weeks: number
          project_id: string | null
          quote_id: string
          ship_to_address1: string | null
          ship_to_address2: string | null
          ship_to_attention: string | null
          ship_to_city: string | null
          ship_to_country: string | null
          ship_to_email: string | null
          ship_to_name: string | null
          ship_to_notes: string | null
          ship_to_phone: string | null
          ship_to_postal_code: string | null
          ship_to_state: string | null
          shipping_end_at: string | null
          shipping_start_at: string | null
          shipping_weeks: number
          studio_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_delivery_at?: string | null
          admin_notes?: string | null
          balance_due_at?: string | null
          balance_paid_at?: string | null
          created_at?: string
          customs_cleared_at?: string | null
          customs_days?: number
          customs_start_at?: string | null
          deposit_paid_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          incoterm?: string | null
          kanban_status?: string
          production_end_at?: string | null
          production_start_at?: string | null
          production_weeks?: number
          project_id?: string | null
          quote_id: string
          ship_to_address1?: string | null
          ship_to_address2?: string | null
          ship_to_attention?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_email?: string | null
          ship_to_name?: string | null
          ship_to_notes?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_state?: string | null
          shipping_end_at?: string | null
          shipping_start_at?: string | null
          shipping_weeks?: number
          studio_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_delivery_at?: string | null
          admin_notes?: string | null
          balance_due_at?: string | null
          balance_paid_at?: string | null
          created_at?: string
          customs_cleared_at?: string | null
          customs_days?: number
          customs_start_at?: string | null
          deposit_paid_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          incoterm?: string | null
          kanban_status?: string
          production_end_at?: string | null
          production_start_at?: string | null
          production_weeks?: number
          project_id?: string | null
          quote_id?: string
          ship_to_address1?: string | null
          ship_to_address2?: string | null
          ship_to_attention?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_email?: string | null
          ship_to_name?: string | null
          ship_to_notes?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_state?: string | null
          shipping_end_at?: string | null
          shipping_start_at?: string | null
          shipping_weeks?: number
          studio_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_timeline_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_timeline_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          presentation_id: string
          slide_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          presentation_id: string
          slide_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          presentation_id?: string
          slide_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_comments_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_comments_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "presentation_slides"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_shares: {
        Row: {
          created_at: string
          id: string
          presentation_id: string
          role: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          presentation_id: string
          role?: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          presentation_id?: string
          role?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_shares_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_slides: {
        Row: {
          created_at: string
          description: string | null
          gallery_item_id: string | null
          id: string
          image_url: string
          linked_product_ids: Json | null
          linked_quote_id: string | null
          presentation_id: string
          project_name: string | null
          room_section: string | null
          slide_type: string
          sort_order: number
          style_preset: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gallery_item_id?: string | null
          id?: string
          image_url: string
          linked_product_ids?: Json | null
          linked_quote_id?: string | null
          presentation_id: string
          project_name?: string | null
          room_section?: string | null
          slide_type?: string
          sort_order?: number
          style_preset?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gallery_item_id?: string | null
          id?: string
          image_url?: string
          linked_product_ids?: Json | null
          linked_quote_id?: string | null
          presentation_id?: string
          project_name?: string | null
          room_section?: string | null
          slide_type?: string
          sort_order?: number
          style_preset?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_slides_gallery_item_id_fkey"
            columns: ["gallery_item_id"]
            isOneToOne: false
            referencedRelation: "axonometric_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_slides_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentations: {
        Row: {
          client_name: string | null
          cover_style: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_published: boolean
          project_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          cover_style?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_published?: boolean
          project_name?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          cover_style?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_published?: boolean
          project_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_cad_asset_geometry: {
        Row: {
          bbox_mm: Json | null
          cad_asset_id: string
          created_at: string
          error: string | null
          file_format: string
          id: string
          metrics: Json | null
          parsed_at: string | null
          product_id: string
          status: string
          units: string | null
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          bbox_mm?: Json | null
          cad_asset_id: string
          created_at?: string
          error?: string | null
          file_format: string
          id?: string
          metrics?: Json | null
          parsed_at?: string | null
          product_id: string
          status?: string
          units?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          bbox_mm?: Json | null
          cad_asset_id?: string
          created_at?: string
          error?: string | null
          file_format?: string
          id?: string
          metrics?: Json | null
          parsed_at?: string | null
          product_id?: string
          status?: string
          units?: string | null
          updated_at?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_cad_asset_geometry_cad_asset_id_fkey"
            columns: ["cad_asset_id"]
            isOneToOne: true
            referencedRelation: "trade_product_cad_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string
          concierge_name: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string
          has_seen_trade_intro: boolean
          id: string
          last_name: string
          phone: string
          trade_tier: Database["public"]["Enums"]["trade_tier"]
          trade_tier_12mo_spend_cents: number
          trade_tier_computed_at: string | null
          trade_tier_locked_by_admin: boolean
          trade_tier_suggested: Database["public"]["Enums"]["trade_tier"] | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string
          concierge_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string
          has_seen_trade_intro?: boolean
          id: string
          last_name?: string
          phone?: string
          trade_tier?: Database["public"]["Enums"]["trade_tier"]
          trade_tier_12mo_spend_cents?: number
          trade_tier_computed_at?: string | null
          trade_tier_locked_by_admin?: boolean
          trade_tier_suggested?:
            | Database["public"]["Enums"]["trade_tier"]
            | null
        }
        Update: {
          avatar_url?: string | null
          company?: string
          concierge_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string
          has_seen_trade_intro?: boolean
          id?: string
          last_name?: string
          phone?: string
          trade_tier?: Database["public"]["Enums"]["trade_tier"]
          trade_tier_12mo_spend_cents?: number
          trade_tier_computed_at?: string | null
          trade_tier_locked_by_admin?: boolean
          trade_tier_suggested?:
            | Database["public"]["Enums"]["trade_tier"]
            | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          client_name: string
          color: string
          cover_image_url: string | null
          created_at: string
          id: string
          location: string
          name: string
          notes: string | null
          status: string
          studio_id: string | null
          target_completion_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          location?: string
          name?: string
          notes?: string | null
          status?: string
          studio_id?: string | null
          target_completion_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          location?: string
          name?: string
          notes?: string | null
          status?: string
          studio_id?: string | null
          target_completion_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
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
      public_download_events: {
        Row: {
          country: string
          created_at: string
          document_id: string | null
          document_label: string
          id: string
          source: string
        }
        Insert: {
          country?: string
          created_at?: string
          document_id?: string | null
          document_label?: string
          id?: string
          source?: string
        }
        Update: {
          country?: string
          created_at?: string
          document_id?: string | null
          document_label?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_download_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "trade_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_email_log: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          note: string | null
          quote_id: string
          recipient_email: string
          sent_by: string
          sent_by_email: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          quote_id: string
          recipient_email: string
          sent_by: string
          sent_by_email?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          quote_id?: string
          recipient_email?: string
          sent_by?: string
          sent_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_email_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_styles: {
        Row: {
          created_at: string
          created_by: string
          id: string
          image_url: string
          mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          image_url: string
          mode: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string
          mode?: string
          updated_at?: string
        }
        Relationships: []
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
      scrape_configs: {
        Row: {
          brand_name: string
          category: string
          chunk_delay: number
          chunk_size: number
          created_at: string
          created_by: string | null
          extract_prompt: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_result: Json | null
          location: string
          schedule_cron: string | null
          updated_at: string
          urls: string[]
        }
        Insert: {
          brand_name: string
          category?: string
          chunk_delay?: number
          chunk_size?: number
          created_at?: string
          created_by?: string | null
          extract_prompt?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_result?: Json | null
          location?: string
          schedule_cron?: string | null
          updated_at?: string
          urls?: string[]
        }
        Update: {
          brand_name?: string
          category?: string
          chunk_delay?: number
          chunk_size?: number
          created_at?: string
          created_by?: string | null
          extract_prompt?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_result?: Json | null
          location?: string
          schedule_cron?: string | null
          updated_at?: string
          urls?: string[]
        }
        Relationships: []
      }
      scrape_runs: {
        Row: {
          brand_name: string
          category: string
          completed_at: string
          created_at: string
          duration_seconds: number
          error_message: string | null
          errors: number
          id: string
          inserted: number
          started_at: string
          status: string
          total_scraped: number
          total_urls: number
          updated: number
        }
        Insert: {
          brand_name: string
          category?: string
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          error_message?: string | null
          errors?: number
          id?: string
          inserted?: number
          started_at?: string
          status?: string
          total_scraped?: number
          total_urls?: number
          updated?: number
        }
        Update: {
          brand_name?: string
          category?: string
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          error_message?: string | null
          errors?: number
          id?: string
          inserted?: number
          started_at?: string
          status?: string
          total_scraped?: number
          total_urls?: number
          updated?: number
        }
        Relationships: []
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
      security_alert_state: {
        Row: {
          id: string
          last_alerted_at: string | null
          payload: Json | null
        }
        Insert: {
          id: string
          last_alerted_at?: string | null
          payload?: Json | null
        }
        Update: {
          id?: string
          last_alerted_at?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          details: Json
          event_type: string
          id: string
          ip: string | null
          occurred_at: string
          source: string
          user_id: string | null
        }
        Insert: {
          details?: Json
          event_type: string
          id?: string
          ip?: string | null
          occurred_at?: string
          source: string
          user_id?: string | null
        }
        Update: {
          details?: Json
          event_type?: string
          id?: string
          ip?: string | null
          occurred_at?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shipping_duty_rates: {
        Row: {
          active: boolean
          category: string
          created_at: string
          dest_country: string
          duty_percent: number
          hs_chapter: string
          id: string
          notes: string | null
          updated_at: string
          vat_percent: number
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          dest_country: string
          duty_percent?: number
          hs_chapter?: string
          id?: string
          notes?: string | null
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          dest_country?: string
          duty_percent?: number
          hs_chapter?: string
          id?: string
          notes?: string | null
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      shipping_lanes: {
        Row: {
          active: boolean
          carrier_name: string
          created_at: string
          dest_country: string
          dest_zone: string
          id: string
          mode: string
          notes: string | null
          origin_city: string
          origin_country: string
          source: string
          transit_days_max: number
          transit_days_min: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          carrier_name: string
          created_at?: string
          dest_country: string
          dest_zone?: string
          id?: string
          mode: string
          notes?: string | null
          origin_city?: string
          origin_country: string
          source?: string
          transit_days_max?: number
          transit_days_min?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          carrier_name?: string
          created_at?: string
          dest_country?: string
          dest_zone?: string
          id?: string
          mode?: string
          notes?: string | null
          origin_city?: string
          origin_country?: string
          source?: string
          transit_days_max?: number
          transit_days_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      shipping_quotes: {
        Row: {
          computed_breakdown: Json
          confirmed_at: string | null
          created_at: string
          currency: string
          customs_cents: number
          declared_value_cents: number
          dest_address: string | null
          dest_city: string
          dest_country: string
          dest_zone: string | null
          duty_cents: number
          freight_cents: number
          fuel_cents: number
          handling_cents: number
          id: string
          insurance_cents: number
          last_mile_cents: number
          notes: string | null
          order_timeline_id: string | null
          origin_address: string | null
          origin_city: string
          origin_country: string
          quote_id: string | null
          selected_carrier: string | null
          selected_lane_id: string | null
          selected_mode: string | null
          status: string
          total_cents: number
          total_volume_cbm: number
          total_weight_kg: number
          updated_at: string
          user_id: string
          valid_until: string | null
          vat_cents: number
        }
        Insert: {
          computed_breakdown?: Json
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customs_cents?: number
          declared_value_cents?: number
          dest_address?: string | null
          dest_city?: string
          dest_country?: string
          dest_zone?: string | null
          duty_cents?: number
          freight_cents?: number
          fuel_cents?: number
          handling_cents?: number
          id?: string
          insurance_cents?: number
          last_mile_cents?: number
          notes?: string | null
          order_timeline_id?: string | null
          origin_address?: string | null
          origin_city?: string
          origin_country?: string
          quote_id?: string | null
          selected_carrier?: string | null
          selected_lane_id?: string | null
          selected_mode?: string | null
          status?: string
          total_cents?: number
          total_volume_cbm?: number
          total_weight_kg?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
          vat_cents?: number
        }
        Update: {
          computed_breakdown?: Json
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customs_cents?: number
          declared_value_cents?: number
          dest_address?: string | null
          dest_city?: string
          dest_country?: string
          dest_zone?: string | null
          duty_cents?: number
          freight_cents?: number
          fuel_cents?: number
          handling_cents?: number
          id?: string
          insurance_cents?: number
          last_mile_cents?: number
          notes?: string | null
          order_timeline_id?: string | null
          origin_address?: string | null
          origin_city?: string
          origin_country?: string
          quote_id?: string | null
          selected_carrier?: string | null
          selected_lane_id?: string | null
          selected_mode?: string | null
          status?: string
          total_cents?: number
          total_volume_cbm?: number
          total_weight_kg?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          vat_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_order_timeline_id_fkey"
            columns: ["order_timeline_id"]
            isOneToOne: false
            referencedRelation: "order_timeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_selected_lane_id_fkey"
            columns: ["selected_lane_id"]
            isOneToOne: false
            referencedRelation: "shipping_lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rate_brackets: {
        Row: {
          base_rate_cents: number
          created_at: string
          currency: string
          id: string
          lane_id: string
          max_volume_cbm: number
          max_weight_kg: number
          min_charge_cents: number
          min_volume_cbm: number
          min_weight_kg: number
          rate_per_cbm_cents: number
          rate_per_kg_cents: number
          source: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          base_rate_cents?: number
          created_at?: string
          currency?: string
          id?: string
          lane_id: string
          max_volume_cbm?: number
          max_weight_kg?: number
          min_charge_cents?: number
          min_volume_cbm?: number
          min_weight_kg?: number
          rate_per_cbm_cents?: number
          rate_per_kg_cents?: number
          source?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          base_rate_cents?: number
          created_at?: string
          currency?: string
          id?: string
          lane_id?: string
          max_volume_cbm?: number
          max_weight_kg?: number
          min_charge_cents?: number
          min_volume_cbm?: number
          min_weight_kg?: number
          rate_per_cbm_cents?: number
          rate_per_kg_cents?: number
          source?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rate_brackets_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "shipping_lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_surcharges: {
        Row: {
          active: boolean
          calc_method: string
          carrier_name: string | null
          created_at: string
          currency: string
          dest_country: string | null
          dest_zone: string | null
          id: string
          lane_id: string | null
          notes: string | null
          scope: string
          surcharge_type: string
          updated_at: string
          value_numeric: number
        }
        Insert: {
          active?: boolean
          calc_method: string
          carrier_name?: string | null
          created_at?: string
          currency?: string
          dest_country?: string | null
          dest_zone?: string | null
          id?: string
          lane_id?: string | null
          notes?: string | null
          scope?: string
          surcharge_type: string
          updated_at?: string
          value_numeric?: number
        }
        Update: {
          active?: boolean
          calc_method?: string
          carrier_name?: string | null
          created_at?: string
          currency?: string
          dest_country?: string | null
          dest_zone?: string | null
          id?: string
          lane_id?: string | null
          notes?: string | null
          scope?: string
          surcharge_type?: string
          updated_at?: string
          value_numeric?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipping_surcharges_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "shipping_lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      sitemap_products: {
        Row: {
          id: string
          updated_at: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      studio_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_invites_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_lead_events: {
        Row: {
          country: string | null
          created_at: string
          cta_kind: string | null
          event_type: string
          filter_key: string | null
          filter_value: string | null
          id: string
          referrer: string | null
          studio_id: string | null
          user_agent: string | null
          user_id: string | null
          visitor_hash: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          cta_kind?: string | null
          event_type: string
          filter_key?: string | null
          filter_value?: string | null
          id?: string
          referrer?: string | null
          studio_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_hash?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          cta_kind?: string | null
          event_type?: string
          filter_key?: string | null
          filter_value?: string | null
          id?: string
          referrer?: string | null
          studio_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_lead_events_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "featured_studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["studio_role"]
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_payout_accounts: {
        Row: {
          account_holder_name: string
          ach_account_number: string | null
          ach_routing_number: string | null
          bank_address: string | null
          bank_name: string | null
          country_code: string
          created_at: string
          created_by: string
          currency: string
          iban: string | null
          id: string
          is_default: boolean
          label: string
          stripe_connect_account_id: string | null
          stripe_connect_status: string
          studio_id: string
          swift_bic: string | null
          tax_form_document_path: string | null
          tax_form_kind: string | null
          tax_form_reference: string | null
          updated_at: string
        }
        Insert: {
          account_holder_name: string
          ach_account_number?: string | null
          ach_routing_number?: string | null
          bank_address?: string | null
          bank_name?: string | null
          country_code: string
          created_at?: string
          created_by: string
          currency: string
          iban?: string | null
          id?: string
          is_default?: boolean
          label: string
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
          studio_id: string
          swift_bic?: string | null
          tax_form_document_path?: string | null
          tax_form_kind?: string | null
          tax_form_reference?: string | null
          updated_at?: string
        }
        Update: {
          account_holder_name?: string
          ach_account_number?: string | null
          ach_routing_number?: string | null
          bank_address?: string | null
          bank_name?: string | null
          country_code?: string
          created_at?: string
          created_by?: string
          currency?: string
          iban?: string | null
          id?: string
          is_default?: boolean
          label?: string
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
          studio_id?: string
          swift_bic?: string | null
          tax_form_document_path?: string | null
          tax_form_kind?: string | null
          tax_form_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_payout_accounts_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_project_overrides: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["studio_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["studio_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["studio_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_project_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_resale_certificates: {
        Row: {
          certificate_number: string | null
          created_at: string
          document_path: string
          expires_on: string | null
          id: string
          issued_on: string | null
          rejected_reason: string | null
          state_code: string
          studio_id: string
          updated_at: string
          uploaded_by: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          document_path: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          rejected_reason?: string | null
          state_code: string
          studio_id: string
          updated_at?: string
          uploaded_by: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          document_path?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          rejected_reason?: string | null
          state_code?: string
          studio_id?: string
          updated_at?: string
          uploaded_by?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_resale_certificates_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_submissions: {
        Row: {
          about: string | null
          contact_name: string
          country: string | null
          created_at: string
          disciplines: string[]
          email: string
          id: string
          instagram: string | null
          location: string | null
          notable_projects: string | null
          phone: string | null
          portfolio_url: string | null
          project_types: string[]
          referrer: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          studio_name: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          contact_name: string
          country?: string | null
          created_at?: string
          disciplines?: string[]
          email: string
          id?: string
          instagram?: string | null
          location?: string | null
          notable_projects?: string | null
          phone?: string | null
          portfolio_url?: string | null
          project_types?: string[]
          referrer?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          studio_name: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string
          disciplines?: string[]
          email?: string
          id?: string
          instagram?: string | null
          location?: string | null
          notable_projects?: string | null
          phone?: string | null
          portfolio_url?: string | null
          project_types?: string[]
          referrer?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          studio_name?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      studios: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string | null
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
      tour_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          language: string | null
          page_path: string | null
          platform: string | null
          pwa_standalone: boolean | null
          referrer_host: string | null
          step_id: string | null
          step_index: number | null
          sub_step_id: string | null
          sub_step_label: string | null
          target_path: string | null
          total_steps: number | null
          user_id: string | null
          viewport: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          language?: string | null
          page_path?: string | null
          platform?: string | null
          pwa_standalone?: boolean | null
          referrer_host?: string | null
          step_id?: string | null
          step_index?: number | null
          sub_step_id?: string | null
          sub_step_label?: string | null
          target_path?: string | null
          total_steps?: number | null
          user_id?: string | null
          viewport?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          language?: string | null
          page_path?: string | null
          platform?: string | null
          pwa_standalone?: boolean | null
          referrer_host?: string | null
          step_id?: string | null
          step_index?: number | null
          sub_step_id?: string | null
          sub_step_label?: string | null
          target_path?: string | null
          total_steps?: number | null
          user_id?: string | null
          viewport?: string | null
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
      trade_concierge_actions: {
        Row: {
          args: Json
          conversation_id: string | null
          created_at: string
          id: string
          resulting_resource_id: string | null
          resulting_resource_type: string | null
          status: string
          tool: string
          user_id: string
        }
        Insert: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          resulting_resource_id?: string | null
          resulting_resource_type?: string | null
          status?: string
          tool: string
          user_id: string
        }
        Update: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          resulting_resource_id?: string | null
          resulting_resource_type?: string | null
          status?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_concierge_escalations: {
        Row: {
          conversation_excerpt: Json
          created_at: string
          id: string
          notified_admins: boolean
          notified_email: boolean
          status: string
          trigger_intent: string | null
          trigger_sentiment: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_excerpt?: Json
          created_at?: string
          id?: string
          notified_admins?: boolean
          notified_email?: boolean
          status?: string
          trigger_intent?: string | null
          trigger_sentiment: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_excerpt?: Json
          created_at?: string
          id?: string
          notified_admins?: boolean
          notified_email?: boolean
          status?: string
          trigger_intent?: string | null
          trigger_sentiment?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_concierge_usage: {
        Row: {
          completion_tokens: number
          created_at: string
          id: string
          intent: string | null
          message_count: number | null
          model: string
          project_id: string | null
          prompt_tokens: number
          sentiment: string | null
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          id?: string
          intent?: string | null
          message_count?: number | null
          model: string
          project_id?: string | null
          prompt_tokens?: number
          sentiment?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          id?: string
          intent?: string | null
          message_count?: number | null
          model?: string
          project_id?: string | null
          prompt_tokens?: number
          sentiment?: string | null
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      trade_credits: {
        Row: {
          amount_cents: number
          applied_at: string | null
          applied_to_quote_id: string | null
          created_at: string
          currency: string
          id: string
          source: string
          source_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          applied_to_quote_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          source: string
          source_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          applied_to_quote_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          source?: string
          source_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_custom_request_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          changes: Json
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string
          changes?: Json
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          changes?: Json
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_custom_request_activity_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "trade_custom_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_custom_requests: {
        Row: {
          admin_notes: string | null
          brand_name: string | null
          budget_notes: string | null
          com_col_fabric: string | null
          com_yardage_meters: number | null
          created_at: string
          dimension_changes: string | null
          finish_notes: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          project_id: string | null
          quantity: number
          request_type: string
          status: string
          studio_id: string | null
          target_lead_weeks: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          brand_name?: string | null
          budget_notes?: string | null
          com_col_fabric?: string | null
          com_yardage_meters?: number | null
          created_at?: string
          dimension_changes?: string | null
          finish_notes?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          project_id?: string | null
          quantity?: number
          request_type?: string
          status?: string
          studio_id?: string | null
          target_lead_weeks?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          brand_name?: string | null
          budget_notes?: string | null
          com_col_fabric?: string | null
          com_yardage_meters?: number | null
          created_at?: string
          dimension_changes?: string | null
          finish_notes?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          project_id?: string | null
          quantity?: number
          request_type?: string
          status?: string
          studio_id?: string | null
          target_lead_weeks?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_custom_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_custom_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_custom_requests_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
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
          is_featured_public: boolean
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
          is_featured_public?: boolean
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
          is_featured_public?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      trade_fair_events: {
        Row: {
          brands_exhibiting: string[] | null
          category: string
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          ends_on: string
          id: string
          is_published: boolean
          name: string
          slug: string
          starts_on: string
          updated_at: string
          venue: string | null
          website_url: string | null
        }
        Insert: {
          brands_exhibiting?: string[] | null
          category?: string
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_on: string
          id?: string
          is_published?: boolean
          name: string
          slug: string
          starts_on: string
          updated_at?: string
          venue?: string | null
          website_url?: string | null
        }
        Update: {
          brands_exhibiting?: string[] | null
          category?: string
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          ends_on?: string
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          starts_on?: string
          updated_at?: string
          venue?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      trade_favorites: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "trade_products"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_floor_plan_layouts: {
        Row: {
          created_at: string
          id: string
          layout: Json
          name: string
          plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          name?: string
          plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          name?: string
          plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_floor_plan_layouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trade_floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_floor_plans: {
        Row: {
          brief: Json
          created_at: string
          id: string
          name: string
          notes: string | null
          plan_image_url: string
          suggestions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_image_url: string
          suggestions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_image_url?: string
          suggestions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_product_cad_assets: {
        Row: {
          created_at: string
          file_format: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
          uploaded_by: string | null
          variant_label: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          file_format: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
          uploaded_by?: string | null
          variant_label?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          file_format?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
          uploaded_by?: string | null
          variant_label?: string | null
          version?: string | null
        }
        Relationships: []
      }
      trade_product_pricing: {
        Row: {
          pick_id: string
          price_per_sqm_cents: number | null
          trade_price_cents: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          pick_id: string
          price_per_sqm_cents?: number | null
          trade_price_cents?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          pick_id?: string
          price_per_sqm_cents?: number | null
          trade_price_cents?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_product_pricing_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: true
            referencedRelation: "designer_curator_picks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_product_pricing_pick_id_fkey"
            columns: ["pick_id"]
            isOneToOne: true
            referencedRelation: "designer_curator_picks_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_products: {
        Row: {
          brand_name: string
          category: string
          created_at: string
          currency: string
          default_ship_mode: string | null
          description: string | null
          dimensions: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_source_hash: string | null
          gallery_images: string[] | null
          glb_url: string | null
          hs_code: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_hidden: boolean
          lead_time: string | null
          lead_weeks_max_override: number | null
          lead_weeks_min_override: number | null
          materials: string | null
          materials_description: string | null
          origin: string | null
          pack_carton_count: number | null
          pack_cbm: number | null
          pack_weight_kg: number | null
          pickup_address: string | null
          pickup_country: string | null
          pickup_postcode: string | null
          price_per_sqm_cents: number | null
          price_prefix: string | null
          price_unit: string
          product_name: string
          rrp_price_cents: number | null
          sku: string | null
          spec_sheet_url: string | null
          stock_status_override: string | null
          subcategory: string | null
          trade_price_cents: number | null
          updated_at: string
        }
        Insert: {
          brand_name: string
          category?: string
          created_at?: string
          currency?: string
          default_ship_mode?: string | null
          description?: string | null
          dimensions?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          gallery_images?: string[] | null
          glb_url?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_hidden?: boolean
          lead_time?: string | null
          lead_weeks_max_override?: number | null
          lead_weeks_min_override?: number | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_per_sqm_cents?: number | null
          price_prefix?: string | null
          price_unit?: string
          product_name: string
          rrp_price_cents?: number | null
          sku?: string | null
          spec_sheet_url?: string | null
          stock_status_override?: string | null
          subcategory?: string | null
          trade_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          brand_name?: string
          category?: string
          created_at?: string
          currency?: string
          default_ship_mode?: string | null
          description?: string | null
          dimensions?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_source_hash?: string | null
          gallery_images?: string[] | null
          glb_url?: string | null
          hs_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_hidden?: boolean
          lead_time?: string | null
          lead_weeks_max_override?: number | null
          lead_weeks_min_override?: number | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_per_sqm_cents?: number | null
          price_prefix?: string | null
          price_unit?: string
          product_name?: string
          rrp_price_cents?: number | null
          sku?: string | null
          spec_sheet_url?: string | null
          stock_status_override?: string | null
          subcategory?: string | null
          trade_price_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      trade_quote_extras: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          label: string
          quote_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          label: string
          quote_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          label?: string
          quote_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_quote_extras_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "trade_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_quote_items: {
        Row: {
          axonometric_image_url: string | null
          cost_code: string | null
          created_at: string
          deposit_pct_override: number | null
          id: string
          internal_notes: string | null
          lead_time_weeks_override: number | null
          notes: string | null
          po_number: string | null
          product_id: string
          quantity: number
          quote_id: string
          room: string | null
          ship_cbm: number | null
          ship_mode: string | null
          ship_origin_country: string | null
          ship_weight_kg: number | null
          unit_price_cents: number | null
          variant_label: string | null
        }
        Insert: {
          axonometric_image_url?: string | null
          cost_code?: string | null
          created_at?: string
          deposit_pct_override?: number | null
          id?: string
          internal_notes?: string | null
          lead_time_weeks_override?: number | null
          notes?: string | null
          po_number?: string | null
          product_id: string
          quantity?: number
          quote_id: string
          room?: string | null
          ship_cbm?: number | null
          ship_mode?: string | null
          ship_origin_country?: string | null
          ship_weight_kg?: number | null
          unit_price_cents?: number | null
          variant_label?: string | null
        }
        Update: {
          axonometric_image_url?: string | null
          cost_code?: string | null
          created_at?: string
          deposit_pct_override?: number | null
          id?: string
          internal_notes?: string | null
          lead_time_weeks_override?: number | null
          notes?: string | null
          po_number?: string | null
          product_id?: string
          quantity?: number
          quote_id?: string
          room?: string | null
          ship_cbm?: number | null
          ship_mode?: string | null
          ship_origin_country?: string | null
          ship_weight_kg?: number | null
          unit_price_cents?: number | null
          variant_label?: string | null
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
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          client_id: string | null
          client_name: string | null
          commission_pct: number | null
          confirmed_at: string | null
          created_at: string
          credit_applied_cents: number
          currency: string
          designer_payout_account_id: string | null
          end_client_billing: Json | null
          id: string
          incoterm: string | null
          insurance_enabled: boolean
          insurance_notes: string | null
          insurance_rate_bps: number
          insurance_tier: string
          issue_date: string | null
          landed_cost_cbm: number | null
          landed_cost_kg: number | null
          landed_cost_mode: string
          net_discount_pct: number | null
          notes: string | null
          payer_type: Database["public"]["Enums"]["payer_type"]
          project_id: string | null
          resale_certificate_id: string | null
          responded_at: string | null
          ship_to_address1: string | null
          ship_to_address2: string | null
          ship_to_attention: string | null
          ship_to_city: string | null
          ship_to_country: string | null
          ship_to_email: string | null
          ship_to_name: string | null
          ship_to_notes: string | null
          ship_to_phone: string | null
          ship_to_postal_code: string | null
          ship_to_same_as_bill: boolean
          ship_to_state: string | null
          status: string
          studio_id: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          client_id?: string | null
          client_name?: string | null
          commission_pct?: number | null
          confirmed_at?: string | null
          created_at?: string
          credit_applied_cents?: number
          currency?: string
          designer_payout_account_id?: string | null
          end_client_billing?: Json | null
          id?: string
          incoterm?: string | null
          insurance_enabled?: boolean
          insurance_notes?: string | null
          insurance_rate_bps?: number
          insurance_tier?: string
          issue_date?: string | null
          landed_cost_cbm?: number | null
          landed_cost_kg?: number | null
          landed_cost_mode?: string
          net_discount_pct?: number | null
          notes?: string | null
          payer_type?: Database["public"]["Enums"]["payer_type"]
          project_id?: string | null
          resale_certificate_id?: string | null
          responded_at?: string | null
          ship_to_address1?: string | null
          ship_to_address2?: string | null
          ship_to_attention?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_email?: string | null
          ship_to_name?: string | null
          ship_to_notes?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_same_as_bill?: boolean
          ship_to_state?: string | null
          status?: string
          studio_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          client_id?: string | null
          client_name?: string | null
          commission_pct?: number | null
          confirmed_at?: string | null
          created_at?: string
          credit_applied_cents?: number
          currency?: string
          designer_payout_account_id?: string | null
          end_client_billing?: Json | null
          id?: string
          incoterm?: string | null
          insurance_enabled?: boolean
          insurance_notes?: string | null
          insurance_rate_bps?: number
          insurance_tier?: string
          issue_date?: string | null
          landed_cost_cbm?: number | null
          landed_cost_kg?: number | null
          landed_cost_mode?: string
          net_discount_pct?: number | null
          notes?: string | null
          payer_type?: Database["public"]["Enums"]["payer_type"]
          project_id?: string | null
          resale_certificate_id?: string | null
          responded_at?: string | null
          ship_to_address1?: string | null
          ship_to_address2?: string | null
          ship_to_attention?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_email?: string | null
          ship_to_name?: string | null
          ship_to_notes?: string | null
          ship_to_phone?: string | null
          ship_to_postal_code?: string | null
          ship_to_same_as_bill?: boolean
          ship_to_state?: string | null
          status?: string
          studio_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quotes_designer_payout_account_id_fkey"
            columns: ["designer_payout_account_id"]
            isOneToOne: false
            referencedRelation: "studio_payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quotes_resale_certificate_id_fkey"
            columns: ["resale_certificate_id"]
            isOneToOne: false
            referencedRelation: "studio_resale_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_quotes_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_recent_views: {
        Row: {
          brand_name: string | null
          category: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          brand_name?: string | null
          category?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          brand_name?: string | null
          category?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          user_id?: string
          viewed_at?: string
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
          tearsheet_url: string | null
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
          tearsheet_url?: string | null
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
          tearsheet_url?: string | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_tier_config: {
        Row: {
          discount_pct: number
          label: string
          min_spend_cents: number
          tier: Database["public"]["Enums"]["trade_tier"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          discount_pct: number
          label: string
          min_spend_cents?: number
          tier: Database["public"]["Enums"]["trade_tier"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          discount_pct?: number
          label?: string
          min_spend_cents?: number
          tier?: Database["public"]["Enums"]["trade_tier"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trade_user_memory: {
        Row: {
          created_at: string
          default_budget_cents: number | null
          default_currency: string | null
          default_deadline: string | null
          last_brief_summary: string | null
          preferred_categories: string[]
          preferred_designers: string[]
          preferred_lead_weeks_max: number | null
          preferred_materials: string[]
          source: string
          studio_style_notes: string | null
          style_tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_budget_cents?: number | null
          default_currency?: string | null
          default_deadline?: string | null
          last_brief_summary?: string | null
          preferred_categories?: string[]
          preferred_designers?: string[]
          preferred_lead_weeks_max?: number | null
          preferred_materials?: string[]
          source?: string
          studio_style_notes?: string | null
          style_tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_budget_cents?: number | null
          default_currency?: string | null
          default_deadline?: string | null
          last_brief_summary?: string | null
          preferred_categories?: string[]
          preferred_designers?: string[]
          preferred_lead_weeks_max?: number | null
          preferred_materials?: string[]
          source?: string
          studio_style_notes?: string | null
          style_tags?: string[]
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
      video_watch_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          progress_percent: number | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          video_id: string
          watch_duration_seconds: number | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          progress_percent?: number | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          video_id?: string
          watch_duration_seconds?: number | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          progress_percent?: number | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          video_id?: string
          watch_duration_seconds?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      designer_curator_picks_public: {
        Row: {
          base_axis_label: string | null
          category: string | null
          created_at: string | null
          currency: string | null
          default_ship_mode: string | null
          description: string | null
          designer_id: string | null
          dimensions: string | null
          edition: string | null
          edition_number: string | null
          edition_signing: string | null
          gallery_captions: Json | null
          gallery_images: string[] | null
          hover_image_url: string | null
          id: string | null
          image_url: string | null
          is_hidden: boolean | null
          lead_time: string | null
          materials: string | null
          materials_description: string | null
          origin: string | null
          pack_carton_count: number | null
          pack_cbm: number | null
          pack_weight_kg: number | null
          pdf_filename: string | null
          pdf_url: string | null
          pdf_urls: Json | null
          photo_credit: string | null
          pickup_address: string | null
          pickup_country: string | null
          pickup_postcode: string | null
          price_prefix: string | null
          size_variants: Json | null
          sort_order: number | null
          subcategory: string | null
          subtitle: string | null
          tags: string[] | null
          title: string | null
          top_axis_label: string | null
          variant_image_map: Json | null
          variant_placeholder: string | null
        }
        Insert: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          default_ship_mode?: string | null
          description?: string | null
          designer_id?: string | null
          dimensions?: string | null
          edition?: string | null
          edition_number?: string | null
          edition_signing?: string | null
          gallery_captions?: Json | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string | null
          image_url?: string | null
          is_hidden?: boolean | null
          lead_time?: string | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number | null
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          top_axis_label?: string | null
          variant_image_map?: Json | null
          variant_placeholder?: string | null
        }
        Update: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          default_ship_mode?: string | null
          description?: string | null
          designer_id?: string | null
          dimensions?: string | null
          edition?: string | null
          edition_number?: string | null
          edition_signing?: string | null
          gallery_captions?: Json | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string | null
          image_url?: string | null
          is_hidden?: boolean | null
          lead_time?: string | null
          materials?: string | null
          materials_description?: string | null
          origin?: string | null
          pack_carton_count?: number | null
          pack_cbm?: number | null
          pack_weight_kg?: number | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          pickup_address?: string | null
          pickup_country?: string | null
          pickup_postcode?: string | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number | null
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          top_axis_label?: string | null
          variant_image_map?: Json | null
          variant_placeholder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designer_curator_picks_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "designers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_board_comment_by_token: {
        Args: {
          _author_name?: string
          _board_id: string
          _content: string
          _is_client?: boolean
          _item_id?: string
          _token: string
        }
        Returns: string
      }
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
      admin_ai_usage_summary: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      admin_onboarding_stats: {
        Args: never
        Returns: {
          completed: number
          pending: number
          total_users: number
        }[]
      }
      admin_reset_onboarding_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      apply_available_credit_to_quote: {
        Args: { _quote_id: string }
        Returns: number
      }
      can_edit_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_studio: {
        Args: { _studio_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_studio: {
        Args: { _studio_id: string; _user_id: string }
        Returns: boolean
      }
      concierge_check_rate_limit: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: {
          allowed: boolean
          retry_in: number
        }[]
      }
      current_trade_discount_pct: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      effective_product_availability: {
        Args: { _product_id: string }
        Returns: {
          lead_weeks_max: number
          lead_weeks_min: number
          source: string
          stock_status: string
        }[]
      }
      effective_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["studio_role"]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_board_by_token: {
        Args: { _token: string }
        Returns: {
          client_name: string
          hide_maison_branding: boolean
          id: string
          status: string
          studio_logo_url: string
          studio_name: string
          title: string
        }[]
      }
      get_board_comments_by_token: {
        Args: { _token: string }
        Returns: {
          author_name: string
          board_id: string
          content: string
          created_at: string
          id: string
          is_client: boolean
          item_id: string
        }[]
      }
      get_board_items_by_token: {
        Args: { _token: string }
        Returns: {
          board_id: string
          created_at: string
          id: string
          notes: string
          product_id: string
          sort_order: number
        }[]
      }
      get_brand_engagement_users: {
        Args: { _brand_name: string; _since: string }
        Returns: {
          board_items: number
          company: string
          email: string
          first_name: string
          last_name: string
          quote_lines: number
          source: string
          user_id: string
        }[]
      }
      get_cron_jobs_summary: {
        Args: never
        Returns: {
          jobname: string
          last_duration_ms: number
          last_run_at: string
          last_status: string
          rows_30d: number
          rows_7d: number
          rows_label: string
          schedule: string
        }[]
      }
      get_cron_run_history: {
        Args: { _limit?: number }
        Returns: {
          duration_ms: number
          end_time: string
          http_status_code: number
          jobname: string
          return_message: string
          schedule: string
          start_time: string
          status: string
        }[]
      }
      get_designer_engagement: {
        Args: { _since: string }
        Returns: {
          board_items: number
          board_users: number
          brand_name: string
          quote_lines: number
          quote_users: number
        }[]
      }
      get_recent_scrape_failures: {
        Args: { since_minutes?: number }
        Returns: {
          body: string
          created: string
          id: number
          status_code: number
        }[]
      }
      get_user_studio_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_studio_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["studio_role"]
          _studio_id: string
          _user_id: string
        }
        Returns: boolean
      }
      invoke_scrape_products_with_retry: { Args: never; Returns: undefined }
      is_client_trade_approved: {
        Args: { _client_id: string }
        Returns: {
          application_status: string
          approved: boolean
          contact_email: string
        }[]
      }
      is_studio_owner: {
        Args: { _studio_id: string; _user_id: string }
        Returns: boolean
      }
      log_public_download_event: {
        Args: {
          _country?: string
          _document_id?: string
          _document_label?: string
          _source?: string
        }
        Returns: string
      }
      match_catalog: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          category: string
          designer: string
          id: string
          materials: string
          similarity: number
          source: string
          subcategory: string
          title: string
        }[]
      }
      match_semantic_cache: {
        Args: {
          _feature: string
          _limit?: number
          _model: string
          _query_embedding: string
          _threshold?: number
        }
        Returns: {
          completion_tokens: number
          id: string
          prompt: string
          prompt_tokens: number
          response_json: Json
          similarity: number
        }[]
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
      notify_admins_production_render: {
        Args: {
          _engine: string
          _render_title: string
          _requester_name: string
        }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_trade_tier_suggestions: { Args: never; Returns: number }
      record_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip?: string
          _source: string
          _user_id?: string
        }
        Returns: string
      }
      rotate_board_token: { Args: { _board_id: string }; Returns: string }
      sanitize_biography_citations: { Args: { input: string }; Returns: string }
      scan_sec_query: { Args: { _sql: string }; Returns: Json[] }
      studio_has_resale_cert_for_state: {
        Args: { _state: string; _studio_id: string }
        Returns: boolean
      }
      tier_discount_pct: {
        Args: { _tier: Database["public"]["Enums"]["trade_tier"] }
        Returns: number
      }
      update_item_approval_by_token: {
        Args: { _approval_status: string; _item_id: string; _token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "trade_user" | "super_admin"
      axonometric_request_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
      billing_mode: "agent_commission" | "net_buy"
      client_document_storage: "link" | "upload"
      client_document_type:
        | "nda"
        | "terms"
        | "counterparty"
        | "kyc"
        | "contract"
        | "other"
      client_type: "company" | "studio" | "individual"
      journal_category:
        | "designer_interview"
        | "collection_story"
        | "design_trend"
        | "project_showcase"
        | "international_editorial"
      payer_type: "end_client" | "designer_firm"
      pipeline_status:
        | "idea"
        | "planning"
        | "drafting"
        | "review"
        | "ready"
        | "published"
        | "killed"
      sample_request_status:
        | "requested"
        | "approved"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      studio_role: "owner" | "admin" | "editor" | "viewer"
      trade_application_status: "pending" | "approved" | "rejected"
      trade_tier: "standard" | "silver" | "gold" | "platinum"
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
      billing_mode: ["agent_commission", "net_buy"],
      client_document_storage: ["link", "upload"],
      client_document_type: [
        "nda",
        "terms",
        "counterparty",
        "kyc",
        "contract",
        "other",
      ],
      client_type: ["company", "studio", "individual"],
      journal_category: [
        "designer_interview",
        "collection_story",
        "design_trend",
        "project_showcase",
        "international_editorial",
      ],
      payer_type: ["end_client", "designer_firm"],
      pipeline_status: [
        "idea",
        "planning",
        "drafting",
        "review",
        "ready",
        "published",
        "killed",
      ],
      sample_request_status: [
        "requested",
        "approved",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      studio_role: ["owner", "admin", "editor", "viewer"],
      trade_application_status: ["pending", "approved", "rejected"],
      trade_tier: ["standard", "silver", "gold", "platinum"],
    },
  },
} as const
