
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_audience_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_audience_check
  CHECK (audience = ANY (ARRAY['everyone','contacts','only_me','contacts_except','selected']));

CREATE TABLE IF NOT EXISTS public.story_audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience_type text NOT NULL CHECK (audience_type IN ('include','exclude')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, member_id)
);
ALTER TABLE public.story_audience_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_audience_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_audience_members TO authenticated;

DROP POLICY IF EXISTS "Story owner manages audience members" ON public.story_audience_members;
CREATE POLICY "Story owner manages audience members"
ON public.story_audience_members
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Stories visible to selected audience" ON public.stories;
CREATE POLICY "Stories visible to selected audience"
ON public.stories FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND (
    user_id = (SELECT auth.uid())
    OR audience = 'everyone'
    OR (
      audience IN ('contacts','contacts_except')
      AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (SELECT auth.uid()) AND f.following_id = stories.user_id)
      AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = stories.user_id AND f.following_id = (SELECT auth.uid()))
      AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = stories.user_id) OR (b.blocker_id = stories.user_id AND b.blocked_id = (SELECT auth.uid())))
      AND (
        audience = 'contacts'
        OR NOT EXISTS (SELECT 1 FROM public.story_audience_members m WHERE m.story_id = stories.id AND m.member_id = (SELECT auth.uid()) AND m.audience_type = 'exclude')
      )
    )
    OR (
      audience = 'selected'
      AND EXISTS (SELECT 1 FROM public.story_audience_members m WHERE m.story_id = stories.id AND m.member_id = (SELECT auth.uid()) AND m.audience_type = 'include')
      AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = stories.user_id) OR (b.blocker_id = stories.user_id AND b.blocked_id = (SELECT auth.uid())))
    )
  )
);

