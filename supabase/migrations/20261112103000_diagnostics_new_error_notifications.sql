-- Notify administrators immediately when a new diagnostic record is created.
-- Deduplicated repeats are handled by the atomic report RPC and do not fire INSERT again.
CREATE OR REPLACE FUNCTION public.notify_admin_of_new_diagnostic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.source <> 'admin_suggestion' THEN
    INSERT INTO public.admin_diagnostic_notifications (
      diagnostic_id, notification_type, title, message, is_read
    ) VALUES (
      NEW.id,
      'new_error',
      'Hitilafu mpya: ' || left(NEW.title, 180),
      left(
        coalesce(NEW.severity, 'medium') || ' · ' ||
        coalesce(NEW.category, 'runtime') || ' · ' ||
        coalesce(NEW.message, 'Hakuna maelezo ya ziada yaliyotolewa.'),
        1000
      ),
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_diagnostics_admin_new_error_notice ON public.app_diagnostics;
CREATE TRIGGER app_diagnostics_admin_new_error_notice
AFTER INSERT ON public.app_diagnostics
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_of_new_diagnostic();

REVOKE ALL ON FUNCTION public.notify_admin_of_new_diagnostic() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_admin_of_new_diagnostic() IS
  'Creates a newest-first admin inbox notification for each newly inserted diagnostic, excluding admin recommendations.';
