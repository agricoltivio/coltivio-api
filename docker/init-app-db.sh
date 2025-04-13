#!/bin/bash
set -e

echo "Setting up db roles"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
create role app with login password 's3cret' noinherit;
create role authenticated noinherit;
grant authenticated to app;
grant usage on schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
EOSQL
