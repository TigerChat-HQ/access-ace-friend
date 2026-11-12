-- Restrict SECURITY DEFINER RPC execution to authenticated users where required.
-- Trigger-only league finalization must not be callable through the Data API.

REVOKE ALL ON FUNCTION public.create_draughts_tournament(text,text,text,timestamptz,integer,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_draughts_tournament(text,text,text,timestamptz,integer,text,text,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_draughts_tournament(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_draughts_tournament(uuid,text) TO authenticated;

-- Used by the authenticated stories SELECT policy; anonymous access is unnecessary.
REVOKE ALL ON FUNCTION public.is_story_audience_member(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_story_audience_member(uuid,uuid,text) TO authenticated;

-- This function is invoked by a trigger, not by application clients.
REVOKE ALL ON FUNCTION public.finalize_draughts_league() FROM PUBLIC, anon, authenticated;
