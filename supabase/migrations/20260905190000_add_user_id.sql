-- Attach reports to authenticated users (nullable - anonymous reports still allowed)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reports_user_id_idx ON public.reports(user_id);
