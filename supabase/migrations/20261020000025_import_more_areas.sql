-- Step 2: Cianjur (West Java), Lumajang (East Java), Kota Palu + Sigi + Donggala (Central Sulawesi) from the downloaded file.
with file as (
  select content::jsonb as j from net._http_response
  where status_code = 200 and content like '%"shapeGroup": "IDN"%' and content like '%"shapeType": "ADM2"%'
  order by created desc limit 1
), unit as (
  select f -> 'properties' ->> 'shapeName' as raw, f -> 'properties' ->> 'shapeID' as code, f -> 'geometry' as geom
  from file, jsonb_array_elements(j -> 'features') f
), picked as (
  select case when raw like 'Kota %' then raw else 'Kab. ' || raw end as name, p.prov, code, geom
  from unit join (values ('Cianjur', 'JB'), ('Lumajang', 'JI'), ('Kota Palu', 'ST'), ('Sigi', 'ST'), ('Donggala', 'ST')) as p(raw_name, prov)
    on unit.raw = p.raw_name
)
insert into public.operation_areas (id, country_code, name, admin_level, source, source_code, boundary)
select 'ID-' || prov || '-' || trim(both '-' from regexp_replace(lower(replace(name, 'Kab. ', 'kab-')), '[^a-z0-9]+', '-', 'g')),
  'ID', name, 2, 'geoBoundaries IDN ADM2 (BPS/WFP/OCHA)', code,
  extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(
    extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_geomfromgeojson(geom::text), 4326), 0.0001)), 3))::extensions.geography
from picked
on conflict (id) do update set name = excluded.name, boundary = excluded.boundary, source = excluded.source, source_code = excluded.source_code;

do $$ begin
  if (select count(*) from public.operation_areas where id in ('ID-JB-kab-cianjur', 'ID-JI-kab-lumajang', 'ID-ST-kota-palu', 'ID-ST-kab-sigi', 'ID-ST-kab-donggala')) <> 5 then
    raise exception 'Import incomplete: run step 1 again and wait for the download';
  end if;
end $$;

select private.refresh_areas();
