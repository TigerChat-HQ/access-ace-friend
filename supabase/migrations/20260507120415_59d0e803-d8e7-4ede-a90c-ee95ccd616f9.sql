-- Phase 1: messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Phase 2: comment replies + likes
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes viewable" ON public.comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like comments as self" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own comment likes" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notify on comment reply
CREATE OR REPLACE FUNCTION public.notify_on_comment_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_owner UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner FROM public.post_comments WHERE id = NEW.parent_id;
    IF parent_owner IS NOT NULL AND parent_owner <> NEW.user_id THEN
      INSERT INTO public.notifications(recipient_id, actor_id, type, post_id, comment_id)
      VALUES (parent_owner, NEW.user_id, 'reply', NEW.post_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_comment_reply ON public.post_comments;
CREATE TRIGGER trg_notify_comment_reply AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_reply();

-- Notify on comment like
CREATE OR REPLACE FUNCTION public.notify_on_comment_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner UUID; pid UUID;
BEGIN
  SELECT user_id, post_id INTO owner, pid FROM public.post_comments WHERE id = NEW.comment_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(recipient_id, actor_id, type, post_id, comment_id)
    VALUES (owner, NEW.user_id, 'comment_like', pid, NEW.comment_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_comment_like ON public.comment_likes;
CREATE TRIGGER trg_notify_comment_like AFTER INSERT ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_like();

-- Phase 4: group join requests + approval
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own join requests" ON public.group_join_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own join requests" ON public.group_join_requests
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.group_admins ga
      WHERE ga.conversation_id = group_join_requests.conversation_id AND ga.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins update join requests" ON public.group_join_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.group_admins ga
            WHERE ga.conversation_id = group_join_requests.conversation_id AND ga.user_id = auth.uid())
  );

CREATE POLICY "Users delete own join requests" ON public.group_join_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow group admins to remove members from conversation_members
CREATE POLICY "Admins remove members" ON public.conversation_members
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.group_admins ga
      WHERE ga.conversation_id = conversation_members.conversation_id AND ga.user_id = auth.uid()
    )
  );