ALTER TABLE public.dev_code_proposals ADD COLUMN IF NOT EXISTS commit_sha text;
ALTER TABLE public.dev_code_proposals ADD COLUMN IF NOT EXISTS pr_number integer;
ALTER TABLE public.dev_code_proposals ADD COLUMN IF NOT EXISTS merge_sha text;
ALTER TABLE public.dev_code_proposals ADD COLUMN IF NOT EXISTS merged_at timestamptz;
ALTER TABLE public.dev_code_proposals ADD COLUMN IF NOT EXISTS deployment_status text;
ALTER TABLE public.dev_code_proposals DROP CONSTRAINT IF EXISTS dev_code_proposals_status_check;
ALTER TABLE public.dev_code_proposals ADD CONSTRAINT dev_code_proposals_status_check CHECK(status IN ('proposed','applying','failed','merged'));
