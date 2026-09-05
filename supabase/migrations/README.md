# Database Migrations

SQL files in this folder are **automatically applied** to the linked Supabase
project whenever they are pushed to `main` (see `.github/workflows/apply-migrations.yml`).

## Conventions

- One file per change: `<YYYYMMDDHHMMSS>_<what_it_does>.sql`
  - e.g. `20260905120000_add_rls_policies.sql`
- Files are applied in filename order, **once each** — never edit a migration
  that has already been pushed; add a new one instead.
- Write idempotent SQL where possible (`IF NOT EXISTS`, `IF EXISTS`) as a safety net.

## One-time setup (already done)

The initial schema (reports table, realtime, storage bucket) was applied manually
via the Supabase SQL Editor from `schema.sql`. That file stays in the repo as
reference documentation — new changes go here as migration files.

## Required GitHub secret

- `SUPABASE_DB_URL` — the Session-pooler connection string from
  Supabase Dashboard → **Connect**, with `[YOUR-PASSWORD]` replaced by the
  database password (resettable in Project Settings → Database).
