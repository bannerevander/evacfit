-- Test data (fictional names, real-world-ish points) so small and large hazard radii, referrals and cross-border
-- placement can be tried. Areas are set by the PostGIS trigger. Remove with: delete from public.shelters where id like 'sh-t%';
insert into public.shelters (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
  has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
  backup_generator_capacity_watt, has_caregiver_rooms, supported_languages) values
  ('sh-t01', 'Posko Uji Belawan', 'Medan Belawan', '0812-0000-0301', 3.7800, 98.6800, 60, 10, 'open', 'verified', true, true, true, true, 2, true, 2500, true, '{Indonesia}'),
  ('sh-t02', 'Posko Uji Marelan', 'Medan Marelan', '0812-0000-0302', 3.7200, 98.6600, 80, 20, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia,Batak Toba}'),
  ('sh-t03', 'Posko Uji Tuntungan', 'Medan Tuntungan', '0812-0000-0303', 3.5000, 98.6200, 40, 5, 'open', 'verified', true, true, true, true, 2, false, 0, true, '{Indonesia,Karo}'),
  ('sh-t04', 'Posko Uji Amplas', 'Medan Amplas', '0812-0000-0304', 3.5300, 98.7100, 50, 10, 'open', 'verified', true, true, true, true, 1, true, 1500, false, '{Indonesia}'),
  ('sh-t05', 'Posko Uji Denai', 'Medan Denai', '0812-0000-0305', 3.5700, 98.7300, 30, 0, 'open', 'verified', false, false, false, true, 1, false, 0, false, '{Indonesia}'),
  ('sh-t06', 'Posko Uji Sunggal', 'Medan Sunggal', '0812-0000-0306', 3.5900, 98.6100, 70, 15, 'open', 'verified', true, true, true, true, 3, true, 3000, true, '{Indonesia,BISINDO}'),
  ('sh-t07', 'Posko Uji Percut Sei Tuan', 'Percut Sei Tuan, Deli Serdang', '0812-0000-0307', 3.6300, 98.7600, 60, 10, 'open', 'verified', true, true, true, true, 2, false, 0, false, '{Indonesia}'),
  ('sh-t08', 'Posko Uji Tanjung Morawa', 'Tanjung Morawa, Deli Serdang', '0812-0000-0308', 3.5200, 98.7900, 50, 5, 'open', 'verified', true, true, true, true, 2, true, 2000, true, '{Indonesia,Jawa}'),
  ('sh-t09', 'Posko Uji Lubuk Pakam', 'Lubuk Pakam, Deli Serdang', '0812-0000-0309', 3.5550, 98.8700, 100, 30, 'open', 'verified', false, false, false, false, 0, false, 0, false, '{Indonesia}'),
  ('sh-t10', 'Posko Uji Pancur Batu', 'Pancur Batu, Deli Serdang', '0812-0000-0310', 3.4600, 98.6000, 40, 0, 'open', 'unverified', true, true, true, true, 1, true, 1000, true, '{Indonesia,Karo}')
on conflict (id) do nothing;
