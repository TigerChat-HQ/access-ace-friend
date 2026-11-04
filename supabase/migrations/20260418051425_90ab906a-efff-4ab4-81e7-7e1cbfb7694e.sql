
-- 1) Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like','comment','follow','mention','reply','comment_like')),
  post_id UUID,
  comment_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- 2) Blocks
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own blocks" ON public.blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users create own blocks" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON public.blocks
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- 3) Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins view reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update reports" ON public.reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 4) Privacy on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- 5) Triggers to auto-create notifications
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(recipient_id, actor_id, type, post_id)
    VALUES (owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(recipient_id, actor_id, type, post_id, comment_id)
    VALUES (owner, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.following_id <> NEW.follower_id THEN
    INSERT INTO public.notifications(recipient_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
