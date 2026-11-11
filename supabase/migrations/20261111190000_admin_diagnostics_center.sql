-- Admin Diagnostics Center: runtime errors, user reports and schema checks
CREATE TABLE IF NOT EXISTS public.app_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  category text NOT NULL DEFAULT 'runtime',
  title text NOT NULL,
  message text,
  route text,
  component_name text,
  action_label text,
  stack text,
  suggestion text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','investigating','fixed','ignored')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_diagnostics_created_at_idx ON public.app_diagnostics (created_at DESC);
CREATE INDEX IF NOT EXISTS app_diagnostics_status_idx ON public.app_diagnostics (status, severity);
ALTER TABLE public.app_diagnostics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can submit diagnostics" ON public.app_diagnostics;
CREATE POLICY "Authenticated users can submit diagnostics"
  ON public.app_diagnostics FOR INSERT TO authenticated
  WITH CHECK (reporter_id IS NULL OR reporter_id = auth.uid());
DROP POLICY IF EXISTS "Admins can read diagnostics" ON public.app_diagnostics;
CREATE POLICY "Admins can read diagnostics"
  ON public.app_diagnostics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
DROP POLICY IF EXISTS "Admins can update diagnostics" ON public.app_diagnostics;
CREATE POLICY "Admins can update diagnostics"
  ON public.app_diagnostics FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
GRANT INSERT ON public.app_diagnostics TO authenticated;
GRANT SELECT, UPDATE ON public.app_diagnostics TO authenticated;
