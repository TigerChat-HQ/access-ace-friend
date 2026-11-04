CREATE OR REPLACE FUNCTION public.commit_draft_move(p_id uuid,p_revision integer,p_board jsonb,p_turn text,p_move jsonb,p_status text,p_winner text) RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE m public.draft_matches;
BEGIN
 UPDATE public.draft_matches SET board=p_board,current_turn=p_turn,last_move=p_move,status=p_status,winner=p_winner,revision=revision+1,updated_at=now() WHERE id=p_id AND revision=p_revision AND status='active' RETURNING * INTO m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match changed; refresh before moving'; END IF;
 RETURN m;
END $fn$;
REVOKE ALL ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.resign_draft_match(p_id uuid) RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE m public.draft_matches;
BEGIN
 UPDATE public.draft_matches SET status='finished',winner=CASE WHEN player_white=auth.uid() THEN 'black' ELSE 'white' END,revision=revision+1,updated_at=now() WHERE id=p_id AND status='active' AND auth.uid() IN (player_white,player_black) RETURNING * INTO m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cannot resign this match'; END IF; RETURN m;
END $fn$;
REVOKE ALL ON FUNCTION public.resign_draft_match(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resign_draft_match(uuid) TO authenticated,service_role;
CREATE TABLE public.dev_code_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES public.dev_tasks(id),path text NOT NULL,base_sha text NOT NULL,original text NOT NULL,proposed text NOT NULL,summary text NOT NULL,security jsonb NOT NULL DEFAULT '{}'::jsonb,status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','applying','applied','failed')),branch text,pr_url text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.dev_code_proposals TO authenticated;
GRANT ALL ON public.dev_code_proposals TO service_role;
ALTER TABLE public.dev_code_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read code proposals" ON public.dev_code_proposals FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
CREATE OR REPLACE FUNCTION public.audit_dev_proposal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
BEGIN INSERT INTO public.dev_audit_log(task_id,actor,action,details) VALUES(NEW.task_id,NEW.created_by::text,'code:'||NEW.status,jsonb_build_object('proposal_id',NEW.id,'path',NEW.path,'branch',NEW.branch,'pr_url',NEW.pr_url)); RETURN NEW; END $fn$;
CREATE TRIGGER audit_dev_proposal_changes AFTER INSERT OR UPDATE ON public.dev_code_proposals FOR EACH ROW EXECUTE FUNCTION public.audit_dev_proposal();