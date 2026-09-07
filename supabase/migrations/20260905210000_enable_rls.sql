-- ═══════════════════════════════════════════════════════════
-- Enable Row Level Security on reports
-- Public read (map + realtime) and public report-filing stay open
-- by design. Updates are currently open too, because the API can
-- still run on the anon key; once SUPABASE_SERVICE_KEY is set on
-- the server, a follow-up migration should drop public_update_reports.
--
-- Idempotent: safe to run even if policies were created manually.
-- (Note: DROP POLICY takes no FOR clause — that belongs to CREATE.)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_reports" ON public.reports;
CREATE POLICY "public_select_reports"
  ON public.reports FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_insert_reports" ON public.reports;
CREATE POLICY "public_insert_reports"
  ON public.reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_reports" ON public.reports;
CREATE POLICY "public_update_reports"
  ON public.reports FOR UPDATE
  TO anon, authenticated
  WITH CHECK (true);