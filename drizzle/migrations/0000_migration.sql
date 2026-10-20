ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;