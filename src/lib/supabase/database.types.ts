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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_ip_hash: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          profile_id: string | null
          resource_id: string | null
          resource_type: string | null
          result: string | null
          severity: string | null
        }
        Insert: {
          action: string
          actor_ip_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          result?: string | null
          severity?: string | null
        }
        Update: {
          action?: string
          actor_ip_hash?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          result?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_clicks: {
        Row: {
          block_id: string
          browser: string | null
          city: string | null
          click_date: string | null
          clicked_at: string
          country: string | null
          device_type: string | null
          id: string
          ip_hash: string | null
          is_hosting: boolean
          is_vpn: boolean
          os: string | null
          profile_id: string
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          block_id: string
          browser?: string | null
          city?: string | null
          click_date?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          is_hosting?: boolean
          is_vpn?: boolean
          os?: string | null
          profile_id: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          block_id?: string
          browser?: string | null
          city?: string | null
          click_date?: string | null
          clicked_at?: string
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          is_hosting?: boolean
          is_vpn?: boolean
          os?: string | null
          profile_id?: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_clicks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_clicks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean | null
          position: number
          profile_id: string
          thumbnail: string | null
          title: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          position?: number
          profile_id: string
          thumbnail?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          position?: number
          profile_id?: string
          thumbnail?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cause_banners: {
        Row: {
          color: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          label: string
          link: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          link?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          link?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          action: string | null
          analytics: boolean
          consent_text_version: string | null
          consented_at: string
          id: string
          ip_hash: string | null
          profile_id: string
          source: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          analytics?: boolean
          consent_text_version?: string | null
          consented_at?: string
          id?: string
          ip_hash?: string | null
          profile_id: string
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          analytics?: boolean
          consent_text_version?: string | null
          consented_at?: string
          id?: string
          ip_hash?: string | null
          profile_id?: string
          source?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          score: number
          source: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          score: number
          source?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          score?: number
          source?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_requests: {
        Row: {
          id: string
          ip_hash: string | null
          notes: string | null
          processed_at: string | null
          profile_id: string
          requested_at: string
          status: string
          type: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          notes?: string | null
          processed_at?: string | null
          profile_id: string
          requested_at?: string
          status?: string
          type: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          notes?: string | null
          processed_at?: string | null
          profile_id?: string
          requested_at?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          message: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          message: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          message?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          id: string
          impact: string
          resolved_at: string | null
          services: string[]
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact?: string
          resolved_at?: string | null
          services?: string[]
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          impact?: string
          resolved_at?: string | null
          services?: string[]
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string | null
          auto_reply_config: Json | null
          auto_reply_enabled: boolean | null
          connected_at: string | null
          id: string
          meta: Json | null
          profile_id: string
          provider: string
          provider_avatar: string | null
          provider_user_id: string | null
          provider_username: string | null
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          auto_reply_config?: Json | null
          auto_reply_enabled?: boolean | null
          connected_at?: string | null
          id?: string
          meta?: Json | null
          profile_id: string
          provider: string
          provider_avatar?: string | null
          provider_user_id?: string | null
          provider_username?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          auto_reply_config?: Json | null
          auto_reply_enabled?: boolean | null
          connected_at?: string | null
          id?: string
          meta?: Json | null
          profile_id?: string
          provider?: string
          provider_avatar?: string | null
          provider_user_id?: string | null
          provider_username?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          icon: string | null
          id: number
          is_read: boolean
          meta: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          icon?: string | null
          id?: number
          is_read?: boolean
          meta?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          icon?: string | null
          id?: number
          is_read?: boolean
          meta?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          advanced_analytics: boolean
          ai_posts: boolean | null
          api_access: boolean
          auto_reply: boolean | null
          created_at: string
          custom_domain: boolean
          integrations_count: number | null
          link_shortener: boolean | null
          live_auto_update: boolean
          max_blocks_total: number | null
          max_premium_blocks: number | null
          monthly_price_cents: number
          plan: string
          remove_branding: boolean
          short_links_count: number | null
          social_posts_monthly: number | null
          stats_retention_days: number | null
          unlimited_blocks: boolean
          updated_at: string
        }
        Insert: {
          advanced_analytics?: boolean
          ai_posts?: boolean | null
          api_access?: boolean
          auto_reply?: boolean | null
          created_at?: string
          custom_domain?: boolean
          integrations_count?: number | null
          link_shortener?: boolean | null
          live_auto_update?: boolean
          max_blocks_total?: number | null
          max_premium_blocks?: number | null
          monthly_price_cents: number
          plan: string
          remove_branding?: boolean
          short_links_count?: number | null
          social_posts_monthly?: number | null
          stats_retention_days?: number | null
          unlimited_blocks?: boolean
          updated_at?: string
        }
        Update: {
          advanced_analytics?: boolean
          ai_posts?: boolean | null
          api_access?: boolean
          auto_reply?: boolean | null
          created_at?: string
          custom_domain?: boolean
          integrations_count?: number | null
          link_shortener?: boolean | null
          live_auto_update?: boolean
          max_blocks_total?: number | null
          max_premium_blocks?: number | null
          monthly_price_cents?: number
          plan?: string
          remove_branding?: boolean
          short_links_count?: number | null
          social_posts_monthly?: number | null
          stats_retention_days?: number | null
          unlimited_blocks?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_hash: string | null
          is_hosting: boolean
          is_vpn: boolean
          os: string | null
          profile_id: string
          referrer: string | null
          referrer_full: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          view_date: string | null
          viewed_at: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          is_hosting?: boolean
          is_vpn?: boolean
          os?: string | null
          profile_id: string
          referrer?: string | null
          referrer_full?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          view_date?: string | null
          viewed_at?: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_hash?: string | null
          is_hosting?: boolean
          is_vpn?: boolean
          os?: string | null
          profile_id?: string
          referrer?: string | null
          referrer_full?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          view_date?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cause_banners: string[] | null
          created_at: string
          custom_causes: Json | null
          custom_domain: string | null
          data_region: string
          deleted_at: string | null
          display_name: string | null
          features: Json
          gdpr_anonymized_at: string | null
          gdpr_delete_requested_at: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          kick_username: string | null
          live_metadata: Json
          onboarding_completed_at: string | null
          onboarding_feedback: Json | null
          plan: string
          plan_expires_at: string | null
          platform_stats: Json
          seo_description: string | null
          seo_keywords: string[] | null
          stripe_customer_id: string | null
          subscription_status: string
          theme: Json
          tiktok_username: string | null
          twitch_username: string | null
          updated_at: string
          username: string
          youtube_handle: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cause_banners?: string[] | null
          created_at?: string
          custom_causes?: Json | null
          custom_domain?: string | null
          data_region?: string
          deleted_at?: string | null
          display_name?: string | null
          features?: Json
          gdpr_anonymized_at?: string | null
          gdpr_delete_requested_at?: string | null
          id: string
          is_active?: boolean
          is_verified?: boolean
          kick_username?: string | null
          live_metadata?: Json
          onboarding_completed_at?: string | null
          onboarding_feedback?: Json | null
          plan?: string
          plan_expires_at?: string | null
          platform_stats?: Json
          seo_description?: string | null
          seo_keywords?: string[] | null
          stripe_customer_id?: string | null
          subscription_status?: string
          theme?: Json
          tiktok_username?: string | null
          twitch_username?: string | null
          updated_at?: string
          username: string
          youtube_handle?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cause_banners?: string[] | null
          created_at?: string
          custom_causes?: Json | null
          custom_domain?: string | null
          data_region?: string
          deleted_at?: string | null
          display_name?: string | null
          features?: Json
          gdpr_anonymized_at?: string | null
          gdpr_delete_requested_at?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          kick_username?: string | null
          live_metadata?: Json
          onboarding_completed_at?: string | null
          onboarding_feedback?: Json | null
          plan?: string
          plan_expires_at?: string | null
          platform_stats?: Json
          seo_description?: string | null
          seo_keywords?: string[] | null
          stripe_customer_id?: string | null
          subscription_status?: string
          theme?: Json
          tiktok_username?: string | null
          twitch_username?: string | null
          updated_at?: string
          username?: string
          youtube_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plan_limits"
            referencedColumns: ["plan"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          reset_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at?: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          priority: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          visible: boolean
          vote_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id: string
          priority?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          visible?: boolean
          vote_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          visible?: boolean
          vote_count?: number
        }
        Relationships: []
      }
      roadmap_suggestions: {
        Row: {
          admin_note: string | null
          category: string | null
          created_at: string
          description: string | null
          id: number
          profile_id: string
          status: string
          title: string
          updated_at: string
          username: string | null
        }
        Insert: {
          admin_note?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: number
          profile_id: string
          status?: string
          title: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          admin_note?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: number
          profile_id?: string
          status?: string
          title?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_suggestions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_votes: {
        Row: {
          created_at: string
          id: number
          item_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          item_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_status: {
        Row: {
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      short_link_clicks: {
        Row: {
          clicked_at: string | null
          country: string | null
          id: string
          ip_hash: string | null
          link_id: string
          referrer: string | null
          ua: string | null
        }
        Insert: {
          clicked_at?: string | null
          country?: string | null
          id?: string
          ip_hash?: string | null
          link_id: string
          referrer?: string | null
          ua?: string | null
        }
        Update: {
          clicked_at?: string | null
          country?: string | null
          id?: string
          ip_hash?: string | null
          link_id?: string
          referrer?: string | null
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          clicks: number | null
          code: string
          created_at: string | null
          destination: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          profile_id: string
          title: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          clicks?: number | null
          code: string
          created_at?: string | null
          destination: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          profile_id: string
          title?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          clicks?: number | null
          code?: string
          created_at?: string | null
          destination?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          profile_id?: string
          title?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          ai_generated: boolean | null
          ai_prompt: string | null
          content: string
          created_at: string | null
          engagement: Json | null
          hashtags: string[] | null
          id: string
          media_urls: string[] | null
          platform_post_ids: Json | null
          platforms: string[]
          profile_id: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          ai_prompt?: string | null
          content: string
          created_at?: string | null
          engagement?: Json | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          platform_post_ids?: Json | null
          platforms?: string[]
          profile_id: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          ai_prompt?: string | null
          content?: string
          created_at?: string | null
          engagement?: Json | null
          hashtags?: string[] | null
          id?: string
          media_urls?: string[] | null
          platform_post_ids?: Json | null
          platforms?: string[]
          profile_id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string
          id: string
          interval: string | null
          metadata: Json | null
          price_id: string | null
          profile_id: string
          status: string
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id: string
          id: string
          interval?: string | null
          metadata?: Json | null
          price_id?: string | null
          profile_id: string
          status: string
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string
          id?: string
          interval?: string | null
          metadata?: Json | null
          price_id?: string | null
          profile_id?: string
          status?: string
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string | null
          device_type: string | null
          id: string
          ip: string | null
          last_seen: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          last_seen?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          last_seen?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_daily_block_clicks: {
        Row: {
          block_id: string | null
          breakdowns: Json | null
          clicks: number | null
          date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_clicks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_daily_profile_views: {
        Row: {
          breakdowns: Json | null
          date: string | null
          profile_id: string | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_country_breakdown_30d: {
        Row: {
          country: string | null
          profile_id: string | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_profile_views_30d: {
        Row: {
          clean_views: number | null
          desktop: number | null
          mobile: number | null
          profile_id: string | null
          tablet: number | null
          unique_ips: number | null
          view_date: string | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_blocks_30d: {
        Row: {
          block_id: string | null
          clicks: number | null
          profile_id: string | null
          title: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_clicks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_clicks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_referrers_30d: {
        Row: {
          hits: number | null
          profile_id: string | null
          referrer: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_old_analytics: { Args: never; Returns: undefined }
      can_add_block: { Args: { p_profile_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window: string }
        Returns: boolean
      }
      create_milestone_notif: {
        Args: {
          p_body: string
          p_href?: string
          p_icon?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      gdpr_delete_profile: { Args: { p_profile_id: string }; Returns: Json }
      gdpr_export_profile: { Args: { p_profile_id: string }; Returns: Json }
      get_creator_dashboard: {
        Args: never
        Returns: {
          id: string
          monthly_price_cents: number
          plan: string
          tiktok_fyp_views: number
          tiktok_live_views: number
          tiktok_username: string
          total_views: number
          twitch_panel_views: number
          twitch_raid_views: number
          twitch_username: string
          username: string
        }[]
      }
      get_landing_stats: { Args: never; Returns: Json }
      get_profile_analytics: {
        Args: { p_days?: number; p_profile_id: string }
        Returns: Json
      }
      increment_block_click: {
        Args: { p_block_id: string }
        Returns: undefined
      }
      increment_block_clicks: {
        Args: { p_block_id: string; p_date: string }
        Returns: undefined
      }
      increment_link_click: { Args: { p_block_id: string }; Returns: undefined }
      increment_link_clicks: { Args: { p_code: string }; Returns: undefined }
      increment_profile_view: {
        Args: { p_source?: string; p_username: string }
        Returns: undefined
      }
      increment_profile_views: {
        Args: { p_date: string; p_profile_id: string }
        Returns: undefined
      }
      is_username_taken: { Args: { p_username: string }; Returns: boolean }
      purge_expired_analytics: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
    Enums: {},
  },
} as const
