-- SHLT-3: changed accessibility claims go back to "needs inspection". The form already sends verificationStatus =
-- 'unverified' when facilities change; the server now honours that, but a client can only lower the status, never raise it.
create or replace function public.save_shelter(s jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  x jsonb := s -> 'features';
  old public.shelters;
  moved boolean;
begin
  perform private.require_shelter(s ->> 'id');
  select * into old from public.shelters where id = s ->> 'id' for update;
  if not found then raise exception 'not_found'; end if;
  moved := (s ->> 'lat')::float8 is distinct from old.lat or (s ->> 'lng')::float8 is distinct from old.lng;
  if moved and private.area_at((s ->> 'lat')::float8, (s ->> 'lng')::float8) is null then raise exception 'outside_area'; end if;
  update public.shelters set name = s ->> 'name', address = s ->> 'address', contact = s ->> 'contact',
    lat = (s ->> 'lat')::float8, lng = (s ->> 'lng')::float8,
    verification_status = case when moved or s ->> 'verificationStatus' = 'unverified' then 'unverified' else verification_status end,
    total_capacity = (s ->> 'totalCapacity')::int, current_occupancy = (s ->> 'currentOccupancy')::int,
    has_ramp = (x ->> 'hasRamp')::boolean, ramp_slope_compliant = (x ->> 'rampSlopeCompliant')::boolean,
    door_width_accessible = (x ->> 'doorWidthAccessible')::boolean, has_accessible_toilet = (x ->> 'hasAccessibleToilet')::boolean,
    accessible_toilet_count = (x ->> 'accessibleToiletCount')::int, has_medical_power = (x ->> 'hasMedicalPower')::boolean,
    backup_generator_capacity_watt = (x ->> 'backupGeneratorCapacityWatt')::int, has_caregiver_rooms = (x ->> 'hasCaregiverRooms')::boolean,
    supported_languages = array(select jsonb_array_elements_text(x -> 'supportedLanguages'))
  where id = s ->> 'id';
  return '[]';
end $$;
