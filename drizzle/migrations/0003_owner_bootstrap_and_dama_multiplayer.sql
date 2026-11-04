CREATE TABLE public.owner_bootstrap (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), owner_user_id uuid);
GRANT ALL ON public.owner_bootstrap TO service_role;
ALTER TABLE public.owner_bootstrap ENABLE ROW LEVEL SECURITY;
INSERT INTO public.owner_bootstrap(singleton,owner_user_id) SELECT true,user_id FROM public.profiles ORDER BY created_at,id LIMIT 1;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE base_username text; candidate text; suffix int := 0; claimed uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(730194,1);
 base_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username',NEW.raw_user_meta_data->>'display_name',split_part(NEW.email,'@',1)),'[^a-zA-Z0-9_]','','g'));
 IF base_username='' OR base_username IS NULL THEN base_username:='user'||substr(NEW.id::text,1,8); END IF;
 candidate:=base_username;
 WHILE EXISTS(SELECT 1 FROM public.profiles WHERE username=candidate) LOOP suffix:=suffix+1; candidate:=base_username||suffix::text; END LOOP;
 INSERT INTO public.profiles(user_id,display_name,username) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'display_name',split_part(NEW.email,'@',1)),candidate);
 INSERT INTO public.owner_bootstrap(singleton,owner_user_id) VALUES(true,NEW.id) ON CONFLICT(singleton) DO NOTHING RETURNING owner_user_id INTO claimed;
 IF claimed=NEW.id THEN INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin'),(NEW.id,'superior_admin') ON CONFLICT(user_id,role) DO NOTHING; END IF;
 RETURN NEW;
END $fn$;
ALTER TABLE public.draft_matches ADD COLUMN join_code text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
CREATE UNIQUE INDEX draft_matches_join_code_unique ON public.draft_matches(join_code);
ALTER TABLE public.draft_matches ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.join_draft_match(p_match_id uuid DEFAULT NULL,p_code text DEFAULT NULL) RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE m public.draft_matches;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join a match'; END IF;
 IF p_match_id IS NULL AND (p_code IS NULL OR p_code !~ '^[A-Za-z0-9]{8}$') THEN RAISE EXCEPTION 'Enter the complete 8-character match code'; END IF;
 SELECT * INTO m FROM public.draft_matches WHERE (p_match_id IS NOT NULL AND id=p_match_id) OR (p_match_id IS NULL AND join_code=upper(p_code)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.player_white=auth.uid() OR m.player_black=auth.uid() THEN RETURN m; END IF;
 IF m.vs_ai OR m.status<>'waiting' OR m.player_black IS NOT NULL THEN RAISE EXCEPTION 'This match is no longer available'; END IF;
 UPDATE public.draft_matches SET player_black=auth.uid(),status='active',revision=revision+1,updated_at=now() WHERE id=m.id RETURNING * INTO m;
 RETURN m;
END $fn$;
REVOKE ALL ON FUNCTION public.join_draft_match(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_draft_match(uuid,text) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.draft_matches FROM authenticated;
CREATE OR REPLACE FUNCTION public.create_draft_match(p_vs_ai boolean DEFAULT false) RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE m public.draft_matches; b jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to play'; END IF;
 SELECT jsonb_agg(CASE WHEN (i/8+i%8)%2=0 THEN 'null'::jsonb WHEN i/8<3 THEN jsonb_build_object('c','b','k',false) WHEN i/8>4 THEN jsonb_build_object('c','w','k',false) ELSE 'null'::jsonb END ORDER BY i) INTO b FROM generate_series(0,63) i;
 INSERT INTO public.draft_matches(player_white,vs_ai,board,current_turn,status) VALUES(auth.uid(),p_vs_ai,b,'w',CASE WHEN p_vs_ai THEN 'active' ELSE 'waiting' END) RETURNING * INTO m;
 RETURN m;
END $fn$;
REVOKE ALL ON FUNCTION public.create_draft_match(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_draft_match(boolean) TO authenticated,service_role;