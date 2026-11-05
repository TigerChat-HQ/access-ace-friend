
-- 1. Roles enum + table + has_role function
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Anyone authenticated can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins manage roles - insert"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins manage roles - update"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins manage roles - delete"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Seed admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('77e53235-b3b4-47ea-9acc-044475055bbf', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Profiles: add username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Backfill usernames from display_name where missing
UPDATE public.profiles
SET username = LOWER(REGEXP_REPLACE(COALESCE(display_name, 'user' || SUBSTR(user_id::text, 1, 8)), '[^a-zA-Z0-9_]', '', 'g'))
WHERE username IS NULL;

-- Update handle_new_user to also set username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user' || SUBSTR(NEW.id::text, 1, 8);
  END IF;
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    candidate
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'text', -- text | image | video
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_hashtags ON public.posts USING GIN(hashtags);

CREATE POLICY "Posts viewable by authenticated"
ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own posts"
ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts"
ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users or admins delete posts"
ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Likes
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_likes_post_id ON public.post_likes(post_id);

CREATE POLICY "Likes viewable"
ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like as self"
ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike own"
ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Comments
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_post_id ON public.post_comments(post_id);

CREATE POLICY "Comments viewable"
ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment as self"
ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments"
ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users or admins delete comments"
ON public.post_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 6. Follows
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

CREATE POLICY "Follows viewable"
ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users follow as self"
ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow own"
ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- 7. Storage bucket for post media
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Post media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

CREATE POLICY "Users upload own post media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own post media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
