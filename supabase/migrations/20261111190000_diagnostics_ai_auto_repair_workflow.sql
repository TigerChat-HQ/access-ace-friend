-- Diagnostics lifecycle, Tiger AI repair tasks, and admin approval inbox.
ALTER TABLE public.app_diagnostics
  ADD COLUMN IF NOT EXISTS error_signature text,
  ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'queued'
    CHECK (ai_status IN ('queued','processing','pr_open','needs_review','fixed','failed','ignored')),
  ADD COLUMN IF NOT EXISTS ai_task_id uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS app_diagnostics_active_recent_idx
  ON public.app_diagnostics (status, created_at DESC)
  WHERE status IN ('new','investigating');
CREATE INDEX IF NOT EXISTS app_diagnostics_signature_idx
  ON public.app_diagnostics (error_signature, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_diagnostic_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid REFERENCES public.app_diagnostics(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('new_error','repair_ready','repair_failed','repair_merged')),
  title text NOT NULL,
  message text NOT NULL,
  pr_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  acted_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_diagnostic_notifications_recent_idx
  ON public.admin_diagnostic_notifications (created_at DESC);

ALTER TABLE public.admin_diagnostic_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read diagnostic notifications" ON public.admin_diagnostic_notifications;
CREATE POLICY "Admins read diagnostic notifications"
  ON public.admin_diagnostic_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
DROP POLICY IF EXISTS "Admins update diagnostic notifications" ON public.admin_diagnostic_notifications;
CREATE POLICY "Admins update diagnostic notifications"
  ON public.admin_diagnostic_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
GRANT SELECT, UPDATE ON public.admin_diagnostic_notifications TO authenticated;

-- Collapse duplicate reports into a single active issue while retaining the
-- occurrence counter and last-seen timestamp. The app still stores raw details.
