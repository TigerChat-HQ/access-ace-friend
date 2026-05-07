CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE base_username TEXT; candidate TEXT; suffix INT := 0; user_count INT;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_username = '' OR base_username IS NULL THEN base_username := 'user' || SUBSTR(NEW.id::text, 1, 8); END IF;
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1; candidate := base_username || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, display_name, username) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)), candidate);
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_conv_user_uniq ON public.conversation_members (conversation_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS group_admins_conv_user_uniq ON public.group_admins (conversation_id, user_id);

CREATE OR REPLACE FUNCTION public.ensure_admin_super_group()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); super_id uuid;
BEGIN
  IF me IS NULL OR NOT public.has_role(me, 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT id INTO super_id FROM public.conversations WHERE type='group' AND name='🛡️ Admin Super Group' LIMIT 1;
  IF super_id IS NULL THEN
    INSERT INTO public.conversations (type, name) VALUES ('group', '🛡️ Admin Super Group') RETURNING id INTO super_id;
  END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (super_id, me) ON CONFLICT DO NOTHING;
  INSERT INTO public.group_admins (conversation_id, user_id) VALUES (super_id, me) ON CONFLICT DO NOTHING;
  RETURN super_id;
END; $$;