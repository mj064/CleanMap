-- ═══════════════════════════════════════════════════════════
-- AI Photo Triage: columns storing vision-model analysis of the
-- evidence photo (filled by the backend when AI is configured).
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_category text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_severity text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_verified boolean DEFAULT false;