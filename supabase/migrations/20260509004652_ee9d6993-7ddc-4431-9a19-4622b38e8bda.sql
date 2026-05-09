
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_status text NOT NULL DEFAULT 'sent';

CREATE OR REPLACE FUNCTION public.sync_message_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.read_at IS NOT NULL THEN
    NEW.message_status := 'read';
  ELSIF NEW.delivered_at IS NOT NULL THEN
    NEW.message_status := 'delivered';
  ELSE
    NEW.message_status := 'sent';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_message_status ON public.messages;
CREATE TRIGGER trg_sync_message_status
BEFORE INSERT OR UPDATE OF delivered_at, read_at ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.sync_message_status();

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  media_url text,
  media_type text,
  priority text NOT NULL DEFAULT 'normal',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read active announcements" ON public.announcements FOR SELECT TO authenticated
USING (is_active AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Admins create announcements" ON public.announcements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin')));
CREATE POLICY "Admins update announcements" ON public.announcements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));

CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own dismissals" ON public.announcement_dismissals FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Insert own dismissals" ON public.announcement_dismissals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  conversation_id uuid,
  call_type text NOT NULL DEFAULT 'voice',
  status text NOT NULL DEFAULT 'ringing',
  duration_seconds integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view call logs" ON public.call_logs FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);
CREATE POLICY "Participants insert call logs" ON public.call_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);
CREATE POLICY "Participants update call logs" ON public.call_logs FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.call_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
