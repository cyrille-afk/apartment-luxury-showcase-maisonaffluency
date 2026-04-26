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
      designer_curator_picks: {
        Row: {
          base_axis_label: string | null
          category: string | null
          created_at: string
          currency: string
          description: string | null
          designer_id: string
          dimensions: string | null
          edition: string | null
          gallery_images: string[] | null
          hover_image_url: string | null
          id: string
          image_url: string
          lead_time: string | null
          materials: string | null
          origin: string | null
          pdf_filename: string | null
          pdf_url: string | null
          pdf_urls: Json | null
          photo_credit: string | null
          price_prefix: string | null
          size_variants: Json | null
          sort_order: number
          subcategory: string | null
          subtitle: string | null
          tags: string[] | null
          title: string
          top_axis_label: string | null
          trade_price_cents: number | null
          variant_placeholder: string | null
        }
        Insert: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          designer_id: string
          dimensions?: string | null
          edition?: string | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string
          image_url?: string
          lead_time?: string | null
          materials?: string | null
          origin?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          top_axis_label?: string | null
          trade_price_cents?: number | null
          variant_placeholder?: string | null
        }
        Update: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          designer_id?: string
          dimensions?: string | null
          edition?: string | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string
          image_url?: string
          lead_time?: string | null
          materials?: string | null
          origin?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          price_prefix?: string | null
          size_variants?: Json | null
          sort_order?: number
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          top_axis_label?: string | null
          trade_price_cents?: number | null
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
          title?: string
          type?: string
          user_id?: string
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
          kanban_status: string
          production_end_at: string | null
          production_start_at: string | null
          production_weeks: number
          project_id: string | null
          quote_id: string
          shipping_end_at: string | null
          shipping_start_at: string | null
          shipping_weeks: number
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
          kanban_status?: string
          production_end_at?: string | null
          production_start_at?: string | null
          production_weeks?: number
          project_id?: string | null
          quote_id: string
          shipping_end_at?: string | null
          shipping_start_at?: string | null
          shipping_weeks?: number
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
          kanban_status?: string
          production_end_at?: string | null
          production_start_at?: string | null
          production_weeks?: number
          project_id?: string | null
          quote_id?: string
          shipping_end_at?: string | null
          shipping_start_at?: string | null
          shipping_weeks?: number
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
          trade_tier: Database["public"]["Enums"]["trade_tier"]
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
          trade_tier?: Database["public"]["Enums"]["trade_tier"]
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
          trade_tier?: Database["public"]["Enums"]["trade_tier"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_name: string
          color: string
          cover_image_url: string | null
          created_at: string
          id: string
          location: string
          name: string
          notes: string | null
          status: string
          target_completion_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          location?: string
          name?: string
          notes?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          color?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          location?: string
          name?: string
          notes?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
          user_id?: string
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
          origin: string | null
          price_prefix: string | null
          price_unit: string
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
          origin?: string | null
          price_prefix?: string | null
          price_unit?: string
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
          origin?: string | null
          price_prefix?: string | null
          price_unit?: string
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          responded_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          description: string | null
          designer_id: string | null
          dimensions: string | null
          edition: string | null
          gallery_images: string[] | null
          hover_image_url: string | null
          id: string | null
          image_url: string | null
          lead_time: string | null
          materials: string | null
          origin: string | null
          pdf_filename: string | null
          pdf_url: string | null
          pdf_urls: Json | null
          photo_credit: string | null
          size_variants: Json | null
          sort_order: number | null
          subcategory: string | null
          subtitle: string | null
          tags: string[] | null
          title: string | null
          top_axis_label: string | null
          variant_placeholder: string | null
        }
        Insert: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          designer_id?: string | null
          dimensions?: string | null
          edition?: string | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string | null
          image_url?: string | null
          lead_time?: string | null
          materials?: string | null
          origin?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          size_variants?: Json | null
          sort_order?: number | null
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          top_axis_label?: string | null
          variant_placeholder?: string | null
        }
        Update: {
          base_axis_label?: string | null
          category?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          designer_id?: string | null
          dimensions?: string | null
          edition?: string | null
          gallery_images?: string[] | null
          hover_image_url?: string | null
          id?: string | null
          image_url?: string | null
          lead_time?: string | null
          materials?: string | null
          origin?: string | null
          pdf_filename?: string | null
          pdf_url?: string | null
          pdf_urls?: Json | null
          photo_credit?: string | null
          size_variants?: Json | null
          sort_order?: number | null
          subcategory?: string | null
          subtitle?: string | null
          tags?: string[] | null
          title?: string | null
          top_axis_label?: string | null
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
      current_trade_discount_pct: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
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
          client_email: string | null
          client_name: string
          created_at: string
          hide_maison_branding: boolean
          id: string
          project_id: string | null
          share_token: string
          status: string
          studio_logo_url: string | null
          studio_name: string | null
          title: string
          token_expires_at: string | null
          token_rotated_at: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "client_boards"
          isOneToOne: false
          isSetofReturn: true
        }
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
          item_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "client_board_comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_board_items_by_token: {
        Args: { _token: string }
        Returns: {
          approval_status: string
          board_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          sort_order: number
          subfolder: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "client_board_items"
          isOneToOne: false
          isSetofReturn: true
        }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      rotate_board_token: { Args: { _board_id: string }; Returns: string }
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
      journal_category:
        | "designer_interview"
        | "collection_story"
        | "design_trend"
        | "project_showcase"
        | "international_editorial"
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
      trade_application_status: "pending" | "approved" | "rejected"
      trade_tier: "standard" | "silver" | "gold"
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
      trade_application_status: ["pending", "approved", "rejected"],
      trade_tier: ["standard", "silver", "gold"],
    },
  },
} as const
