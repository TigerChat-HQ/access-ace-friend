-- Complete diagnostics schema inventory for administrators.
-- Returns every application table/view in public so the UI can detect both missing
-- expected tables and newly added tables absent from its local registry.
CREATE OR REPLACE FUNCTION public.admin_diagnostics_schema_inventory()
RETURNS TABLE (table_name text, relation_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'superior_admin')
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.relname::text,
         CASE c.relkind
           WHEN 'r' THEN 'table'
           WHEN 'p' THEN 'partitioned_table'
           WHEN 'v' THEN 'view'
           WHEN 'm' THEN 'materialized_view'
           WHEN 'f' THEN 'foreign_table'
           ELSE 'other'
         END::text
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_diagnostics_schema_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_diagnostics_schema_inventory() TO authenticated;

COMMENT ON FUNCTION public.admin_diagnostics_schema_inventory() IS
  'Admin-only inventory of public schema tables and views for diagnostics completeness checks.';
