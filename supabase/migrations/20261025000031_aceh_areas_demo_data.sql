-- Step 2: Aceh Tamiang (Sungai Tamiang floods) and Kota Banda Aceh (tsunami) from the downloaded file, plus their demo
-- shelters, crews and families. Rows match web/src/data/mock.ts. Additive: existing data in other areas is untouched.
with file as (
  select content::jsonb as j from net._http_response
  where status_code = 200 and content like '%"shapeGroup": "IDN"%' and content like '%"shapeType": "ADM2"%'
  order by created desc limit 1
), unit as (
  select f -> 'properties' ->> 'shapeName' as raw, f -> 'properties' ->> 'shapeID' as code, f -> 'geometry' as geom
  from file, jsonb_array_elements(j -> 'features') f
), picked as (
  select case when raw like 'Kota %' then raw else 'Kab. ' || raw end as name, code, geom
  from unit where raw in ('Aceh Tamiang', 'Kota Banda Aceh')
)
insert into public.operation_areas (id, country_code, name, admin_level, source, source_code, boundary)
select 'ID-AC-' || trim(both '-' from regexp_replace(lower(replace(name, 'Kab. ', 'kab-')), '[^a-z0-9]+', '-', 'g')),
  'ID', name, 2, 'geoBoundaries IDN ADM2 (BPS/WFP/OCHA)', code,
  extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(
    extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_geomfromgeojson(geom::text), 4326), 0.0001)), 3))::extensions.geography
from picked
on conflict (id) do update set name = excluded.name, boundary = excluded.boundary, source = excluded.source, source_code = excluded.source_code;

do $$ begin
  if (select count(*) from public.operation_areas where id in ('ID-AC-kab-aceh-tamiang', 'ID-AC-kota-banda-aceh')) <> 2 then
    raise exception 'Import incomplete: run step 1 again and wait for the download';
  end if;
end $$;

select private.refresh_areas();

update public.countries set service_languages = array_append(service_languages, 'Aceh')
where code = 'ID' and not 'Aceh' = any (service_languages);

create function private.seed_aceh() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.shelters (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
    has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
    backup_generator_capacity_watt, has_caregiver_rooms, supported_languages) values
  ('sh-30', 'Posko Aula Kantor Bupati Aceh Tamiang', 'Kec. Karang Baru, Aceh Tamiang', '0812-0000-0230', 4.312, 98.035, 150, 30, 'open', 'verified', true, true, true, true, 3, true, 3000, true, '{Indonesia,Aceh}'),
  ('sh-31', 'Posko SMA Negeri 1 Karang Baru', 'Kec. Karang Baru, Aceh Tamiang', '0812-0000-0231', 4.305, 98.025, 100, 20, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Aceh}'),
  ('sh-32', 'Posko Puskesmas Rantau', 'Kec. Rantau, Aceh Tamiang', '0812-0000-0232', 4.315, 98.09, 30, 0, 'open', 'unverified', true, true, true, true, 1, true, 1500, true, '{Indonesia}'),
  ('sh-33', 'Posko Lapangan Blang Padang', 'Kec. Baiturrahman, Banda Aceh', '0812-0000-0233', 5.552, 95.32, 300, 50, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,Aceh}'),
  ('sh-34', 'Posko Gedung Serbaguna Darussalam', 'Kec. Syiah Kuala, Banda Aceh', '0812-0000-0234', 5.57, 95.37, 200, 30, 'open', 'verified', true, true, true, true, 3, true, 3000, true, '{Indonesia,Aceh}'),
  ('sh-35', 'Posko Puskesmas Lueng Bata', 'Kec. Lueng Bata, Banda Aceh', '0812-0000-0235', 5.53, 95.34, 30, 0, 'open', 'unverified', true, true, true, true, 1, true, 1500, true, '{Indonesia,Aceh}')
  on conflict (id) do update set name = excluded.name, address = excluded.address, lat = excluded.lat, lng = excluded.lng,
    total_capacity = excluded.total_capacity, current_occupancy = excluded.current_occupancy, operational_status = excluded.operational_status,
    verification_status = excluded.verification_status;

  insert into public.volunteers (id, name, vehicle_type, plate, operation_area_id) values
  ('vol-17', 'Tim BPBD Aceh Tamiang', 'boat', 'Perahu AT 01', 'ID-AC-kab-aceh-tamiang'),
  ('vol-18', 'Ambulans RSUD Aceh Tamiang', 'wheelchair_accessible_van', 'BL 1317 AT', 'ID-AC-kab-aceh-tamiang'),
  ('vol-19', 'Tim SAR Banda Aceh', 'wheelchair_accessible_van', 'BL 1204 BA', 'ID-AC-kota-banda-aceh'),
  ('vol-20', 'Relawan Gampong Meuraxa', 'standard_car', 'BL 1630 BA', 'ID-AC-kota-banda-aceh')
  on conflict (id) do update set name = excluded.name, vehicle_type = excluded.vehicle_type, plate = excluded.plate, operation_area_id = excluded.operation_area_id;

  insert into public.family_units (id, code, family_name, member_count, contact_phone, lat, lng, address_notes, registered_via)
  select v.id, 'EVF-' || right(v.id, 2) || 'KE', v.name, v.n, '0812-0000-01' || right(v.id, 2), v.lat, v.lng, v.notes, v.via
  from (values
    ('fam-38', 'Keluarga Muhammad Yusuf', 5, 4.279, 98.062, 'Kuala Simpang, rumah tepi Sungai Tamiang', 'self'),
    ('fam-39', 'Keluarga Ibrahim', 3, 4.274, 98.066, 'Gang dekat pasar Kuala Simpang', 'caregiver'),
    ('fam-40', 'Keluarga Abdullah', 6, 4.283, 98.058, 'Rumah panggung, dekat jembatan', 'self'),
    ('fam-41', 'Keluarga Ismail', 4, 4.271, 98.06, 'Kampung Bukit Rata, lantai satu', 'self'),
    ('fam-42', 'Keluarga Teuku Hasan', 4, 5.56, 95.298, 'Gampong Ulee Lheue, dekat pantai', 'self'),
    ('fam-43', 'Keluarga Zulkifli', 3, 5.562, 95.296, 'Gampong Punge, rumah satu lantai', 'caregiver'),
    ('fam-44', 'Keluarga Mahmud', 6, 5.565, 95.302, 'Gampong Lampaseh, dekat tambak', 'self'),
    ('fam-45', 'Keluarga Nurdin', 2, 5.558, 95.292, 'Belakang meunasah', 'self')
  ) as v(id, name, n, lat, lng, notes, via)
  on conflict (id) do nothing;

  insert into public.functional_needs (family_id, no_stairs_required, accessible_toilet_needed, caregiver_space_needed, medical_power_required,
    min_power_wattage, wheelchair_vehicle_needed, preferred_language, infant_count, pregnant_count) values
  ('fam-38', true, false, false, true, 500, true, 'Aceh', 0, 0),
  ('fam-39', true, true, true, false, 0, false, 'Indonesia', 0, 0),
  ('fam-40', false, false, false, false, 0, false, 'Aceh', 1, 1),
  ('fam-41', false, false, false, false, 0, false, 'Indonesia', 0, 0),
  ('fam-42', true, false, false, true, 600, true, 'Aceh', 0, 0),
  ('fam-43', true, false, true, false, 0, false, 'Indonesia', 0, 0),
  ('fam-44', false, false, false, false, 0, false, 'Aceh', 2, 0),
  ('fam-45', false, true, false, false, 0, false, 'Aceh', 0, 0)
  on conflict (family_id) do nothing;
end $fn$;

-- A full reseed (seed_demo_v2 wipes everything) brings the Aceh rows back too.
create or replace function private.seed_demo() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform private.seed_demo_v2();
  perform private.seed_aceh();
end $fn$;

select private.seed_aceh();
