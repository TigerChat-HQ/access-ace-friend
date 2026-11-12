-- Compatibility alias for older admin clients that used the misspelled table name.
-- The canonical table remains public.draughts_admin_settings.
CREATE OR REPLACE VIEW public.drought_admin_settings
WITH (security_invoker = true)
AS
SELECT id, seasons_enabled, tiger_ai_supervisor_enabled, updated_at, updated_by
FROM public.draughts_admin_settings;
GRANT SELECT ON public.drought_admin_settings TO authenticated;
GRANT UPDATE (seasons_enabled, tiger_ai_supervisor_enabled, updated_at, updated_by)
ON public.drought_admin_settings TO authenticated;
NOTIFY pgrst, 'reload schema';
