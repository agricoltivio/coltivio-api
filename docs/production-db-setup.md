# Production Database Setup

This documents the manual steps required to set up a **new** Supabase project for Coltivio. The local `scripts/setup-test-db.sql` automates most of this for dev, but production (hosted Supabase) needs some steps done differently.

## 1. Extensions

Enable via the Supabase dashboard (**Database > Extensions**) or SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

PostGIS is required for geometry columns. pg_trgm is used for fuzzy text search on `federal_farm_plots.farm_id`.

## 2. RLS client role

The API connects as `rls_client` (via `APP_DATABASE_URL`) to enforce Row Level Security. On hosted Supabase you cannot create custom roles directly — use the dashboard or contact support. For self-hosted:

```sql
CREATE ROLE rls_client WITH LOGIN PASSWORD '<strong-password>';
GRANT authenticated TO rls_client;

GRANT USAGE ON SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

ALTER ROLE rls_client SET search_path TO public, extensions;
ALTER ROLE authenticated SET search_path TO public, extensions;
```

> **Hosted Supabase note:** You may need to use the built-in `postgres` role or configure a custom role through the Supabase dashboard. The key requirement is that the role can `SET ROLE authenticated` so that RLS policies (which target the `authenticated` role) are enforced.

## 3. `farm_id()` function

All RLS policies use `farm_id()` to read the current user's farm from a session variable set by the API middleware:

```sql
CREATE OR REPLACE FUNCTION public.farm_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.farm_id', true), '')::uuid;
$$ LANGUAGE sql STABLE SET search_path = '';
```

## 4. `handle_new_user` trigger

Auto-creates a `profiles` row when a user signs up via Supabase Auth:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

> **Important:** The `profiles` table must exist before the trigger fires. Run Drizzle migrations first, then create the trigger.

## 5. `federal_farm_plots` table

This table is populated by an ogr2ogr shapefile import and is **not** managed by Drizzle migrations. It must exist before migrations run (migrations reference it for RLS policies and indexes):

```sql
CREATE TABLE IF NOT EXISTS public.federal_farm_plots (
  id integer PRIMARY KEY,
  farm_id text NOT NULL,
  local_id text,
  usage integer NOT NULL,
  size integer NOT NULL,
  cut_date date,
  canton text NOT NULL,
  geometry geometry(MultiPolygon,4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS federal_farm_plots_geometries_idx
  ON federal_farm_plots USING gist (geometry);
```

Then import the shapefile:

```bash
ogr2ogr -f "PostgreSQL" \
  PG:"dbname=... user=... host=... port=..." \
  farm_plots.shp \
  -nln 'federal_farm_plots' -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geometry -lco FID=id \
  -progress -overwrite
```

## 6. Apply Drizzle migrations

```bash
DATABASE_URL="<production-connection-string>" yarn db:migrate
```

## Setup order

1. Enable extensions (PostGIS, pg_trgm)
2. Create `federal_farm_plots` table
3. Create `farm_id()` function
4. Create `rls_client` role + grants
5. Run Drizzle migrations (creates all other tables)
6. Create `handle_new_user` trigger (profiles table must exist)
7. Import federal farm plots shapefile

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Admin connection (postgres role) — used by Drizzle migrations |
| `APP_DATABASE_URL` | RLS client connection (`rls_client` role) — used by the API at runtime |
| `SUPABASE_API_URL` | Supabase API URL (for auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for admin auth operations) |
