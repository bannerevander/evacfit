-- Demo data = web/src/data/mock.ts (fictional, "Data contoh"). reset_demo() reloads it, so the seed lives in one function.
create function private.seed_demo() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.unmet_needs where true;
  delete from public.evacuation_assignments where true;
  delete from public.functional_needs where true;
  delete from public.family_units where true;
  delete from public.disaster_events where true;

  insert into public.shelters as s (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
    has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
    backup_generator_capacity_watt, has_caregiver_rooms, supported_languages) values
  ('sh-01', 'Posko Gedung Serbaguna Padang Bulan', 'Jl. Serbaguna No. 1, Medan Baru', '0812-0000-0201', 3.5614, 98.6567, 60, 40, 'open', 'verified', true, true, true, true, 4, true, 3000, true, '{Indonesia,BISINDO}'),
  ('sh-02', 'Posko SD Negeri Sei Sikambing', 'Jl. Sekolah No. 12, Medan Petisah', '0812-0000-0202', 3.6004, 98.6656, 80, 35, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Batak Toba}'),
  ('sh-03', 'Posko GOR Kecamatan Medan Timur', 'Jl. Olahraga No. 3, Medan Timur', '0812-0000-0203', 3.5927, 98.709, 40, 28, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,Karo}'),
  ('sh-04', 'Posko Kantor Camat Medan Johor', 'Jl. Kecamatan No. 5, Medan Johor', '0812-0000-0204', 3.53, 98.675, 30, 5, 'open', 'unverified', true, true, true, true, 2, true, 2000, true, '{Indonesia}'),
  ('sh-05', 'Posko Aula Puskesmas Helvetia', 'Jl. Kesehatan No. 8, Medan Helvetia', '0812-0000-0205', 3.605, 98.635, 14, 8, 'open', 'verified', true, true, true, true, 1, true, 1500, false, '{Indonesia,Karo}'),
  ('sh-06', 'Posko Balai Warga Kampung Aur', 'Jl. Tepi Sungai No. 2, Medan Maimun', '0812-0000-0206', 3.583, 98.682, 25, 0, 'closed_emergency', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia}'),
  ('sh-07', 'Posko SMP Negeri Medan Perjuangan', 'Jl. Pendidikan No. 9, Medan Perjuangan', '0812-0000-0207', 3.612, 98.695, 50, 50, 'full', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia}')
  on conflict (id) do update set name = excluded.name, address = excluded.address, contact = excluded.contact, lat = excluded.lat, lng = excluded.lng,
    total_capacity = excluded.total_capacity, current_occupancy = excluded.current_occupancy, operational_status = excluded.operational_status,
    verification_status = excluded.verification_status, has_ramp = excluded.has_ramp, ramp_slope_compliant = excluded.ramp_slope_compliant,
    door_width_accessible = excluded.door_width_accessible, has_accessible_toilet = excluded.has_accessible_toilet,
    accessible_toilet_count = excluded.accessible_toilet_count, has_medical_power = excluded.has_medical_power,
    backup_generator_capacity_watt = excluded.backup_generator_capacity_watt, has_caregiver_rooms = excluded.has_caregiver_rooms,
    supported_languages = excluded.supported_languages;

  insert into public.volunteers (id, name, vehicle_type, plate) values
  ('vol-01', 'Andi Pratama', 'wheelchair_accessible_van', 'BK 1402 AV'),
  ('vol-02', 'Budi Santoso', 'standard_car', 'BK 1877 RT'),
  ('vol-03', 'Tim Ambulans Kecamatan', 'ambulance', 'BK 9001 AM'),
  ('vol-04', 'Tim SAR Perahu Karet', 'boat', 'Perahu 02')
  on conflict (id) do update set name = excluded.name, vehicle_type = excluded.vehicle_type, plate = excluded.plate;

  insert into public.family_units (id, code, family_name, member_count, contact_phone, lat, lng, address_notes, registered_via, owner_id)
  select v.id, 'EVF-' || right(v.id, 2) || 'KE', v.name, v.n, '0812-0000-01' || right(v.id, 2), v.lat, v.lng, v.notes, v.via,
         case when v.id in ('fam-01', 'fam-02', 'fam-03') then (select id from auth.users where email = 'warga@evacfit.demo') end
  from (values
    ('fam-01', 'Keluarga Siregar', 4, 3.5862, 98.6791, 'Rumah cat hijau dekat musala', 'self'),
    ('fam-02', 'Keluarga Nasution', 3, 3.5741, 98.6833, 'Gang buntu, rumah kedua kiri', 'caregiver'),
    ('fam-03', 'Keluarga Lubis', 2, 3.579, 98.6712, 'Samping warung kelontong', 'caregiver'),
    ('fam-04', 'Keluarga Harahap', 5, 3.5888, 98.688, 'Rumah panggung tepi sungai', 'self'),
    ('fam-05', 'Keluarga Tanjung', 6, 3.5705, 98.676, 'Depan lapangan voli', 'self'),
    ('fam-06', 'Keluarga Sembiring', 3, 3.5845, 98.6905, 'Belakang sekolah', 'self'),
    ('fam-07', 'Keluarga Ginting', 4, 3.5768, 98.688, 'Rumah pagar biru', 'self'),
    ('fam-08', 'Keluarga Simanjuntak', 5, 3.5915, 98.6745, 'Lorong samping gereja', 'self'),
    ('fam-09', 'Keluarga Hasibuan', 7, 3.573, 98.6905, 'Rumah dua lantai, lantai dasar', 'self'),
    ('fam-10', 'Keluarga Pohan', 2, 3.582, 98.669, 'Kios jahit', 'self'),
    ('fam-11', 'Keluarga Daulay', 6, 3.5695, 98.6845, 'Ujung gang, dekat jembatan', 'self'),
    ('fam-12', 'Keluarga Sitompul', 4, 3.588, 98.6705, 'Rumah sudut', 'self')
  ) as v(id, name, n, lat, lng, notes, via);

  insert into public.functional_needs (family_id, no_stairs_required, accessible_toilet_needed, caregiver_space_needed, medical_power_required,
    min_power_wattage, wheelchair_vehicle_needed, preferred_language, infant_count, pregnant_count) values
  ('fam-01', true, true, false, true, 600, true, 'Indonesia', 0, 0),
  ('fam-02', true, false, true, false, 0, true, 'BISINDO', 0, 0),
  ('fam-03', true, false, false, true, 300, false, 'Indonesia', 0, 0),
  ('fam-04', false, false, false, false, 0, false, 'Indonesia', 1, 1),
  ('fam-05', false, false, false, false, 0, false, 'Indonesia', 0, 0),
  ('fam-06', false, true, false, false, 0, false, 'Karo', 0, 0),
  ('fam-07', true, false, true, true, 1200, false, 'Indonesia', 0, 0),
  ('fam-08', false, false, false, false, 0, false, 'Batak Toba', 0, 0),
  ('fam-09', true, true, true, false, 0, false, 'Indonesia', 0, 0),
  ('fam-10', true, false, false, true, 500, false, 'Indonesia', 0, 0),
  ('fam-11', true, false, true, true, 1000, false, 'Indonesia', 0, 0),
  ('fam-12', false, false, false, false, 0, false, 'Indonesia', 0, 0);

  insert into public.disaster_events (id, source, type, title, magnitude, depth_km, lat, lng, radius_km, status, time) values
  ('evt-bmkg-01', 'bmkg', 'earthquake', 'Gempa M5,3 — 32 km BaratDaya Kabanjahe', 5.3, 10, 2.92, 98.3, 15, 'draft', '2026-10-17T08:41:00+07:00');
end $$;

/** "Reset demo data" button. Any signed-in demo account may use it (all data is fictional). */
create function public.reset_demo() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  perform private.seed_demo();
  return '[]';
end $$;
revoke execute on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;

-- Four demo accounts, one per role (test credentials for the jury; documented in web/README.md).
do $$
declare
  email text;
  uid uuid;
begin
  foreach email in array array['koordinator@evacfit.demo', 'posko@evacfit.demo', 'relawan@evacfit.demo', 'warga@evacfit.demo'] loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
      extensions.crypt('EvacFit-Demo-2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true), 'email', now(), now(), now());
  end loop;
end $$;

select private.seed_demo();

insert into public.profiles (id, role, display_name, shelter_id, volunteer_id)
select u.id, t.role, t.display_name, t.shelter_id, t.volunteer_id
from (values
  ('koordinator@evacfit.demo', 'coordinator', 'Koordinator BPBD (demo)', null, null),
  ('posko@evacfit.demo', 'shelter_manager', 'Pengelola Posko Padang Bulan (demo)', 'sh-01', null),
  ('relawan@evacfit.demo', 'volunteer', 'Andi Pratama (demo)', null, 'vol-01'),
  ('warga@evacfit.demo', 'citizen', 'Warga Siregar (demo)', null, null)
) as t(email, role, display_name, shelter_id, volunteer_id)
join auth.users u on u.email = t.email;
