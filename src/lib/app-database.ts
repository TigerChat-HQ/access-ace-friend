import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

// Source-migration contracts for features not yet included in generated types.
// This does not provision tables or establish that a connected database has them.
type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type MigrationTables = {
  story_comments: Table<{
    id: string; story_id: string; user_id: string; content: string; created_at: string;
  }, "story_id" | "user_id" | "content">;
  draughts_admin_settings: Table<{
    id: boolean; seasons_enabled: boolean; tiger_ai_supervisor_enabled: boolean;
    updated_at: string; updated_by: string | null;
  }, never>;
  draughts_badge_types: Table<{
    id: string; badge_name: string; emoji: string; description: string;
    award_rule: string; threshold: number; is_enabled: boolean; created_at: string;
  }, "badge_name" | "award_rule">;
  draughts_seasons: Table<{
    id: string; name: string; starts_at: string; ends_at: string | null;
    is_active: boolean; created_at: string;
  }, "name">;
  draughts_player_stats: Table<{
    season_id: string; user_id: string; rating_points: number; wins: number;
    losses: number; draws: number; updated_at: string;
  }, "season_id" | "user_id">;
  draughts_player_badges: Table<{
    id: string; season_id: string; user_id: string; rank: number | null;
    badge_name: string; show_on_profile: boolean; awarded_at: string;
    badge_type_id: string | null;
  }, "season_id" | "user_id", [{
    foreignKeyName: "draughts_player_badges_badge_type_id_fkey";
    columns: ["badge_type_id"];
    isOneToOne: false;
    referencedRelation: "draughts_badge_types";
    referencedColumns: ["id"];
  }]>;
};

type AppDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], keyof MigrationTables> & MigrationTables;
    Functions: Database["public"]["Functions"] & {
      close_draughts_season: {
        Args: { p_season_id?: string | null };
        Returns: Json;
      };
    };
  };
};

// Reuse the generated client's connection, auth, and RLS; never open a second client.
export const appDatabase = supabase as unknown as SupabaseClient<AppDatabase>;