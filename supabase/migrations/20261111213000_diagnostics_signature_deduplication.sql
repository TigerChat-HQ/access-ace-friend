-- Real, concurrency-safe diagnostic deduplication.
CREATE TEMP TABLE _diagnostic_dedupe_map ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (PARTITION BY error_signature ORDER BY created_at, id) AS keeper_id,
       row_number() OVER (PARTITION BY error_signature ORDER BY created_at, id) AS rn
FROM public.app_diagnostics
WHERE error_signature IS NOT NULL AND error_signature <> '';

UPDATE public.admin_diagnostic_notifications n
SET diagnostic_id = m.keeper_id
FROM _diagnostic_dedupe_map m
WHERE n.diagnostic_id = m.id AND m.rn > 1;

UPDATE public.dev_tasks t
SET plan = jsonb_set(t.plan, '{diagnostic_id}', to_jsonb(m.keeper_id::text), true)
FROM _diagnostic_dedupe_map m
WHERE m.rn > 1 AND t.plan->>'diagnostic_id' = m.id::text;

WITH totals AS (
  SELECT m.keeper_id,
         sum(greatest(d.occurrence_count, 1))::integer AS total_occurrences,
         max(d.last_seen_at) AS latest_seen,
         bool_or(d.status IN ('new','investigating')) AS has_active
  FROM _diagnostic_dedupe_map m
  JOIN public.app_diagnostics d ON d.id = m.id
  GROUP BY m.keeper_id
)
UPDATE public.app_diagnostics keeper
SET occurrence_count = totals.total_occurrences,
    last_seen_at = totals.latest_seen,
    status = CASE WHEN totals.has_active THEN 'new' ELSE keeper.status END,
    resolved_at = CASE WHEN totals.has_active THEN NULL ELSE keeper.resolved_at END
FROM totals
WHERE keeper.id = totals.keeper_id;

DELETE FROM public.app_diagnostics d
USING _diagnostic_dedupe_map m
WHERE d.id = m.id AND m.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS app_diagnostics_error_signature_uidx
  ON public.app_diagnostics (error_signature)
  WHERE error_signature IS NOT NULL AND error_signature <> '';

CREATE OR REPLACE FUNCTION public.report_app_diagnostic(p_record jsonb, p_signature text)
RETURNS TABLE (id uuid, occurrence_count integer, ai_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_record IS NULL OR jsonb_typeof(p_record) <> 'object'
     OR p_signature IS NULL OR p_signature !~ '^sha256:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid diagnostic payload or signature' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_record->>'title','')) = 0 OR length(p_record->>'title') > 240 THEN
    RAISE EXCEPTION 'Invalid diagnostic title' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.app_diagnostics AS current_row (
    reporter_id, source, severity, category, title, message, route,
    component_name, action_label, stack, suggestion, metadata,
    error_signature, last_seen_at, occurrence_count, status, ai_status
  )
  VALUES (
    v_user_id,
    coalesce(nullif(p_record->>'source',''), 'feature_handler'),
    CASE WHEN p_record->>'severity' IN ('critical','high','medium','low') THEN p_record->>'severity' ELSE 'high' END,
    coalesce(nullif(p_record->>'category',''), 'runtime'),
    left(p_record->>'title', 240),
    left(p_record->>'message', 8000),
    left(p_record->>'route', 1000),
    left(p_record->>'component_name', 240),
    left(p_record->>'action_label', 240),
    left(p_record->>'stack', 8000),
    left(p_record->>'suggestion', 2000),
    CASE WHEN jsonb_typeof(p_record->'metadata') = 'object' THEN p_record->'metadata' ELSE '{}'::jsonb END,
    p_signature, now(), 1, 'new', 'queued'
  )
  ON CONFLICT (error_signature) WHERE error_signature IS NOT NULL AND error_signature <> ''
  DO UPDATE SET
    occurrence_count = current_row.occurrence_count + 1,
    last_seen_at = now(),
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    route = EXCLUDED.route,
    component_name = EXCLUDED.component_name,
    action_label = EXCLUDED.action_label,
    stack = EXCLUDED.stack,
    suggestion = EXCLUDED.suggestion,
    metadata = EXCLUDED.metadata,
    severity = CASE
      WHEN CASE current_row.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
         >= CASE EXCLUDED.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
      THEN current_row.severity ELSE EXCLUDED.severity END,
    status = CASE WHEN current_row.status IN ('fixed','ignored') THEN 'new' ELSE current_row.status END,
    resolved_at = CASE WHEN current_row.status IN ('fixed','ignored') THEN NULL ELSE current_row.resolved_at END,
    ai_status = CASE WHEN current_row.status IN ('fixed','ignored') THEN 'queued' ELSE current_row.ai_status END,
    ai_task_id = CASE WHEN current_row.status IN ('fixed','ignored') THEN NULL ELSE current_row.ai_task_id END
  RETURNING current_row.id, current_row.occurrence_count, current_row.ai_status;
END;
$$;

REVOKE ALL ON FUNCTION public.report_app_diagnostic(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_app_diagnostic(jsonb, text) TO authenticated;
COMMENT ON FUNCTION public.report_app_diagnostic(jsonb, text) IS
  'Authenticated atomic diagnostic upsert: one record per SHA-256 signature; increments occurrence_count and refreshes last_seen_at.';
