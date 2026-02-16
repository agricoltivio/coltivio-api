-- Setup script for test database (runs on supabase/postgres image before migrations)

-- Create app role for RLS-aware connections (APP_DATABASE_URL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app WITH LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- Grant authenticated role to app so it can SET ROLE authenticated
GRANT authenticated TO app;

-- Grant schema access to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- Ensure search_path includes extensions (for PostGIS, pg_trgm)
ALTER ROLE app SET search_path TO public, extensions;
ALTER ROLE authenticated SET search_path TO public, extensions;

-- Enable PostGIS and pg_trgm, then set search_path so geometry type is visible
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SET search_path TO public, extensions;

-- Create federal_farm_plots table (normally populated by ogr2ogr, but migrations reference it)
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
CREATE INDEX IF NOT EXISTS "federal_farm_plots_geometries_idx" ON federal_farm_plots USING gist (geometry);

-- App-specific function: farm_id() reads from pg session setting
CREATE OR REPLACE FUNCTION public.farm_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.farm_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Trigger: auto-create profile row when GoTrue inserts into auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
