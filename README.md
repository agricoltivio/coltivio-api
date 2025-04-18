# coltivio-api

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Run dev environment

- checkout code with `git clone git@github.com:agricoltivio/coltivio-api.git`
- install dependencies with `yarn install`
- setup local supabase environment (see [https://supabase.com/docs/guides/local-development](https://supabase.com/docs/guides/local-development))
- install `gdal` with `brew install gdal`
- import shapefiles into database,

## Prepare Database

### enable extensions

- postgis
- pg_trgm

### Create trigger functio to set farm id in current settigs when creating a farm

```sql
create user rls_client with password 'rls' noinherit;
grant authenticated to rls_client;
grant anon to rls_client;
ALTER ROLE rls_client SET search_path TO "$user", public, extensions;

------------------

create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;


create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


  ------------
  create or replace function public.update_profile()
  returns trigger
  set search_path = ''
  as $$
begin
  update public.profiles
  set (email,full_name) = (new.email,new.raw_user_meta_data->>'full_name')
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;
create trigger update_profile
  after update on auth.users
  for each row
  execute procedure public.update_profile();
```

### Add helper function to retrieve farm id

```sql
create or replace function farm_id()
returns uuid
language sql stable
as $$
  select
   nullif(
       current_setting('request.farm_id', true),
     ''
     )::uuid
$$;
```

## Import layer

```bash
# parcels layer
# cd to folder with the .shp file parcels
ogr2ogr -f "PostgreSQL" PG:"dbname=postgres user=postgres password=postgres host=127.0.0.1 port=54322" farm_plots.shp -nln 'federal_farm_plots' -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geometry -lco FID=id -progress -overwrite
```

- start server with `yarn start`
- see documentation under at `http://localhost:8000/docs`

## Additional notes

### aggregate gemoetries for same farm and same usage code within same parcel

```sql
INSERT INTO
  federal_farm_plots (
    local_id,
    farm_id,
    usage,
    canton,
    cut_date,
    area,
    geometry
  )
SELECT
  local_id,
  farm_id,
  usage,
  min(canton) as canton,
  MIN(cut_date) as cut_date,
  SUM(area) AS area,
  ST_Multi (ST_Union (ST_MakeValid (geometry))) AS geometry
FROM
  aggr_temp
WHERE
  local_id IS NOT NULL
  and farm_id is not null
GROUP BY
  local_id,
  farm_id,
  usage
UNION ALL
-- Unaggregated features with unknown local_id
SELECT
  local_id,
  farm_id,
  usage,
  canton,
  cut_date,
  area,
  geometry
FROM
  aggr_temp
WHERE
  local_id IS NULL
  and farm_id is not null;
```

### geoadmin api get parcels for bbox

```sql
SELECT
ST_XMin(box)::TEXT || ',' ||
ST_YMin(box)::TEXT || ',' ||
ST_XMax(box)::TEXT || ',' ||
ST_YMax(box)::TEXT AS esri_envelope
FROM (
SELECT ST_Extent(geometry) AS box
FROM aggr_temp
WHERE farm_id = ''
) AS sub;
```
