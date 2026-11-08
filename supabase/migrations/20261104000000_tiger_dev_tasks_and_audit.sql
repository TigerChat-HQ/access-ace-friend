CREATE TABLE IF NOT EXISTS public.dev_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
 title text NOT NULL, summary text,
 category text NOT NULL DEFAULT 'feature',
 priority text NOT NULL DEFAULT 'medium',
 risk text NOT NULL DEFAULT 'low',
 status text NOT NULL DEFAULT 'planned',
 plan jsonb, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dev_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL,
 actor text NOT NULL, action text NOT NULL, details jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dev_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage dev tasks" ON public.dev_tasks;
CREATE POLICY "Admins manage dev tasks" ON public.dev_tasks FOR ALL TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'))
 WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
DROP POLICY IF EXISTS "Admins read dev audit log" ON public.dev_audit_log;
CREATE POLICY "Admins read dev audit log" ON public.dev_audit_log FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
DROP POLICY IF EXISTS "Admins insert dev audit log" ON public.dev_audit_log;
CREATE POLICY "Admins insert dev audit log" ON public.dev_audit_log FOR INSERT TO authenticated
 WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));
