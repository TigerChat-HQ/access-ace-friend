-- Games Arena expansion foundation: additive schema only.
-- No client can write match results, balances, or queue pairing state directly.
-- Trusted RPC/server handlers must own those transitions before features are enabled.

ALTER TABLE public.draft_matches
  ADD COLUMN IF NOT EXISTS initial_clock_seconds integer CHECK (initial_clock_seconds BETWEEN 30 AND 7200),
  ADD COLUMN IF NOT EXISTS increment_seconds integer NOT NULL DEFAULT 0 CHECK (increment_seconds BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS white_clock_ms bigint CHECK (white_clock_ms >= 0),
  ADD COLUMN IF NOT EXISTS black_clock_ms bigint CHECK (black_clock_ms >= 0),
  ADD COLUMN IF NOT EXISTS clock_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_white_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_black_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS rematch_of uuid REFERENCES public.draft_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spectator_delay_seconds integer NOT NULL DEFAULT 30 CHECK (spectator_delay_seconds BETWEEN 0 AND 300),
  ADD COLUMN IF NOT EXISTS allow_spectators boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.draughts_match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  clock_seconds integer NOT NULL DEFAULT 600 CHECK (clock_seconds BETWEEN 30 AND 7200),
  increment_seconds integer NOT NULL DEFAULT 0 CHECK (increment_seconds BETWEEN 0 AND 60),
  region text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','matched','cancelled','expired')),
  match_id uuid REFERENCES public.draft_matches(id) ON DELETE SET NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
);
CREATE UNIQUE INDEX IF NOT EXISTS draughts_queue_one_active_per_user
  ON public.draughts_match_queue(user_id) WHERE status='queued';
CREATE INDEX IF NOT EXISTS draughts_queue_pairing_idx
  ON public.draughts_match_queue(status, clock_seconds, queued_at)
  WHERE status='queued';

CREATE TABLE IF NOT EXISTS public.draughts_friend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_seconds integer NOT NULL DEFAULT 600 CHECK (clock_seconds BETWEEN 30 AND 7200),
  increment_seconds integer NOT NULL DEFAULT 0 CHECK (increment_seconds BETWEEN 0 AND 60),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  match_id uuid REFERENCES public.draft_matches(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_id <> challenged_id)
);
CREATE INDEX IF NOT EXISTS draughts_challenges_inbox_idx
  ON public.draughts_friend_challenges(challenged_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.draughts_match_emotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.draft_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emote_key text NOT NULL CHECK (emote_key IN ('gg','well_played','thinking','wow','oops','clap','tiger','laugh')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draughts_emotes_match_time_idx
  ON public.draughts_match_emotes(match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.draughts_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 32),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.draughts_club_members (
  club_id uuid NOT NULL REFERENCES public.draughts_clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(club_id,user_id)
);
CREATE INDEX IF NOT EXISTS draughts_club_members_user_idx ON public.draughts_club_members(user_id);

CREATE TABLE IF NOT EXISTS public.draughts_cosmetics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cosmetic_key text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('board','piece','avatar_frame','emote_pack')),
  price_coins integer NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.draughts_user_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id uuid NOT NULL REFERENCES public.draughts_cosmetics(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  equipped boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,cosmetic_id)
);

-- Pool state is intentionally separated from Draughts so its wallet and rules cannot mix.
CREATE TABLE IF NOT EXISTS public.pool_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_one uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  player_two uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('practice','eight_ball','nine_ball')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','paused','finished','abandoned')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  current_turn uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clock_seconds integer CHECK (clock_seconds BETWEEN 30 AND 7200),
  player_one_clock_ms bigint CHECK (player_one_clock_ms >= 0),
  player_two_clock_ms bigint CHECK (player_two_clock_ms >= 0),
  clock_started_at timestamptz,
  last_player_one_seen_at timestamptz,
  last_player_two_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_two IS NULL OR player_two <> player_one),
  CHECK (winner_id IS NULL OR winner_id IN (player_one,player_two))
);
CREATE INDEX IF NOT EXISTS pool_matches_public_lobby_idx
  ON public.pool_matches(status,created_at DESC) WHERE visibility='public';
CREATE TABLE IF NOT EXISTS public.pool_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.pool_matches(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('shot','foul','turn','pause','resume','result','chat_emote')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,revision)
);
CREATE INDEX IF NOT EXISTS pool_events_replay_idx ON public.pool_match_events(match_id,revision);

CREATE TABLE IF NOT EXISTS public.pool_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pool_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('match','mission','achievement','tournament','admin')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_type,source_id,reason)
);
CREATE TABLE IF NOT EXISTS public.pool_cosmetics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cosmetic_key text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('cue','table_cloth','ball_set','avatar_frame')),
  price_coins integer NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  is_enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.pool_user_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id uuid NOT NULL REFERENCES public.pool_cosmetics(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  equipped boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,cosmetic_id)
);

-- Enable RLS on every exposed table added here.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'draughts_match_queue','draughts_friend_challenges','draughts_match_emotes',
    'draughts_clubs','draughts_club_members','draughts_cosmetics','draughts_user_cosmetics',
    'pool_matches','pool_match_events','pool_wallets','pool_coin_ledger','pool_cosmetics','pool_user_cosmetics'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

-- Queue rows are visible and cancellable only by their owner; pairing must use trusted server logic.
CREATE POLICY "Queue owner reads own entry" ON public.draughts_match_queue
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Queue owner inserts own entry" ON public.draughts_match_queue
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id AND status='queued');
CREATE POLICY "Queue owner cancels own entry" ON public.draughts_match_queue
  FOR UPDATE TO authenticated USING ((select auth.uid())=user_id)
  WITH CHECK ((select auth.uid())=user_id AND status IN ('queued','cancelled'));

CREATE POLICY "Challenge participants read" ON public.draughts_friend_challenges
  FOR SELECT TO authenticated USING ((select auth.uid()) IN (challenger_id,challenged_id));
CREATE POLICY "Challenge sender creates" ON public.draughts_friend_challenges
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=challenger_id AND status='pending');
CREATE POLICY "Challenge recipient responds" ON public.draughts_friend_challenges
  FOR UPDATE TO authenticated USING ((select auth.uid())=challenged_id)
  WITH CHECK ((select auth.uid())=challenged_id AND status IN ('accepted','declined'));

CREATE POLICY "Match participants read emotes" ON public.draughts_match_emotes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.draft_matches m WHERE m.id=match_id
      AND (m.player_white=(select auth.uid()) OR m.player_black=(select auth.uid()))
  ));
CREATE POLICY "Participants send emotes" ON public.draughts_match_emotes
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id AND EXISTS (
    SELECT 1 FROM public.draft_matches m WHERE m.id=match_id AND m.status='active'
      AND (m.player_white=(select auth.uid()) OR m.player_black=(select auth.uid()))
  ));

CREATE POLICY "Public clubs and members readable" ON public.draughts_clubs
  FOR SELECT TO authenticated USING (is_public OR owner_id=(select auth.uid()));
CREATE POLICY "Public club member lists readable" ON public.draughts_club_members
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.draughts_clubs c WHERE c.id=club_id AND c.is_public
  ) OR (select auth.uid())=user_id);
CREATE POLICY "Cosmetic catalog readable" ON public.draughts_cosmetics
  FOR SELECT TO authenticated USING (is_enabled);
CREATE POLICY "Own Draughts inventory readable" ON public.draughts_user_cosmetics
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);

CREATE POLICY "Pool participants read matches" ON public.pool_matches
  FOR SELECT TO authenticated USING (
    player_one=(select auth.uid()) OR player_two=(select auth.uid()) OR (visibility='public' AND status IN ('active','finished'))
  );
CREATE POLICY "Pool participants read replay events" ON public.pool_match_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.pool_matches m WHERE m.id=match_id
      AND (m.player_one=(select auth.uid()) OR m.player_two=(select auth.uid()) OR (m.visibility='public' AND m.status='finished'))
  ));
CREATE POLICY "Pool wallet owner reads" ON public.pool_wallets
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Pool ledger owner reads" ON public.pool_coin_ledger
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY "Pool cosmetics catalog readable" ON public.pool_cosmetics
  FOR SELECT TO authenticated USING (is_enabled);
CREATE POLICY "Own Pool inventory readable" ON public.pool_user_cosmetics
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);

-- No direct client mutation of money, pool state, replay, or inventory.
REVOKE INSERT, UPDATE, DELETE ON public.draughts_match_queue, public.draughts_friend_challenges,
  public.draughts_match_emotes, public.draughts_clubs, public.draughts_club_members,
  public.draughts_user_cosmetics, public.pool_matches, public.pool_match_events,
  public.pool_wallets, public.pool_coin_ledger, public.pool_user_cosmetics
  FROM anon, authenticated;
GRANT SELECT ON public.draughts_match_queue, public.draughts_friend_challenges,
  public.draughts_match_emotes, public.draughts_clubs, public.draughts_club_members,
  public.draughts_cosmetics, public.draughts_user_cosmetics, public.pool_matches,
  public.pool_match_events, public.pool_wallets, public.pool_coin_ledger,
  public.pool_cosmetics, public.pool_user_cosmetics TO authenticated;
