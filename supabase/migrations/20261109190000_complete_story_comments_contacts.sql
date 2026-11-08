-- Story comments use their dedicated table. Contacts means mutual follows.
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_audience_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_audience_check CHECK (audience IN ('everyone','contacts','only_me'));

DROP POLICY IF EXISTS "Stories visible to selected audience" ON public.stories;
CREATE POLICY "Stories visible to selected audience" ON public.stories
FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND (
    user_id = auth.uid()
    OR audience = 'everyone'
    OR (
      audience = 'contacts'
      AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = stories.user_id)
      AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = stories.user_id AND f.following_id = auth.uid())
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = stories.user_id)
           OR (b.blocker_id = stories.user_id AND b.blocked_id = auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Users comment as themselves on visible stories" ON public.story_comments;
CREATE POLICY "Users comment as themselves on visible stories" ON public.story_comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_comments.story_id AND s.expires_at > now()
      AND (
        s.user_id = auth.uid()
        OR s.audience = 'everyone'
        OR (
          s.audience = 'contacts'
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = s.user_id)
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = s.user_id AND f.following_id = auth.uid())
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Users read comments on visible stories" ON public.story_comments;
CREATE POLICY "Users read comments on visible stories" ON public.story_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_comments.story_id AND s.expires_at > now()
      AND (
        s.user_id = auth.uid()
        OR s.audience = 'everyone'
        OR (
          s.audience = 'contacts'
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = s.user_id)
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = s.user_id AND f.following_id = auth.uid())
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Users react as self" ON public.story_reactions;
CREATE POLICY "Users react as self" ON public.story_reactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_reactions.story_id AND s.expires_at > now()
      AND (
        s.user_id = auth.uid()
        OR s.audience = 'everyone'
        OR (
          s.audience = 'contacts'
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = s.user_id)
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = s.user_id AND f.following_id = auth.uid())
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
          )
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.reply_to_status(p_story_id uuid, p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_story public.stories; v_conversation_id uuid; v_user_id uuid := auth.uid();
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF length(trim(coalesce(p_content,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Reply must contain 1 to 1000 characters'; END IF;
 SELECT * INTO v_story FROM public.stories s
 WHERE s.id=p_story_id AND s.expires_at>now()
 AND (
   s.user_id=v_user_id OR s.audience='everyone'
   OR (s.audience='contacts'
     AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=v_user_id AND f.following_id=s.user_id)
     AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id=s.user_id AND f.following_id=v_user_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id=v_user_id AND b.blocked_id=s.user_id)
          OR (b.blocker_id=s.user_id AND b.blocked_id=v_user_id)
     )
   )
 );
 IF NOT FOUND THEN RAISE EXCEPTION 'Status unavailable'; END IF;
 IF v_story.user_id=v_user_id THEN RAISE EXCEPTION 'Cannot reply to own status'; END IF;
 v_conversation_id := public.create_direct_conversation(v_story.user_id);
 INSERT INTO public.story_comments(story_id,user_id,content)
 VALUES(v_story.id,v_user_id,trim(p_content));
 INSERT INTO public.messages(conversation_id,sender_id,content,message_type,status_context)
 VALUES(v_conversation_id,v_user_id,trim(p_content),'text',jsonb_build_object('story_id',v_story.id,'caption',coalesce(v_story.caption,'Status'),'media_type',v_story.media_type));
 RETURN v_conversation_id;
END; $$;
REVOKE ALL ON FUNCTION public.reply_to_status(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_to_status(uuid,text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;

DROP POLICY IF EXISTS "Users record views" ON public.story_views;
CREATE POLICY "Users record views" ON public.story_views
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = viewer_id
  AND EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_views.story_id AND s.expires_at > now()
      AND s.user_id <> auth.uid()
      AND (
        s.audience = 'everyone'
        OR (
          s.audience = 'contacts'
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = s.user_id)
          AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = s.user_id AND f.following_id = auth.uid())
          AND NOT EXISTS (
            SELECT 1 FROM public.blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
          )
        )
      )
  )
);
