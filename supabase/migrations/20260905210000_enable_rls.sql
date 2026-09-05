-- ═══════════════════════════════════════════════════════════
-- Enable Row Level Security on reports
-- Public read (map + realtime) and public report-filing stay open
-- by design. Updates are currently open too, because the API can
-- still run on the anon key; once SUPABASE_SERVICE_KEY is set on
-- the server, a follow-up migration should drop public_update_reports.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select_reports"
  ON public.reports FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public_insert_reports"
  ON public.reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "public_update_reports"
  ON public.reports FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);