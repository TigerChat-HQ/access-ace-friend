-- Remove the legacy anon execute grant on status replies and keep
-- internal Draughts validation helpers inaccessible to client roles.
REVOKE ALL ON FUNCTION public.reply_to_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.draughts_capture_paths(jsonb,integer,jsonb,integer[],boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.draughts_has_legal_move(jsonb,text) FROM PUBLIC, anon, authenticated;
