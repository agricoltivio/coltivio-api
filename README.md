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

### 3. Database setup + seed data

Reset the database, apply migrations, and seed with test data in one command:

```bash
yarn db:reset
```

This runs: `supabase db reset` → `setup-test-db.sql` (roles, functions, triggers) → Drizzle migrations → auth user creation → seed data.

A test user is created:

| Email | Password | Farm | Description |
|-------|----------|------|-------------|
| farmA@test.ch | 123456 | Miadi | Complete farm with animals, plots, crops, treatments, etc. |

### 4. Switching branches

When switching to a branch with a different schema, reset the DB:

```bash
git checkout <branch>
yarn db:reset
```

### 5. Import federal farm plots layer (optional)

If you need the full federal dataset (beyond what the seed provides):

```bash
PGPASSWORD='postgres' ogr2ogr -f "PostgreSQL" \
  PG:"dbname=postgres user=postgres host=127.0.0.1 port=54322" \
  farm_plots.shp \
  -nln 'federal_farm_plots' -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geometry -lco FID=id \
  -progress -overwrite
```

### 6. Start the server

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

## CI

Every push and pull request runs the full test suite on GitHub Actions (Ubuntu + Docker). The workflow also enforces typechecking (`tsc --noEmit`), formatting (`prettier --check`), and linting (`eslint`).

To run the same checks locally:

```bash
npx tsc --noEmit          # typecheck
npx prettier --check "src/**/*.ts"  # formatting
yarn lint                 # lint (--fix applies fixes)
yarn format               # auto-format all source files
yarn test                 # all tests
```

## Permissions

See [docs/permissions.md](docs/permissions.md) for the full permission model — which features require membership, what's implicitly covered by each permission, and the testphase override.

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
