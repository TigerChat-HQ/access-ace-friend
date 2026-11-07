ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status_context jsonb;
CREATE TABLE public.device_push_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, token text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own push devices" ON public.device_push_tokens FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TABLE public.quiz_question_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, question text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.quiz_question_history TO authenticated;
GRANT ALL ON public.quiz_question_history TO service_role;
ALTER TABLE public.quiz_question_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own quiz history" ON public.quiz_question_history FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE OR REPLACE FUNCTION public.reply_to_status(p_story_id uuid,p_content text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.stories; c uuid;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF length(trim(p_content)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Reply must contain 1 to 1000 characters'; END IF;
SELECT * INTO s FROM public.stories WHERE id=p_story_id AND expires_at>now();
IF NOT FOUND THEN RAISE EXCEPTION 'Status unavailable'; END IF;
IF s.user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot reply to own status'; END IF;
c:=public.create_direct_conversation(s.user_id);
INSERT INTO public.messages(conversation_id,sender_id,content,message_type,status_context) VALUES(c,auth.uid(),trim(p_content),'text',jsonb_build_object('story_id',s.id,'caption',coalesce(s.caption,'Status'),'media_type',s.media_type));
RETURN c;
END $$;
GRANT EXECUTE ON FUNCTION public.reply_to_status(uuid,text) TO authenticated;