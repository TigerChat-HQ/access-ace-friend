-- Keep legacy receipt columns consistent so unread badges and sender ticks use the same state.
-- An existing read_at timestamp is authoritative; legacy is_read=true rows receive
-- timestamps so sender-side receipt status can still render correctly.
UPDATE public.messages
SET
  is_read = (read_at IS NOT NULL OR COALESCE(is_read, false)),
  read_at = CASE
    WHEN read_at IS NULL AND COALESCE(is_read, false) THEN COALESCE(delivered_at, created_at, now())
    ELSE read_at
  END,
  delivered_at = CASE
    WHEN delivered_at IS NULL AND (read_at IS NOT NULL OR COALESCE(is_read, false)) THEN COALESCE(read_at, created_at, now())
    ELSE delivered_at
  END
WHERE is_read IS NULL
   OR (read_at IS NOT NULL AND is_read IS DISTINCT FROM true)
   OR (COALESCE(is_read, false) AND read_at IS NULL)
   OR ((read_at IS NOT NULL OR COALESCE(is_read, false)) AND delivered_at IS NULL);
