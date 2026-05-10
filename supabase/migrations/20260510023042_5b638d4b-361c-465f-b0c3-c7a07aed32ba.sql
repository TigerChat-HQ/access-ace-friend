
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_reply_media_url text,
  ADD COLUMN IF NOT EXISTS admin_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_by uuid;

-- Allow the original reporter to view their own reports (so they can see admin replies)
DROP POLICY IF EXISTS "Reporters view own reports" ON public.reports;
CREATE POLICY "Reporters view own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);
