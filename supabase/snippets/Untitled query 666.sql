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