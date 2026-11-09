-- Restore the status-to-chat reply path used by StoryViewer.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status_context jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_status_context_story_id
  ON public.messages ((status_context ->> 'story_id'))
  WHERE status_context IS NOT NULL;

-- The frontend already calls this RPC, but it was missing from the live database.
CREATE OR REPLACE FUNCTION public.create_direct_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF _other_user_id IS NULL OR _other_user_id = v_user_id THEN
    RAISE EXCEPTION 'Choose another user';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      LEAST(v_user_id::text, _other_user_id::text) || ':' ||
      GREATEST(v_user_id::text, _other_user_id::text),
      0
    )
  );

  SELECT c.id
    INTO v_conversation_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members mine
      WHERE mine.conversation_id = c.id AND mine.user_id = v_user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_members theirs
      WHERE theirs.conversation_id = c.id AND theirs.user_id = _other_user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.conversation_members extra
      WHERE extra.conversation_id = c.id
        AND extra.user_id NOT IN (v_user_id, _other_user_id)
    )
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (type)
    VALUES ('direct')
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (v_conversation_id, v_user_id),
           (v_conversation_id, _other_user_id);
  END IF;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_to_status(p_story_id uuid, p_content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.stories;
  v_conversation_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF length(trim(coalesce(p_content, ''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Reply must contain 1 to 1000 characters';
  END IF;

  SELECT * INTO v_story
  FROM public.stories
  WHERE id = p_story_id
    AND expires_at > now()
    AND (audience = 'everyone' OR user_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status unavailable';
  END IF;
  IF v_story.user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot reply to own status';
  END IF;

  v_conversation_id := public.create_direct_conversation(v_story.user_id);

  INSERT INTO public.messages (
    conversation_id, sender_id, content, message_type, status_context
  )
  VALUES (
    v_conversation_id,
    v_user_id,
    trim(p_content),
    'text',
    jsonb_build_object(
      'story_id', v_story.id,
      'caption', coalesce(v_story.caption, 'Status'),
      'media_type', v_story.media_type
    )
  );

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_to_status(uuid, text) TO authenticated;
