-- Demo data moves next to hazard zones in seven areas (Medan, Karo, Samosir, Tapanuli Tengah, Cianjur, Lumajang, Palu),
-- and staff demo accounts can switch which area they work in. Rows match web/src/data/mock.ts.

update public.countries set service_languages = '{Indonesia,English,BISINDO,"Batak Toba",Karo,Mandailing,Jawa,Minang,Sunda,Madura,Kaili}'
where code = 'ID';

-- Areas a demo staff account can switch to: the ones that have shelters.
create function public.work_areas() returns table (id text, name text) language sql stable security definer set search_path = '' as $$
  select a.id, a.name from public.operation_areas a
  where exists (select 1 from public.shelters s where s.operation_area_id = a.id)
  order by a.name
$$;
revoke execute on function public.work_areas() from public, anon;
grant execute on function public.work_areas() to authenticated;

-- shortcut: like the shelter/crew switch, self-service area switching only makes sense while every staff account is a
-- demo account; with real accounts the area comes from the BPBD that issued the account.
drop function public.switch_work(text, text);
create function public.switch_work(p_shelter text default null, p_volunteer text default null, p_area text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  scope text[];
begin
  if p_area is not null then
    perform private.require_role(array['coordinator', 'shelter_manager', 'volunteer']);
    if not exists (select 1 from public.shelters where operation_area_id = p_area) then raise exception 'not_found'; end if;
    update public.profiles p set operation_area_id = p_area,
      shelter_id = case when p.role = 'shelter_manager' then (select s.id from public.shelters s where s.operation_area_id = p_area order by s.id limit 1) else p.shelter_id end,
      volunteer_id = case when p.role = 'volunteer' then coalesce((select v.id from public.volunteers v where v.operation_area_id = p_area order by v.id limit 1), p.volunteer_id) else p.volunteer_id end
    where p.id = auth.uid();
  end if;
  scope := private.area_scope(private.my_area());
  if p_shelter is not null then
    perform private.require_role(array['shelter_manager']);
    if not exists (select 1 from public.shelters where id = p_shelter and operation_area_id = any (scope)) then raise exception 'not_found'; end if;
    update public.profiles set shelter_id = p_shelter where id = auth.uid();
  end if;
  if p_volunteer is not null then
    perform private.require_role(array['volunteer']);
    if not exists (select 1 from public.volunteers where id = p_volunteer and operation_area_id = any (scope)) then raise exception 'not_found'; end if;
    update public.profiles set volunteer_id = p_volunteer where id = auth.uid();
  end if;
  return '[]';
end $$;
revoke execute on function public.switch_work(text, text, text) from public, anon;
grant execute on function public.switch_work(text, text, text) to authenticated;

-- Reset: every shelter and volunteer not in the seed is removed (old in-city and test shelters included).
create function private.seed_demo_v2() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  delete from public.unmet_needs where true;
  delete from public.evacuation_assignments where true;
  delete from public.functional_needs where true;
  delete from public.family_units where true;
  delete from public.disaster_events where true;
  update public.profiles set shelter_id = null, volunteer_id = null where true;
  delete from public.shelters where true;

  insert into public.shelters (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
    has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
    backup_generator_capacity_watt, has_caregiver_rooms, supported_languages) values
  ('sh-01', 'Posko Gedung Serbaguna Titi Kuning', 'Jl. Serbaguna No. 1, Titi Kuning, Medan Johor', '0812-0000-0201', 3.553, 98.676, 60, 40, 'open', 'verified', true, true, true, true, 4, true, 3000, true, '{Indonesia,BISINDO}'),
  ('sh-02', 'Posko SD Negeri Petisah Tengah', 'Jl. Sekolah No. 12, Medan Petisah', '0812-0000-0202', 3.605, 98.672, 80, 35, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,"Batak Toba"}'),
  ('sh-03', 'Posko GOR Kelurahan Sidorame', 'Jl. Olahraga No. 3, Medan Perjuangan', '0812-0000-0203', 3.598, 98.701, 40, 28, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,Karo}'),
  ('sh-04', 'Posko Kantor Lurah Pangkalan Masyhur', 'Jl. Kelurahan No. 5, Medan Johor', '0812-0000-0204', 3.548, 98.685, 30, 5, 'open', 'unverified', true, true, true, true, 2, true, 2000, true, '{Indonesia}'),
  ('sh-05', 'Posko Aula Puskesmas Darussalam', 'Jl. Kesehatan No. 8, Medan Petisah', '0812-0000-0205', 3.604, 98.66, 14, 8, 'open', 'verified', true, true, true, true, 1, true, 1500, false, '{Indonesia,Karo}'),
  ('sh-06', 'Posko Balai Warga Kampung Aur', 'Jl. Tepi Sungai No. 2, Medan Maimun', '0812-0000-0206', 3.583, 98.682, 25, 0, 'closed_emergency', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia}'),
  ('sh-07', 'Posko SMP Negeri Medan Area', 'Jl. Pendidikan No. 9, Medan Area', '0812-0000-0207', 3.59, 98.705, 50, 50, 'full', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia}'),
  ('sh-08', 'Posko Jambur Desa Simpang Empat', 'Desa Simpang Empat, Kec. Simpang Empat, Karo', '0812-0000-0208', 3.13, 98.445, 120, 30, 'open', 'verified', true, true, true, true, 2, true, 2000, true, '{Indonesia,Karo}'),
  ('sh-09', 'Posko GOR Kabanjahe', 'Jl. Veteran, Kec. Kabanjahe, Karo', '0812-0000-0209', 3.103, 98.492, 200, 60, 'open', 'verified', true, true, true, true, 3, false, 0, false, '{Indonesia,Karo}'),
  ('sh-10', 'Posko Jambur Desa Tiganderket', 'Desa Tiganderket, Kec. Tiganderket, Karo', '0812-0000-0210', 3.232, 98.385, 80, 10, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Karo}'),
  ('sh-11', 'Posko Puskesmas Naman Teran', 'Kec. Naman Teran, Karo', '0812-0000-0211', 3.215, 98.455, 30, 0, 'open', 'unverified', true, true, true, true, 1, true, 1500, true, '{Indonesia,Karo}'),
  ('sh-12', 'Posko Aula Gereja Desa Hariara Pohan', 'Desa Hariara Pohan, Kec. Harian, Samosir', '0812-0000-0212', 2.585, 98.68, 100, 20, 'open', 'verified', true, true, true, true, 2, true, 1500, true, '{Indonesia,"Batak Toba"}'),
  ('sh-13', 'Posko Kantor Camat Harian', 'Kec. Harian, Samosir', '0812-0000-0213', 2.565, 98.665, 60, 10, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,"Batak Toba"}'),
  ('sh-14', 'Posko SMA Negeri 1 Pangururan', 'Kec. Pangururan, Samosir', '0812-0000-0214', 2.61, 98.7, 150, 40, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,"Batak Toba"}'),
  ('sh-15', 'Posko Aula Kantor Camat Tukka', 'Kec. Tukka, Tapanuli Tengah', '0812-0000-0215', 1.735, 98.88, 80, 15, 'open', 'verified', true, true, true, true, 2, true, 2000, true, '{Indonesia,"Batak Toba"}'),
  ('sh-16', 'Posko SMP Negeri Pandan', 'Kec. Pandan, Tapanuli Tengah', '0812-0000-0216', 1.665, 98.875, 120, 30, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,"Batak Toba"}'),
  ('sh-17', 'Posko Gedung Serbaguna Hutanabolon', 'Kec. Tukka, Tapanuli Tengah', '0812-0000-0217', 1.7, 98.905, 60, 10, 'open', 'unverified', true, true, true, true, 1, false, 0, false, '{Indonesia}'),
  ('sh-18', 'Posko Lapangan Prawatasari', 'Kec. Cianjur, Cianjur', '0812-0000-0218', -6.81, 107.14, 300, 50, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,Sunda}'),
  ('sh-19', 'Posko GOR Desa Sukaresmi', 'Kec. Sukaresmi, Cianjur', '0812-0000-0219', -6.76, 107.03, 100, 20, 'open', 'verified', true, true, true, true, 2, true, 3000, true, '{Indonesia,Sunda}'),
  ('sh-20', 'Posko SD Negeri Warungkondang', 'Kec. Warungkondang, Cianjur', '0812-0000-0220', -6.89, 107.06, 80, 10, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Sunda}'),
  ('sh-21', 'Posko Puskesmas Karangtengah', 'Kec. Karangtengah, Cianjur', '0812-0000-0221', -6.86, 107.13, 30, 5, 'open', 'unverified', true, true, true, true, 1, true, 2000, true, '{Indonesia,Sunda}'),
  ('sh-22', 'Posko Balai Desa Penanggal', 'Desa Penanggal, Kec. Candipuro, Lumajang', '0812-0000-0222', -8.2, 113.05, 200, 60, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Jawa,Madura}'),
  ('sh-23', 'Posko SD Negeri Pronojiwo', 'Kec. Pronojiwo, Lumajang', '0812-0000-0223', -8.22, 112.93, 120, 30, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia,Jawa}'),
  ('sh-24', 'Posko Gedung Serbaguna Candipuro', 'Kec. Candipuro, Lumajang', '0812-0000-0224', -8.15, 113.02, 150, 40, 'open', 'verified', true, true, true, true, 3, true, 3000, true, '{Indonesia,Jawa}'),
  ('sh-25', 'Posko Puskesmas Candipuro', 'Kec. Candipuro, Lumajang', '0812-0000-0225', -8.21, 113.01, 25, 0, 'open', 'unverified', true, true, true, true, 1, true, 1500, true, '{Indonesia,Jawa}'),
  ('sh-26', 'Posko Kampus Bukit Tondo', 'Kel. Tondo, Kec. Mantikulore, Palu', '0812-0000-0226', -0.835, 119.895, 300, 50, 'open', 'verified', true, true, true, true, 4, true, 3000, true, '{Indonesia,Kaili}'),
  ('sh-27', 'Posko Kelurahan Layana Indah', 'Kel. Layana Indah, Kec. Mantikulore, Palu', '0812-0000-0227', -0.862, 119.89, 100, 20, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Kaili}'),
  ('sh-28', 'Posko Lapangan Vatulemo', 'Kec. Palu Timur, Palu', '0812-0000-0228', -0.905, 119.875, 200, 30, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Kaili}'),
  ('sh-29', 'Posko SD Negeri Talise Atas', 'Kel. Talise, Kec. Mantikulore, Palu', '0812-0000-0229', -0.866, 119.892, 40, 0, 'open', 'unverified', true, true, true, true, 1, true, 1500, true, '{Indonesia,Kaili}');

  insert into public.volunteers (id, name, vehicle_type, plate, operation_area_id) values
  ('vol-01', 'Andi Pratama', 'wheelchair_accessible_van', 'BK 1402 AV', 'ID-SU-kota-medan'),
  ('vol-02', 'Budi Santoso', 'standard_car', 'BK 1877 RT', 'ID-SU-kota-medan'),
  ('vol-03', 'Tim Ambulans Kecamatan', 'ambulance', 'BK 9001 AM', 'ID-SU-kota-medan'),
  ('vol-04', 'Tim SAR Perahu Karet', 'boat', 'Perahu 02', 'ID-SU-kota-medan'),
  ('vol-05', 'Tim SAR Kabupaten Karo', 'wheelchair_accessible_van', 'BK 1288 KR', 'ID-SU-kab-karo'),
  ('vol-06', 'Relawan PMI Kabanjahe', 'bus', 'BK 7710 KR', 'ID-SU-kab-karo'),
  ('vol-07', 'Tim SAR Samosir', 'boat', 'KM Samosir 07', 'ID-SU-kab-samosir'),
  ('vol-08', 'Ambulans Puskesmas Pangururan', 'ambulance', 'BB 1102 SA', 'ID-SU-kab-samosir'),
  ('vol-09', 'Tim BPBD Tapanuli Tengah', 'wheelchair_accessible_van', 'BB 1450 TT', 'ID-SU-kab-tapanuli-tengah'),
  ('vol-10', 'Relawan Desa Tukka', 'standard_car', 'BB 1820 TT', 'ID-SU-kab-tapanuli-tengah'),
  ('vol-11', 'Tim Tagana Cianjur', 'wheelchair_accessible_van', 'F 1307 CJ', 'ID-JB-kab-cianjur'),
  ('vol-12', 'Ambulans Desa Cugenang', 'ambulance', 'F 9011 CJ', 'ID-JB-kab-cianjur'),
  ('vol-13', 'Tim SAR Lumajang', 'wheelchair_accessible_van', 'N 1188 LM', 'ID-JI-kab-lumajang'),
  ('vol-14', 'Truk Evakuasi Candipuro', 'bus', 'N 8076 LM', 'ID-JI-kab-lumajang'),
  ('vol-15', 'Tim BPBD Kota Palu', 'wheelchair_accessible_van', 'DN 1209 PL', 'ID-ST-kota-palu'),
  ('vol-16', 'Relawan Kelurahan Talise', 'standard_car', 'DN 1755 PL', 'ID-ST-kota-palu')
  on conflict (id) do update set name = excluded.name, vehicle_type = excluded.vehicle_type, plate = excluded.plate, operation_area_id = excluded.operation_area_id;

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
    ('fam-12', 'Keluarga Sitompul', 4, 3.588, 98.6705, 'Rumah sudut', 'self'),
    ('fam-13', 'Keluarga Tarigan', 5, 3.195, 98.405, 'Desa Sukanalu, rumah dekat jambur', 'self'),
    ('fam-14', 'Keluarga Sitepu', 4, 3.15, 98.42, 'Desa Gamber, ladang jeruk', 'caregiver'),
    ('fam-15', 'Keluarga Perangin-angin', 6, 3.14, 98.385, 'Desa Kuta Rakyat, ujung jalan desa', 'self'),
    ('fam-16', 'Keluarga Barus', 3, 3.18, 98.425, 'Desa Kuta Gugung, depan losd', 'self'),
    ('fam-17', 'Keluarga Sinulingga', 4, 3.205, 98.37, 'Desa Mardinding, rumah adat', 'self'),
    ('fam-18', 'Keluarga Sinaga', 4, 2.545, 98.64, 'Kaki tebing, dekat dermaga kecil', 'self'),
    ('fam-19', 'Keluarga Simbolon', 3, 2.53, 98.655, 'Tepi sungai, rumah kayu', 'caregiver'),
    ('fam-20', 'Keluarga Naibaho', 5, 2.552, 98.632, 'Jalan desa menanjak, rumah batu', 'self'),
    ('fam-21', 'Keluarga Situmorang', 2, 2.538, 98.63, 'Samping gereja desa', 'self'),
    ('fam-22', 'Keluarga Hutagalung', 5, 1.705, 98.865, 'Bantaran sungai, rumah panggung', 'self'),
    ('fam-23', 'Keluarga Pasaribu', 3, 1.695, 98.872, 'Dekat jembatan gantung', 'caregiver'),
    ('fam-24', 'Keluarga Panggabean', 4, 1.712, 98.855, 'Lereng bukit, kebun karet', 'self'),
    ('fam-25', 'Keluarga Sihombing', 6, 1.69, 98.85, 'Ujung kampung, dekat aliran sungai', 'self'),
    ('fam-26', 'Keluarga Hidayat', 4, -6.8, 107.08, 'Desa Cijedil, rumah tembok retak', 'self'),
    ('fam-27', 'Keluarga Saepudin', 5, -6.83, 107.05, 'Desa Cibereum, dekat masjid', 'self'),
    ('fam-28', 'Keluarga Rohman', 3, -6.84, 107.09, 'Kampung Nagrak, gang sempit', 'caregiver'),
    ('fam-29', 'Keluarga Suryana', 6, -6.81, 107.06, 'Desa Gasol, kebun teh', 'self'),
    ('fam-30', 'Keluarga Sutrisno', 4, -8.17, 112.98, 'Desa Sumberwuluh, dekat aliran lahar', 'self'),
    ('fam-31', 'Keluarga Fauzi', 5, -8.16, 112.97, 'Dusun Curah Kobokan', 'caregiver'),
    ('fam-32', 'Keluarga Wahyudi', 3, -8.15, 112.95, 'Tepi tambang pasir', 'self'),
    ('fam-33', 'Keluarga Susanto', 6, -8.19, 112.97, 'Dusun Kamar Kajang', 'self'),
    ('fam-34', 'Keluarga Lasaeba', 4, -0.875, 119.875, 'Dekat Pantai Talise', 'self'),
    ('fam-35', 'Keluarga Tombolotutu', 5, -0.89, 119.866, 'Kompleks rumah nelayan', 'caregiver'),
    ('fam-36', 'Keluarga Lamarauna', 3, -0.882, 119.878, 'Belakang pasar ikan', 'self'),
    ('fam-37', 'Keluarga Pettalolo', 6, -0.892, 119.872, 'Jalan lorong, rumah dua lantai', 'self')
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
  ('fam-12', false, false, false, false, 0, false, 'Indonesia', 0, 0),
  ('fam-13', true, false, true, false, 0, false, 'Karo', 0, 0),
  ('fam-14', true, false, false, true, 400, true, 'Karo', 0, 0),
  ('fam-15', false, false, false, false, 0, false, 'Karo', 1, 1),
  ('fam-16', false, true, false, false, 0, false, 'Karo', 0, 0),
  ('fam-17', false, false, false, false, 0, false, 'Karo', 0, 0),
  ('fam-18', false, false, false, false, 0, false, 'Batak Toba', 0, 0),
  ('fam-19', true, false, false, true, 300, false, 'Indonesia', 0, 0),
  ('fam-20', true, false, true, false, 0, true, 'Indonesia', 0, 0),
  ('fam-21', false, true, false, false, 0, false, 'Batak Toba', 0, 0),
  ('fam-22', false, false, false, false, 0, false, 'Indonesia', 0, 0),
  ('fam-23', true, false, false, true, 500, true, 'Indonesia', 0, 0),
  ('fam-24', false, false, false, false, 0, false, 'Indonesia', 1, 0),
  ('fam-25', true, true, true, false, 0, false, 'Indonesia', 0, 0),
  ('fam-26', true, false, false, true, 600, true, 'Sunda', 0, 0),
  ('fam-27', false, false, false, false, 0, false, 'Sunda', 1, 1),
  ('fam-28', true, false, true, false, 0, false, 'Indonesia', 0, 0),
  ('fam-29', false, false, false, false, 0, false, 'Sunda', 0, 0),
  ('fam-30', true, true, false, false, 0, false, 'Jawa', 0, 0),
  ('fam-31', true, false, true, true, 800, false, 'Indonesia', 0, 0),
  ('fam-32', false, false, false, false, 0, false, 'Madura', 0, 0),
  ('fam-33', false, false, false, false, 0, false, 'Jawa', 2, 0),
  ('fam-34', true, false, false, false, 0, true, 'Indonesia', 0, 0),
  ('fam-35', true, false, false, true, 400, false, 'Indonesia', 0, 0),
  ('fam-36', false, false, false, false, 0, false, 'Kaili', 0, 1),
  ('fam-37', true, true, true, false, 0, false, 'Indonesia', 0, 0);
  delete from public.volunteers where id not in ('vol-01', 'vol-02', 'vol-03', 'vol-04', 'vol-05', 'vol-06', 'vol-07', 'vol-08',
    'vol-09', 'vol-10', 'vol-11', 'vol-12', 'vol-13', 'vol-14', 'vol-15', 'vol-16');

  insert into public.disaster_events (id, source, type, title, magnitude, depth_km, lat, lng, radius_km, status, time) values
  ('evt-bmkg-01', 'bmkg', 'earthquake', 'Gempa M5,3 — 32 km BaratDaya Kabanjahe', 5.3, 10, 2.92, 98.3, 15, 'draft', '2026-10-17T08:41:00+07:00');

  -- Demo accounts start in Kota Medan: shelter manager at sh-01, volunteer Andi (wheelchair van).
  update public.profiles set operation_area_id = 'ID-SU-kota-medan',
    shelter_id = case when role = 'shelter_manager' then 'sh-01' end,
    volunteer_id = case when role = 'volunteer' then 'vol-01' end
  where true;
end $fn$;

create or replace function private.seed_demo() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform private.seed_demo_v2();
end $fn$;

select private.seed_demo();
