CREATE TABLE public.dev_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_report_id uuid,
  title text NOT NULL,
  summary text,
  category text NOT NULL DEFAULT 'feature',
  priority text NOT NULL DEFAULT 'medium',
  risk text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'planned',
  plan jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dev_tasks TO authenticated;
GRANT ALL ON public.dev_tasks TO service_role;
ALTER TABLE public.dev_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage dev tasks" ON public.dev_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));

CREATE TABLE public.dev_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  actor text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_audit_log TO authenticated;
GRANT ALL ON public.dev_audit_log TO service_role;
ALTER TABLE public.dev_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.dev_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));