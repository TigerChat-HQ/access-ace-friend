-- Keep presence timestamps out of the publicly readable profiles table.
-- Access to presence is limited to authenticated users who share a conversation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_last_seen boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.chat_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.chat_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.chat_presence FROM PUBLIC, anon, authenticated;

-- Preserve the existing last-seen timestamps before removing them from profiles.
INSERT INTO private.chat_presence(user_id, last_seen_at)
SELECT user_id, COALESCE(last_seen, now())
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE
SET last_seen_at = EXCLUDED.last_seen_at;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_seen,
  DROP COLUMN IF EXISTS is_online;

CREATE OR REPLACE FUNCTION public.touch_my_chat_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO private.chat_presence(user_id, last_seen_at)
  VALUES (v_user_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_presence()
RETURNS TABLE (
  user_id uuid,
  is_online boolean,
  last_seen_at timestamptz,
  show_last_seen boolean,
  show_online_status boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, private, public
AS $$
  SELECT DISTINCT
    peer.user_id,
    (presence.last_seen_at >= now() - interval '90 seconds' AND peer.show_online_status) AS is_online,
    CASE WHEN peer.show_last_seen THEN presence.last_seen_at ELSE NULL END AS last_seen_at,
    peer.show_last_seen,
    peer.show_online_status
  FROM public.conversation_members AS mine
  JOIN public.conversation_members AS theirs
    ON theirs.conversation_id = mine.conversation_id
   AND theirs.user_id <> mine.user_id
  JOIN public.profiles AS peer
    ON peer.user_id = theirs.user_id
  LEFT JOIN private.chat_presence AS presence
    ON presence.user_id = peer.user_id
  WHERE mine.user_id = auth.uid()
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.touch_my_chat_presence() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_chat_presence() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_my_chat_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_presence() TO authenticated;

COMMENT ON TABLE private.chat_presence IS
  'Private per-user chat presence timestamps; online is inferred from a heartbeat within 90 seconds and read only through membership-checked RPC.';
