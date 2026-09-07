-- ═══════════════════════════════════════════════════════════
-- SECURITY TIGHTENING: drop the temporary public UPDATE policy.
-- The backend now authenticates with SUPABASE_SERVICE_KEY (bypasses RLS),
-- so all writes flow exclusively through the API. The public anon key
-- can still READ (map/realtime) and INSERT (filing reports), but can
-- no longer modify rows (forge claims/cleanups) directly.
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "public_update_reports" ON public.reports;