# pastorino-backend

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Run dev environment

- checkout code with `git clone git@github.com:skloopa/pastorino-backend.git`
- install dependencies with `yarn install`
- add `.env` file with `DATABASE_URL="postgresql://postgres:postgres@localhost:6002/postgres`"
- run ` npx zenstack generate`
- you might have to restart TS-Server to pick up the generated types (VS Code -> actions -> Typescript: Restart TS server)
- make sure to have docker installed & running
- run `docker:up`
- create database `yarn db:push`
- install `gdal` with `brew install gdal`
- import shapefiles into database,

## Prepare Database

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

```bash
# parcels layer
# cd to folder with the .shp file parcels
ogr2ogr -f "PostgreSQL" PG:"dbname=postgres user=postgres password=postgres host=127.0.0.1 port=54322" farm_plots.shp -nln 'federal_farm_plots' -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geometry -lco FID=id
```

- seed database with 2 test users `yarn db:seed`
- start server with `yarn start`
- see documentation under at `http://localhost:8000/docs`
- set authorizatioin header for dev environemtn `Authorization` with semicolon seperated value `username;email` -> `battesta;battesta@miadi.ch`
- test if it works

```bash
curl --location 'localhost:8000/v1/layers/parcels/farms/GR3837%2F%201%2F105' \
--header 'Authorization: battesta;battesta@miadi.ch''
```

## Setup supabase local

`````
 API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local

       ```

Layers:
Bewirtschaftungseinheiten:https://www.geodienste.ch/services/lwb_bewirtschaftungseinheit
LN : https://www.geodienste.ch/services/lwb_perimeter_ln_sf

## Qgis operations

To aggregate parcels create virtual layer:

````SELECT
  ST_Union(geometry),
  ST_Centroid(ST_ConcaveHull(geometry, 0.99)) AS labelPoint,
  t_id as gisId,
  farm_id as fedFarmId,
  parcel_num as communalId,
  SUM(area_squar) AS area,
  GROUP_CONCAT(t_id) AS origGisIds
FROM parcels_agri
GROUP BY farm_id, parcel_num```
`````

ogr2ogr -f "ESRI Shapefile" parcels.shp PG:"dbname=postgres user=postgres password=postgres host=localhost port=6002" -sql "
SELECT
ST_Union(geometry) AS geom,
ST_Centroid(ST_ConcaveHull(geom, 0.99)) AS labelPoint,
\"gisId\",
\"fedFarmId\",
\"communalId\",
SUM(area) AS area,
STRING_AGG(\"gisId\"::text, ',') AS origGisIds
FROM federal_parcels
GROUP BY \"fedFarmId\", \"communalId\"
"
SELECT
merged.geometry,
ST_Centroid(merged.geometry) AS labelPoint,
merged."farmId" AS fedFarmId,
merged."parcelNum" AS communalId,
merged.area,
merged.origGisIds
FROM (
SELECT
ST_Union(geometry) AS geometry,
"farmId",
"parcelNum",
STRING_AGG("t_id"::text, ',') AS origGisIds,
SUM(area_squar) AS area
FROM parcels_agri
GROUP BY "farmId", "parcelNum"
) AS merged;

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
WHERE farm_id = 'VS00000013703768'
) AS sub;
```
