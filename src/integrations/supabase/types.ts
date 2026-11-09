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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      tiger_ai_daily_posts: {
        Row: { id: string; date_key: string; title: string; content: Json; source_urls: string[]; created_at: string }
        Insert: { id?: string; date_key: string; title: string; content: Json; source_urls?: string[]; created_at?: string }
        Update: { id?: string; date_key?: string; title?: string; content?: Json; source_urls?: string[]; created_at?: string }
        Relationships: []
      }
      tiger_ai_daily_post_likes: {
        Row: { created_at: string; post_id: string; user_id: string }
        Insert: { created_at?: string; post_id: string; user_id: string }
        Update: { created_at?: string; post_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "tiger_ai_daily_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tiger_ai_daily_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tiger_ai_daily_comments: {
        Row: {
          ai_liked: boolean
          body: string
          created_at: string
          id: string
          is_tiger_ai: boolean
          parent_id: string | null
          post_id: string
          user_id: string | null
        }
        Insert: {
          ai_liked?: boolean
          body: string
          created_at?: string
          id?: string
          is_tiger_ai?: boolean
          parent_id?: string | null
          post_id: string
          user_id?: string | null
        }
        Update: {
          ai_liked?: boolean
          body?: string
          created_at?: string
          id?: string
          is_tiger_ai?: boolean
          parent_id?: string | null
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiger_ai_daily_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tiger_ai_daily_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiger_ai_daily_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tiger_ai_daily_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tiger_ai_daily_comment_likes: {
        Row: { comment_id: string; created_at: string; user_id: string }
        Insert: { comment_id: string; created_at?: string; user_id: string }
        Update: { comment_id?: string; created_at?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "tiger_ai_daily_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "tiger_ai_daily_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          media_type: string | null
          media_url: string | null
          priority: string
          starts_at: string
          title: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          priority?: string
          starts_at?: string
          title: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          priority?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string | null
          duration_seconds: number
          ended_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          conversation_id?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          conversation_id?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string | null
          created_at: string
          id: string
          signal_data: Json
          signal_type: string
          status: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          signal_data?: Json
          signal_type: string
          status?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          signal_data?: Json
          signal_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_preferences: {
        Row: {
          bubble_color: string | null
          conversation_id: string
          font_size: string | null
          id: string
          theme: string | null
          updated_at: string
          user_id: string
          wallpaper: string | null
        }
        Insert: {
          bubble_color?: string | null
          conversation_id: string
          font_size?: string | null
          id?: string
          theme?: string | null
          updated_at?: string
          user_id: string
          wallpaper?: string | null
        }
        Update: {
          bubble_color?: string | null
          conversation_id?: string
          font_size?: string | null
          id?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
          wallpaper?: string | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string | null
          requires_approval: boolean
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          requires_approval?: boolean
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          requires_approval?: boolean
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dev_audit_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: Json | null
          id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          details?: Json | null
          id?: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: Json | null
          id?: string
          task_id?: string | null
        }
        Relationships: []
      }
      dev_code_proposals: {
        Row: {
          base_sha: string
          branch: string | null
          created_at: string
          created_by: string
          id: string
          original: string
          path: string
          pr_url: string | null
          proposed: string
          security: Json
          status: string
          summary: string
          task_id: string
        }
        Insert: {
          base_sha: string
          branch?: string | null
          created_at?: string
          created_by: string
          id?: string
          original: string
          path: string
          pr_url?: string | null
          proposed: string
          security?: Json
          status?: string
          summary: string
          task_id: string
        }
        Update: {
          base_sha?: string
          branch?: string | null
          created_at?: string
          created_by?: string
          id?: string
          original?: string
          path?: string
          pr_url?: string | null
          proposed?: string
          security?: Json
          status?: string
          summary?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_code_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_tasks: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          plan: Json | null
          priority: string
          risk: string
          source_report_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          plan?: Json | null
          priority?: string
          risk?: string
          source_report_id?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          plan?: Json | null
          priority?: string
          risk?: string
          source_report_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      draft_matches: {
        Row: {
          board: Json
          created_at: string
          draw_offer_by: string | null
          current_turn: string
          id: string
          join_code: string
          last_move: Json | null
          player_black: string | null
          player_white: string
          revision: number
          status: string
          updated_at: string
          vs_ai: boolean
          winner: string | null
        }
        Insert: {
          board: Json
          created_at?: string
          draw_offer_by?: string | null
          current_turn?: string
          id?: string
          join_code?: string
          last_move?: Json | null
          player_black?: string | null
          player_white: string
          revision?: number
          status?: string
          updated_at?: string
          vs_ai?: boolean
          winner?: string | null
        }
        Update: {
          board?: Json
          created_at?: string
          draw_offer_by?: string | null
          current_turn?: string
          id?: string
          join_code?: string
          last_move?: Json | null
          player_black?: string | null
          player_white?: string
          revision?: number
          status?: string
          updated_at?: string
          vs_ai?: boolean
          winner?: string | null
        }
        Relationships: []
      }
      draughts_admin_settings: {
        Row: { id: boolean; seasons_enabled: boolean; tiger_ai_supervisor_enabled: boolean; updated_at: string; updated_by: string | null }
        Insert: { id?: boolean; seasons_enabled?: boolean; tiger_ai_supervisor_enabled?: boolean; updated_at?: string; updated_by?: string | null }
        Update: { id?: boolean; seasons_enabled?: boolean; tiger_ai_supervisor_enabled?: boolean; updated_at?: string; updated_by?: string | null }
        Relationships: []
      }
      draughts_badge_types: {
        Row: { id: string; badge_name: string; emoji: string; description: string; award_rule: string; threshold: number; is_enabled: boolean; created_at: string }
        Insert: { id?: string; badge_name: string; emoji?: string; description?: string; award_rule: string; threshold?: number; is_enabled?: boolean; created_at?: string }
        Update: { id?: string; badge_name?: string; emoji?: string; description?: string; award_rule?: string; threshold?: number; is_enabled?: boolean; created_at?: string }
        Relationships: []
      }
      draughts_seasons: {
        Row: { id: string; name: string; starts_at: string; ends_at: string | null; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; starts_at?: string; ends_at?: string | null; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; starts_at?: string; ends_at?: string | null; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      draughts_player_stats: {
        Row: { season_id: string; user_id: string; rating_points: number; wins: number; losses: number; draws: number; updated_at: string }
        Insert: { season_id: string; user_id: string; rating_points?: number; wins?: number; losses?: number; draws?: number; updated_at?: string }
        Update: { season_id?: string; user_id?: string; rating_points?: number; wins?: number; losses?: number; draws?: number; updated_at?: string }
        Relationships: []
      }
      draughts_player_badges: {
        Row: { id: string; season_id: string; user_id: string; rank: number | null; badge_name: string; badge_type_id: string | null; show_on_profile: boolean; awarded_at: string }
        Insert: { id?: string; season_id: string; user_id: string; rank?: number | null; badge_name?: string; badge_type_id?: string | null; show_on_profile?: boolean; awarded_at?: string }
        Update: { id?: string; season_id?: string; user_id?: string; rank?: number | null; badge_name?: string; badge_type_id?: string | null; show_on_profile?: boolean; awarded_at?: string }
        Relationships: [{ foreignKeyName: "draughts_player_badges_badge_type_id_fkey"; columns: ["badge_type_id"]; isOneToOne: false; referencedRelation: "draughts_badge_types"; referencedColumns: ["id"] }]
      }
      draughts_match_results: {
        Row: { match_id: string; season_id: string; player_white: string; player_black: string; winner: string; white_points: number; black_points: number; completed_at: string }
        Insert: { match_id: string; season_id: string; player_white: string; player_black: string; winner: string; white_points: number; black_points: number; completed_at?: string }
        Update: { match_id?: string; season_id?: string; player_white?: string; player_black?: string; winner?: string; white_points?: number; black_points?: number; completed_at?: string }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      game_attempts: {
        Row: {
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          score: number
          total_questions: number
          trophy_tier: string | null
          user_id: string
        }
        Insert: {
          correct_count: number
          created_at?: string
          duration_seconds?: number
          id?: string
          score: number
          total_questions: number
          trophy_tier?: string | null
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          score?: number
          total_questions?: number
          trophy_tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_questions: {
        Row: {
          category: string
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          question: string
        }
        Insert: {
          category?: string
          correct_index: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options: Json
          question: string
        }
        Update: {
          category?: string
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
        }
        Relationships: []
      }
      group_admins: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      group_join_requests: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          id: string
          is_edited: boolean
          edited_at: string | null
          is_read: boolean | null
          media_url: string | null
          message_status: string
          message_type: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
          status_context: Json | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_edited?: boolean
          edited_at?: string | null
          is_read?: boolean | null
          media_url?: string | null
          message_status?: string
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
          status_context?: Json | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_edited?: boolean
          edited_at?: string | null
          is_read?: boolean | null
          media_url?: string | null
          message_status?: string
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
          status_context?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          post_id: string | null
          recipient_id: string
          report_id: string | null
          type: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          recipient_id: string
          report_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string | null
          recipient_id?: string
          report_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_bootstrap: {
        Row: {
          owner_user_id: string | null
          singleton: boolean
        }
        Insert: {
          owner_user_id?: string | null
          singleton?: boolean
        }
        Update: {
          owner_user_id?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          hashtags: string[] | null
          id: string
          media_type: string
          media_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          media_type?: string
          media_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          media_type?: string
          media_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_online: boolean | null
          is_private: boolean
          last_seen: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          is_private?: boolean
          last_seen?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          is_private?: boolean
          last_seen?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      quiz_question_history: {
        Row: {
          created_at: string
          id: string
          question: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_reply: string | null
          admin_reply_at: string | null
          admin_reply_media_url: string | null
          contact_subject: string | null
          created_at: string
          id: string
          reason: string
          replied_by: string | null
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_media_url?: string | null
          contact_subject?: string | null
          created_at?: string
          id?: string
          reason: string
          replied_by?: string | null
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          admin_reply_media_url?: string | null
          contact_subject?: string | null
          created_at?: string
          id?: string
          reason?: string
          replied_by?: string | null
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          audience: string
          background_color: string | null
          caption: string | null
          created_at: string | null
          duration: number | null
          expires_at: string
          id: string
          image_url: string | null
          media_type: string
          music_url: string | null
          text_overlay: Json | null
          user_id: string
        }
        Insert: {
          audience?: string
          background_color?: string | null
          caption?: string | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string
          id?: string
          image_url?: string | null
          media_type?: string
          music_url?: string | null
          text_overlay?: Json | null
          user_id: string
        }
        Update: {
          audience?: string
          background_color?: string | null
          caption?: string | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string
          id?: string
          image_url?: string | null
          media_type?: string
          music_url?: string | null
          text_overlay?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      trophies: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          min_score: number
          name: string
          tier: string
        }
        Insert: {
          color: string
          created_at?: string
          icon: string
          id?: string
          min_score: number
          name: string
          tier: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          min_score?: number
          name?: string
          tier?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_trophies: {
        Row: {
          attempt_id: string | null
          awarded_at: string
          id: string
          trophy_tier: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          awarded_at?: string
          id?: string
          trophy_tier: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          awarded_at?: string
          id?: string
          trophy_tier?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      trending_posts: {
        Row: {
          comment_count: number | null
          created_at: string | null
          id: string | null
          like_count: number | null
          score: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      commit_draft_move: {
        Args: {
          p_board: Json
          p_id: string
          p_move: Json
          p_revision: number
          p_status: string
          p_turn: string
          p_winner: string
        }
        Returns: {
          board: Json
          created_at: string
          current_turn: string
          id: string
          join_code: string
          last_move: Json | null
          player_black: string | null
          player_white: string
          revision: number
          status: string
          updated_at: string
          vs_ai: boolean
          winner: string | null
        }
        SetofOptions: {
          from: "*"
          to: "draft_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_direct_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      create_draft_match: {
        Args: { p_vs_ai?: boolean }
        Returns: {
          board: Json
          created_at: string
          current_turn: string
          id: string
          join_code: string
          last_move: Json | null
          player_black: string | null
          player_white: string
          revision: number
          status: string
          updated_at: string
          vs_ai: boolean
          winner: string | null
        }
        SetofOptions: {
          from: "*"
          to: "draft_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group_conversation: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
      }
      accept_draft_draw: {
        Args: { p_id: string }
        Returns: Database["public"]["Tables"]["draft_matches"]["Row"]
      }
      offer_draft_draw: {
        Args: { p_id: string }
        Returns: Database["public"]["Tables"]["draft_matches"]["Row"]
      }
      draughts_division: { Args: { p_points: number }; Returns: string }
      close_draughts_season: { Args: { p_season_id?: string }; Returns: Json }
      ensure_admin_super_group: { Args: never; Returns: string }
      set_admin_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      join_draft_match: {
        Args: { p_code?: string; p_match_id?: string }
        Returns: {
          board: Json
          created_at: string
          current_turn: string
          id: string
          join_code: string
          last_move: Json | null
          player_black: string | null
          player_white: string
          revision: number
          status: string
          updated_at: string
          vs_ai: boolean
          winner: string | null
        }
        SetofOptions: {
          from: "*"
          to: "draft_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reply_to_report: {
        Args: { _media_url?: string; _reply: string; _report_id: string }
        Returns: undefined
      }
      reply_to_status: {
        Args: { p_content: string; p_story_id: string }
        Returns: string
      }
      resign_draft_match: {
        Args: { p_id: string }
        Returns: {
          board: Json
          created_at: string
          current_turn: string
          id: string
          join_code: string
          last_move: Json | null
          player_black: string | null
          player_white: string
          revision: number
          status: string
          updated_at: string
          vs_ai: boolean
          winner: string | null
        }
        SetofOptions: {
          from: "*"
          to: "draft_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_contact_message: {
        Args: { _message: string; _subject: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "adviser" | "superior_admin"
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
      app_role: ["admin", "moderator", "user", "adviser", "superior_admin"],
    },
  },
} as const
