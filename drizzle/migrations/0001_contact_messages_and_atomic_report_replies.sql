ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contact_subject text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES public.reports(id);
ALTER TABLE public.reports DROP CONSTRAINT reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status IN ('pending','reviewed','dismissed','resolved'));
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('like','comment','follow','mention','reply','comment_like','report_reply'));
CREATE OR REPLACE FUNCTION public.send_contact_message(_subject text, _message text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to contact admin'; END IF;
 IF _subject IS NULL OR length(btrim(_subject)) NOT BETWEEN 1 AND 100 OR _message IS NULL OR length(btrim(_message)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Subject and message are required (100 and 4000 characters maximum)'; END IF;
 INSERT INTO public.reports(reporter_id,target_type,target_id,reason,contact_subject) VALUES(auth.uid(),'feedback',auth.uid(),btrim(_message),btrim(_subject)) RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.send_contact_message(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_message(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.reply_to_report(_report_id uuid, _reply text, _media_url text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recipient uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin') OR public.has_role(auth.uid(),'moderator')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF _reply IS NULL OR length(btrim(_reply)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Reply must contain 1 to 4000 characters'; END IF;
 IF _media_url IS NOT NULL AND (length(_media_url)>2048 OR _media_url !~ '^https://[^[:space:]]+$') THEN RAISE EXCEPTION 'Invalid media URL'; END IF;
 SELECT reporter_id INTO recipient FROM public.reports WHERE id=_report_id FOR UPDATE;
 IF recipient IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
 UPDATE public.reports SET admin_reply=btrim(_reply),admin_reply_media_url=_media_url,admin_reply_at=now(),replied_by=auth.uid(),status='resolved' WHERE id=_report_id;
 INSERT INTO public.notifications(recipient_id,actor_id,type,report_id) VALUES(recipient,auth.uid(),'report_reply',_report_id);
END; $$;
REVOKE ALL ON FUNCTION public.reply_to_report(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_report(uuid,text,text) TO authenticated;
DROP POLICY "Actors create notifications" ON public.notifications;
CREATE POLICY "Actors create non-report notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid()=actor_id AND type<>'report_reply' AND report_id IS NULL);
CREATE POLICY "Superior admins view reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'superior_admin'));
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reports') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.reports; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END; $$;