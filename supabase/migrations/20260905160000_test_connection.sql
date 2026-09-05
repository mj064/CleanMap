-- Test migration: verifies the Supabase GitHub integration applies
-- migrations from supabase/migrations/ on push to main.
-- Safe to run: creates nothing, changes nothing.
DO $$
BEGIN
  RAISE NOTICE 'CleanMap migration pipeline OK — integration is working!';
END
$$;

SELECT 1 AS pipeline_test;
