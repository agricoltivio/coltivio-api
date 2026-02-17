# coltivio-api

Backend API for [Coltivio](https://github.com/agricoltivio) — an open-source farm management platform.

Built with Express, Drizzle ORM, Zod validation, and Supabase (GoTrue auth + Postgres with RLS).

## License

Licensed under [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html) with the [Commons Clause](https://commonsclause.com/) — you may use, modify, and distribute freely, but **not sell** the software or services based on it. See [LICENSE](LICENSE) for details.

## Prerequisites

- Node.js 20+
- Yarn
- [Supabase CLI](https://supabase.com/docs/guides/local-development)
- Docker (for tests and local Supabase)
- GDAL (`brew install gdal` on macOS) — for importing shapefiles

## Getting started

```bash
git clone git@github.com:agricoltivio/coltivio-api.git
cd coltivio-api
yarn install
```

### 1. Start local Supabase

```bash
supabase start
```

### 2. Configure environment

Copy the `.env.example` to `.env` and fill in the values from `supabase status`:

```bash
cp .env.example .env
```

### 3. Database setup

Run the setup script against your local Supabase database to create roles, helper functions, and triggers:

```bash
psql $DATABASE_URL -f scripts/setup-test-db.sql
```

Then apply Drizzle migrations:

```bash
yarn db:migrate
```

### 4. Import federal farm plots layer (optional)

```bash
PGPASSWORD='postgres' ogr2ogr -f "PostgreSQL" \
  PG:"dbname=postgres user=postgres host=127.0.0.1 port=54322" \
  farm_plots.shp \
  -nln 'federal_farm_plots' -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geometry -lco FID=id \
  -progress -overwrite
```

### 5. Start the server

```bash
yarn start
```

API docs available at http://localhost:8000/docs.

## Testing

Tests use Docker testcontainers (Postgres + GoTrue) — no local Supabase required.

```bash
yarn test                                     # all tests
npx jest -i src/test/security.integration.test.ts  # security suite only
```

## Project structure

```
src/
  api/            # session API factory (binds services to RLS DB)
  db/             # Drizzle schema, migrations, RLS-aware DB connection
  middlewares/    # auth, user middleware
  farm/           # farm CRUD endpoints + service
  plots/          # plot endpoints + service
  crops/          # crop endpoints + service
  animals/        # animal endpoints + service
  ...             # other domain modules follow the same pattern
  test/           # test helpers, global setup/teardown
scripts/          # DB setup scripts
drizzle/          # migration files
```
