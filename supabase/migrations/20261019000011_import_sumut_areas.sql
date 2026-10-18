-- Step 2: insert the 33 North Sumatra kabupaten/kota from the downloaded file (run once step 1's response has arrived;
-- pg_net keeps responses for 6 hours). Coordinates snapped to 0.0001 deg (~11 m). Re-running replaces rows.
with file as (
  select content::jsonb as j from net._http_response
  where status_code = 200 and content like '%"shapeGroup": "IDN"%' and content like '%"shapeType": "ADM2"%'
  order by created desc limit 1
), unit as (
  select f -> 'properties' ->> 'shapeName' as raw, f -> 'properties' ->> 'shapeID' as code, f -> 'geometry' as geom
  from file, jsonb_array_elements(j -> 'features') f
), sumut as (
  select case when raw like 'Kota %' then raw else 'Kab. ' || raw end as name, code, geom from unit
  where raw in ('Asahan', 'Batu Bara', 'Dairi', 'Deli Serdang', 'Humbang Hasundutan', 'Karo', 'Kota Binjai', 'Kota Gunungsitoli',
    'Kota Medan', 'Kota Padangsidimpuan', 'Kota Pematang Siantar', 'Kota Sibolga', 'Kota Tanjung Balai', 'Kota Tebing Tinggi',
    'Labuhan Batu', 'Labuhan Batu Selatan', 'Labuhan Batu Utara', 'Langkat', 'Mandailing Natal', 'Nias', 'Nias Barat', 'Nias Selatan',
    'Nias Utara', 'Padang Lawas', 'Padang Lawas Utara', 'Pakpak Bharat', 'Samosir', 'Serdang Bedagai', 'Simalungun',
    'Tapanuli Selatan', 'Tapanuli Tengah', 'Tapanuli Utara', 'Toba Samosir')
)
insert into public.operation_areas (id, country_code, name, admin_level, source, source_code, boundary)
select 'ID-SU-' || trim(both '-' from regexp_replace(lower(replace(name, 'Kab. ', 'kab-')), '[^a-z0-9]+', '-', 'g')),
  'ID', name, 2, 'geoBoundaries IDN ADM2 (BPS/WFP/OCHA)', code,
  extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(
    extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_geomfromgeojson(geom::text), 4326), 0.0001)), 3))::extensions.geography
from sumut
on conflict (id) do update set name = excluded.name, boundary = excluded.boundary, source = excluded.source, source_code = excluded.source_code;

do $$ begin
  if (select count(*) from public.operation_areas where id like 'ID-SU-%') <> 33 then
    raise exception 'North Sumatra import incomplete: run step 1 again and wait for the download';
  end if;
end $$;
