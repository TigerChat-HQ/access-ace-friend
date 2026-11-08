-- Admin-only Draughts season controls, custom badge awards and Tiger AI supervision.
CREATE TABLE IF NOT EXISTS public.draughts_admin_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 seasons_enabled boolean NOT NULL DEFAULT true,
 tiger_ai_supervisor_enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.draughts_admin_settings(id,seasons_enabled,tiger_ai_supervisor_enabled)
VALUES(true,true,true) ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.draughts_badge_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 badge_name text NOT NULL UNIQUE,
 emoji text NOT NULL DEFAULT '🏅',
 description text NOT NULL DEFAULT '',
 award_rule text NOT NULL CHECK(award_rule IN('top_n','wins','rating','participation')),
 threshold integer NOT NULL DEFAULT 1 CHECK(threshold>=1),
 is_enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.draughts_player_badges
 ADD COLUMN IF NOT EXISTS badge_type_id uuid REFERENCES public.draughts_badge_types(id) ON DELETE SET NULL;
ALTER TABLE public.draughts_player_badges ALTER COLUMN rank DROP NOT NULL;
ALTER TABLE public.draughts_player_badges DROP CONSTRAINT IF EXISTS draughts_player_badges_season_id_user_id_key;
ALTER TABLE public.draughts_player_badges DROP CONSTRAINT IF EXISTS draughts_player_badges_season_id_rank_key;
CREATE UNIQUE INDEX IF NOT EXISTS draughts_player_badges_type_unique
 ON public.draughts_player_badges(season_id,user_id,badge_type_id) WHERE badge_type_id IS NOT NULL;

INSERT INTO public.draughts_badge_types(badge_name,emoji,description,award_rule,threshold,is_enabled) VALUES
 ('Season Champion','🏆','Finish the season in first place','top_n',1,true),
 ('Elite Top 10','🥇','Finish the season among the top ten players','top_n',10,true),
 ('Top Player','🏅','Finish the season among the top 100 players','top_n',100,true),
 ('Winning Star','🔥','Win at least 10 rated online games this season','wins',10,true),
 ('Draughts Veteran','🎖️','Complete at least 20 rated online games this season','participation',20,true),
 ('Master Rating','💎','Reach at least 700 rating points this season','rating',700,true)
ON CONFLICT(badge_name) DO NOTHING;

ALTER TABLE public.draughts_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_badge_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Draughts admin settings readable" ON public.draughts_admin_settings;
CREATE POLICY "Draughts admin settings readable" ON public.draughts_admin_settings FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Only admins manage Draughts settings" ON public.draughts_admin_settings;
CREATE POLICY "Only admins manage Draughts settings" ON public.draughts_admin_settings FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role::text IN('admin','superior_admin')))
 WITH CHECK(EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role::text IN('admin','superior_admin')));
DROP POLICY IF EXISTS "Draughts badge catalog is readable" ON public.draughts_badge_types;
CREATE POLICY "Draughts badge catalog is readable" ON public.draughts_badge_types FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Only admins manage Draughts badge catalog" ON public.draughts_badge_types;
CREATE POLICY "Only admins manage Draughts badge catalog" ON public.draughts_badge_types FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role::text IN('admin','superior_admin')))
 WITH CHECK(EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role::text IN('admin','superior_admin')));
GRANT SELECT ON public.draughts_admin_settings,public.draughts_badge_types TO authenticated;
GRANT UPDATE(seasons_enabled,tiger_ai_supervisor_enabled,updated_at,updated_by) ON public.draughts_admin_settings TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.draughts_badge_types TO authenticated;

CREATE OR REPLACE FUNCTION public.close_draughts_season(p_season_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_season public.draughts_seasons%ROWTYPE; v_awards integer:=0; v_next integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(select auth.uid()) AND role::text IN('admin','superior_admin')) THEN
  RAISE EXCEPTION 'Only administrators can close a Draughts season';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.draughts_admin_settings WHERE id=true AND seasons_enabled=true) THEN
  RAISE EXCEPTION 'Draughts season management is disabled by an administrator';
 END IF;
 SELECT * INTO v_season FROM public.draughts_seasons WHERE is_active AND (p_season_id IS NULL OR id=p_season_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No active Draughts season found'; END IF;
 INSERT INTO public.draughts_player_badges(season_id,user_id,rank,badge_name,badge_type_id)
 SELECT v_season.id,e.user_id,least(e.pos,100),bt.badge_name,bt.id
 FROM public.draughts_badge_types bt
 CROSS JOIN LATERAL (
  SELECT s.user_id,row_number() OVER(ORDER BY s.rating_points DESC,s.wins DESC,s.losses ASC,s.updated_at ASC) pos,
   s.rating_points,s.wins,
   coalesce((SELECT count(*) FROM public.draughts_match_results mr WHERE mr.season_id=v_season.id AND (mr.player_white=s.user_id OR mr.player_black=s.user_id)),0) played
  FROM public.draughts_player_stats s WHERE s.season_id=v_season.id
 ) e
 WHERE bt.is_enabled AND ((bt.award_rule='top_n' AND e.pos<=bt.threshold) OR (bt.award_rule='wins' AND e.wins>=bt.threshold)
  OR (bt.award_rule='rating' AND e.rating_points>=bt.threshold) OR (bt.award_rule='participation' AND e.played>=bt.threshold))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_awards=ROW_COUNT;
 UPDATE public.draughts_seasons SET is_active=false,ends_at=now() WHERE id=v_season.id;
 SELECT coalesce(max(substring(name from '[0-9]+')::integer),1)+1 INTO v_next FROM public.draughts_seasons;
 INSERT INTO public.draughts_seasons(name,starts_at) VALUES('Season '||v_next,now());
 RETURN jsonb_build_object('closed_season',v_season.id,'badges_awarded',v_awards);
END;
$fn$;
REVOKE ALL ON FUNCTION public.close_draughts_season(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_draughts_season(uuid) TO authenticated;

DO $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='draughts_admin_settings') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.draughts_admin_settings;
 END IF;
END;
$fn$;
