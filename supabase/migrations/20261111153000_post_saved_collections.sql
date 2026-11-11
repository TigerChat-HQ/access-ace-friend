-- Private user-owned collections for organizing saved posts.
CREATE TABLE IF NOT EXISTS public.post_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS public.post_collection_items (
  collection_id uuid NOT NULL REFERENCES public.post_collections(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_post_collections_user_updated ON public.post_collections(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_collection_items_post ON public.post_collection_items(post_id);
ALTER TABLE public.post_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_collection_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own post collections" ON public.post_collections;
CREATE POLICY "Users manage own post collections" ON public.post_collections
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users manage own collection items" ON public.post_collection_items;
CREATE POLICY "Users manage own collection items" ON public.post_collection_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.post_collections c WHERE c.id = collection_id AND c.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.post_collections c WHERE c.id = collection_id AND c.user_id = (select auth.uid()))
  );
REVOKE ALL ON public.post_collections, public.post_collection_items FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_collections, public.post_collection_items TO authenticated;
