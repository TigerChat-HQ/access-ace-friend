-- Allow the Render log collector Edge Function to insert deduplicated server diagnostics.
-- The function is executable only with the Supabase service_role key.
CREATE OR REPLACE FUNCTION public.ingest_render_server_diagnostic(
  p_record jsonb,
  p_signature text
)
RETURNS TABLE(id uuid, occurrence_count integer, ai_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_record IS NULL OR jsonb_typeof(p_record) <> 'object'
     OR p_signature IS NULL OR p_signature !~ '^sha256:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid Render diagnostic payload or signature' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_record->>'source','') <> 'render_server'
     OR length(coalesce(p_record->>'title','')) = 0
     OR length(p_record->>'title') > 240 THEN
    RAISE EXCEPTION 'Invalid Render diagnostic source or title' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.app_diagnostics AS current_row (
    reporter_id, source, severity, category, title, message, route,
    component_name, action_label, stack, suggestion, metadata,
    error_signature, last_seen_at, occurrence_count, status, ai_status
  )
  VALUES (
    NULL,
    'render_server',
    CASE WHEN p_record->>'severity' IN ('critical','high','medium','low') THEN p_record->>'severity' ELSE 'high' END,
    coalesce(nullif(p_record->>'category',''), 'render_runtime'),
    left(p_record->>'title', 240),
    left(p_record->>'message', 8000),
    left(p_record->>'route', 1000),
    left(coalesce(p_record->>'component_name','Render service'), 240),
    left(coalesce(p_record->>'action_label','Render server log'), 240),
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
    metadata = EXCLUDED.metadata,
    severity = CASE
      WHEN CASE current_row.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
         >= CASE EXCLUDED.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END
      THEN current_row.severity ELSE EXCLUDED.severity END
  RETURNING current_row.id, current_row.occurrence_count, current_row.ai_status;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_render_server_diagnostic(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_render_server_diagnostic(jsonb, text) TO service_role;

COMMENT ON FUNCTION public.ingest_render_server_diagnostic(jsonb, text) IS
  'Service-role-only, deduplicated ingestion of sanitized Render hosting logs into Admin Diagnostics.';
