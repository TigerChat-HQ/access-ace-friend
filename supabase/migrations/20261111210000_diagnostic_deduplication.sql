-- Atomic deduplication for runtime diagnostics.
-- One active row per stable signature; repeats increment occurrence_count.
CREATE UNIQUE INDEX IF NOT EXISTS app_diagnostics_error_signature_uidx
  ON public.app_diagnostics (error_signature)
  WHERE error_signature IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_app_diagnostic(
  p_error_signature text,
  p_source text,
  p_severity text,
  p_category text,
  p_title text,
  p_message text,
  p_route text DEFAULT NULL,
  p_component_name text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_stack text DEFAULT NULL,
  p_suggestion text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(diagnostic_id uuid, occurrence_count integer, should_process boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.app_diagnostics%ROWTYPE;
  v_reprocess boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_error_signature IS NULL OR length(p_error_signature) <> 64
     OR p_error_signature !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid diagnostic signature' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent reports for the same signature before checking/inserting.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_error_signature, 0));

  SELECT d.* INTO v_row
  FROM public.app_diagnostics AS d
  WHERE d.error_signature = p_error_signature
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_reprocess := v_row.ai_status IN ('fixed', 'failed');
    UPDATE public.app_diagnostics AS d
    SET occurrence_count = d.occurrence_count + 1,
        last_seen_at = now(),
        severity = CASE
          WHEN p_severity = 'critical' THEN 'critical'
          WHEN p_severity = 'high' AND d.severity NOT IN ('critical') THEN 'high'
          ELSE d.severity
        END,
        status = CASE WHEN d.ai_status = 'fixed' OR d.status = 'fixed' THEN 'new' ELSE d.status END,
        resolved_at = CASE WHEN d.ai_status = 'fixed' OR d.status = 'fixed' THEN NULL ELSE d.resolved_at END,
        ai_status = CASE WHEN d.ai_status IN ('fixed', 'failed') THEN 'queued' ELSE d.ai_status END,
        ai_task_id = CASE WHEN d.ai_status IN ('fixed', 'failed') THEN NULL ELSE d.ai_task_id END
    WHERE d.id = v_row.id
    RETURNING d.id, d.occurrence_count INTO diagnostic_id, occurrence_count;
    should_process := v_reprocess;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.app_diagnostics (
    reporter_id, source, severity, category, title, message, route,
    component_name, action_label, stack, suggestion, metadata,
    error_signature, last_seen_at, occurrence_count, status, ai_status
  ) VALUES (
    v_user_id,
    COALESCE(NULLIF(p_source, ''), 'feature_handler'),
    CASE WHEN p_severity IN ('critical','high','medium','low') THEN p_severity ELSE 'high' END,
    COALESCE(NULLIF(p_category, ''), 'runtime'),
    left(COALESCE(p_title, 'Unknown error'), 240),
    left(COALESCE(p_message, 'Unknown error'), 8000),
    p_route, p_component_name, p_action_label, p_stack, p_suggestion,
    COALESCE(p_metadata, '{}'::jsonb),
    p_error_signature, now(), 1, 'new', 'queued'
  )
  RETURNING id, 1 INTO diagnostic_id, occurrence_count;
  should_process := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_diagnostic(text,text,text,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_app_diagnostic(text,text,text,text,text,text,text,text,text,text,text,jsonb) TO authenticated;
