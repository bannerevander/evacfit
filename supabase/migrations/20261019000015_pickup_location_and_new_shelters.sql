-- RISET §3.2: during an emergency residents are often not at home. They can report where they are now; that point
-- becomes the pickup point without overwriting the registered home address.
alter table public.family_units
  add column current_lat double precision check (current_lat between -90 and 90),
  add column current_lng double precision check (current_lng between -180 and 180),
  add column current_at timestamptz,
  add constraint family_units_current_pair check ((current_lat is null) = (current_lng is null));

-- geog is now the PICKUP point (current location if reported, else home). Matching, zone checks and distances already
-- read geog, so they follow automatically. The service area stays home-based: set_area() reads lat/lng.
alter table public.family_units alter column geog set expression as (
  extensions.st_setsrid(extensions.st_makepoint(coalesce(current_lng, lng), coalesce(current_lat, lat)), 4326)::extensions.geography);

/** Resident (or coordinator) reports "I am here now"; null coordinates = "I am at home". */
create function public.report_location(p_family text, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.family_units f where f.id = p_family
                 and (f.owner_id = auth.uid() or (private.my_role() = 'coordinator' and f.operation_area_id = private.my_area()))) then
    raise exception 'forbidden';
  end if;
  update public.family_units
  set current_lat = p_lat, current_lng = p_lng, current_at = case when p_lat is null then null else now() end
  where id = p_family;
  return '[]';
end $$;

/** A reported location only matters for the emergency it was sent in. */
create or replace function public.close_event(p_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(array['coordinator']);
  update public.disaster_events set status = 'closed' where id = p_id and operation_area_id = private.my_area();
  if not found then raise exception 'not_found'; end if;
  update public.family_units set current_lat = null, current_lng = null, current_at = null
  where operation_area_id = private.my_area() and current_at is not null;
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg', jsonb_build_object('k', 'closed')));
end $$;

/** SHLT-1: a coordinator registers a shelter in their own area. It starts unverified until inspected (SHLT-5). */
create function public.create_shelter(s jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  x jsonb := s -> 'features';
begin
  perform private.require_role(array['coordinator']);
  if private.area_at((s ->> 'lat')::float8, (s ->> 'lng')::float8) is distinct from private.my_area() then raise exception 'outside_area'; end if;
  insert into public.shelters (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
    has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
    backup_generator_capacity_watt, has_caregiver_rooms, supported_languages)
  values (s ->> 'id', s ->> 'name', coalesce(s ->> 'address', ''), coalesce(s ->> 'contact', ''), (s ->> 'lat')::float8, (s ->> 'lng')::float8,
    (s ->> 'totalCapacity')::int, coalesce((s ->> 'currentOccupancy')::int, 0), 'open', 'unverified',
    coalesce((x ->> 'hasRamp')::boolean, false), coalesce((x ->> 'rampSlopeCompliant')::boolean, false),
    coalesce((x ->> 'doorWidthAccessible')::boolean, false), coalesce((x ->> 'hasAccessibleToilet')::boolean, false),
    coalesce((x ->> 'accessibleToiletCount')::int, 0), coalesce((x ->> 'hasMedicalPower')::boolean, false),
    coalesce((x ->> 'backupGeneratorCapacityWatt')::int, 0), coalesce((x ->> 'hasCaregiverRooms')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(x -> 'supportedLanguages')), '{Indonesia}'));
  return '[]';
end $$;

revoke execute on function public.report_location(text, double precision, double precision), public.create_shelter(jsonb) from public, anon;
grant execute on function public.report_location(text, double precision, double precision), public.create_shelter(jsonb) to authenticated;
