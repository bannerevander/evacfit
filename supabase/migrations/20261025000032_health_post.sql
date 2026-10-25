-- Chronic care: a family that needs routine medication or health checks (the illness itself is never asked) is matched only
-- to a shelter with a health post (health worker on site, basic medicines). Mirrors web/src/lib/matching.ts; check order:
-- medical power, chronic care, caregiver, step-free, accessible toilet. Function bodies start from the production
-- definitions as of 2026-10-25 (pg_get_functiondef), not from older migration files.

alter table public.functional_needs add column chronic_care_needed boolean not null default false;
alter table public.shelters add column has_health_post boolean not null default false;

alter table public.unmet_needs drop constraint unmet_needs_missing_facility_type_check;
alter table public.unmet_needs add constraint unmet_needs_missing_facility_type_check check (missing_facility_type in
  ('medical_power', 'caregiver_room', 'no_stairs', 'accessible_toilet', 'health_service', 'general_capacity'));

create or replace function private.vulnerability(n public.functional_needs) returns integer language sql immutable set search_path to '' as $$
  select (case when n.medical_power_required then 3 else 0 end) + (case when n.chronic_care_needed then 2 else 0 end)
       + (case when n.no_stairs_required then 2 else 0 end)
       + (case when n.wheelchair_vehicle_needed then 2 else 0 end) + (case when n.accessible_toilet_needed then 1 else 0 end)
       + (case when n.caregiver_space_needed then 1 else 0 end) + (case when n.pregnant_count > 0 then 1 else 0 end)
       + (case when n.infant_count > 0 then 1 else 0 end)
$$;

-- Older clients (offline outbox) send no chronicCareNeeded / hasHealthPost: treated as false.
create or replace function public.save_family(f jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  n jsonb := f -> 'needs';
  existing public.family_units;
begin
  perform private.require_role(array['citizen', 'volunteer', 'coordinator']);
  select * into existing from public.family_units where id = f ->> 'id' for update;
  if found and private.my_role() <> 'coordinator' and existing.owner_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  insert into public.family_units (id, code, family_name, member_count, contact_phone, address_notes, lat, lng, registered_via, owner_id)
  values (f ->> 'id', f ->> 'code', f ->> 'familyName', (f ->> 'memberCount')::int, coalesce(f ->> 'contactPhone', ''),
          coalesce(f ->> 'addressNotes', ''), (f ->> 'lat')::float8, (f ->> 'lng')::float8, coalesce(f ->> 'registeredVia', 'self'), auth.uid())
  on conflict (id) do update set family_name = excluded.family_name, member_count = excluded.member_count,
    contact_phone = excluded.contact_phone, address_notes = excluded.address_notes, lat = excluded.lat, lng = excluded.lng;
  insert into public.functional_needs (family_id, no_stairs_required, accessible_toilet_needed, caregiver_space_needed, medical_power_required,
    min_power_wattage, chronic_care_needed, wheelchair_vehicle_needed, preferred_language, infant_count, pregnant_count, notes)
  values (f ->> 'id', (n ->> 'noStairsRequired')::boolean, (n ->> 'accessibleToiletNeeded')::boolean, (n ->> 'caregiverSpaceNeeded')::boolean,
    (n ->> 'medicalPowerRequired')::boolean, coalesce((n ->> 'minPowerWattage')::int, 0), coalesce((n ->> 'chronicCareNeeded')::boolean, false),
    (n ->> 'wheelchairVehicleNeeded')::boolean,
    coalesce(n ->> 'preferredLanguage', 'Indonesia'), coalesce((n ->> 'infantCount')::int, 0), coalesce((n ->> 'pregnantCount')::int, 0),
    coalesce(n ->> 'notes', ''))
  on conflict (family_id) do update set no_stairs_required = excluded.no_stairs_required, accessible_toilet_needed = excluded.accessible_toilet_needed,
    caregiver_space_needed = excluded.caregiver_space_needed, medical_power_required = excluded.medical_power_required,
    min_power_wattage = excluded.min_power_wattage, chronic_care_needed = excluded.chronic_care_needed,
    wheelchair_vehicle_needed = excluded.wheelchair_vehicle_needed,
    preferred_language = excluded.preferred_language, infant_count = excluded.infant_count, pregnant_count = excluded.pregnant_count,
    notes = excluded.notes;
  return '[]';
end $$;

create or replace function public.save_shelter(s jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
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
    has_health_post = coalesce((x ->> 'hasHealthPost')::boolean, old.has_health_post),
    supported_languages = array(select jsonb_array_elements_text(x -> 'supportedLanguages'))
  where id = s ->> 'id';
  return '[]';
end $$;

create or replace function public.create_shelter(s jsonb) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  x jsonb := s -> 'features';
begin
  perform private.require_role(array['coordinator']);
  if private.area_at((s ->> 'lat')::float8, (s ->> 'lng')::float8) is distinct from private.my_area() then raise exception 'outside_area'; end if;
  insert into public.shelters (id, name, address, contact, lat, lng, total_capacity, current_occupancy, operational_status, verification_status,
    has_ramp, ramp_slope_compliant, door_width_accessible, has_accessible_toilet, accessible_toilet_count, has_medical_power,
    backup_generator_capacity_watt, has_caregiver_rooms, has_health_post, supported_languages)
  values (s ->> 'id', s ->> 'name', coalesce(s ->> 'address', ''), coalesce(s ->> 'contact', ''), (s ->> 'lat')::float8, (s ->> 'lng')::float8,
    (s ->> 'totalCapacity')::int, coalesce((s ->> 'currentOccupancy')::int, 0), 'open', 'unverified',
    coalesce((x ->> 'hasRamp')::boolean, false), coalesce((x ->> 'rampSlopeCompliant')::boolean, false),
    coalesce((x ->> 'doorWidthAccessible')::boolean, false), coalesce((x ->> 'hasAccessibleToilet')::boolean, false),
    coalesce((x ->> 'accessibleToiletCount')::int, 0), coalesce((x ->> 'hasMedicalPower')::boolean, false),
    coalesce((x ->> 'backupGeneratorCapacityWatt')::int, 0), coalesce((x ->> 'hasCaregiverRooms')::boolean, false),
    coalesce((x ->> 'hasHealthPost')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(x -> 'supportedLanguages')), '{Indonesia}'));
  return '[]';
end $$;

create or replace function private.match(p_ids text[], p_from jsonb default '{}'::jsonb, p_prefer jsonb default '{}'::jsonb, p_strict boolean default false)
returns integer language plpgsql security definer set search_path to '' as $$
declare
  ev public.disaster_events;
  f record;
  best record;
  needs text[];
  scope text[];
  c text;
  kind text;
  placed int := 0;
  t timestamptz := now();
begin
  if coalesce(cardinality(p_ids), 0) = 0 then return 0; end if;
  p_prefer := coalesce(p_prefer, '{}');
  perform 1 from public.shelters order by id for update;

  update public.unmet_needs set resolution_status = 'resolved'
  where resolution_status <> 'resolved' and family_id = any (p_ids) and (shelter_id is null or detail ->> 'kind' = 'gaps');

  for f in
    select u.id, u.member_count, u.geog, u.operation_area_id as area, n.*, private.vulnerability(n) as score
    from public.family_units u join public.functional_needs n on n.family_id = u.id
    where u.id = any (p_ids) and u.status in ('idle', 'waiting_match')
    order by (p_prefer ? u.id) desc, score desc, u.id
  loop
    select * into ev from public.disaster_events where status = 'active' and operation_area_id = f.area;
    if not found then continue; end if;
    scope := private.area_scope(f.area);

    needs := array_remove(array[
      case when f.medical_power_required then 'medicalPowerRequired' end,
      case when f.chronic_care_needed then 'chronicCareNeeded' end,
      case when f.caregiver_space_needed then 'caregiverSpaceNeeded' end,
      case when f.no_stairs_required then 'noStairsRequired' end,
      case when f.accessible_toilet_needed then 'accessibleToiletNeeded' end], null);

    select s.id, s.supported_languages, d.km, l.power_remaining, g.gaps, z.in_zone,
           (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms or s.has_health_post as accessible
    into best
    from public.shelters s
    cross join lateral (select extensions.st_distance(f.geog, s.geog, false) / 1000 as km) d
    cross join lateral private.shelter_load(s.id) l
    cross join lateral (select extensions.st_distance(s.geog, ev.geog, false) / 1000 <= ev.radius_km as in_zone) z
    cross join lateral (select array_remove(array[
        case when f.medical_power_required and not (s.has_medical_power and l.power_remaining >= f.min_power_wattage) then 'medicalPowerRequired' end,
        case when f.chronic_care_needed and not s.has_health_post then 'chronicCareNeeded' end,
        case when f.caregiver_space_needed and not s.has_caregiver_rooms then 'caregiverSpaceNeeded' end,
        case when f.no_stairs_required and not (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible) then 'noStairsRequired' end,
        case when f.accessible_toilet_needed and not s.has_accessible_toilet then 'accessibleToiletNeeded' end], null) as gaps) g
    where s.operation_area_id = any (scope)
      and s.operational_status = 'open' and s.verification_status = 'verified'
      and not exists (select 1 from public.evacuation_assignments x
                      where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
      and l.remaining >= f.member_count
      and (not p_strict or cardinality(g.gaps) = 0)
    order by z.in_zone,
      cardinality(g.gaps) = 0 desc,
      case when cardinality(g.gaps) = 0 then (s.id = (p_prefer ->> f.id)) end desc nulls last,
      case when cardinality(g.gaps) = 0 then
        d.km
        + case when cardinality(needs) = 0 and ((s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms or s.has_health_post) then 5 else 0 end
        + case when f.preferred_language = any (s.supported_languages) then 0 else 2 end
      else d.km end,
      cardinality(g.gaps),
      s.id
    limit 1;

    if found then
      insert into public.evacuation_assignments (family_id, shelter_id, status, reason, distance_km, created_at, soft_lock_expires_at, reallocated_from_id)
      values (f.id, best.id, 'recommended', jsonb_strip_nulls(jsonb_build_object(
          'needs', to_jsonb(array(select x from unnest(needs) x where x <> all (best.gaps))),
          'gaps', case when cardinality(best.gaps) > 0 then to_jsonb(best.gaps) end,
          'powerAvailable', case when f.medical_power_required and not ('medicalPowerRequired' = any (best.gaps)) then best.power_remaining end,
          'language', case when f.preferred_language <> 'Indonesia' and f.preferred_language = any (best.supported_languages) then f.preferred_language end,
          'general', case when cardinality(needs) = 0 then case when best.accessible then 'no_better' else 'keep_accessible' end end,
          'engine', case when p_prefer ->> f.id = best.id then 'cp-sat' end,
          'inZone', case when best.in_zone then true end,
          'people', f.member_count,
          'km', best.km)),
        best.km, t, t + interval '15 minutes', (p_from ->> f.id)::uuid);
      if cardinality(best.gaps) > 0 then
        insert into public.unmet_needs (family_id, shelter_id, missing_facility_type, detail, severity, reported_at)
        values (f.id, best.id,
          case best.gaps[1] when 'medicalPowerRequired' then 'medical_power' when 'chronicCareNeeded' then 'health_service'
            when 'caregiverSpaceNeeded' then 'caregiver_room' when 'noStairsRequired' then 'no_stairs' else 'accessible_toilet' end,
          jsonb_build_object('kind', 'gaps', 'needs', to_jsonb(best.gaps), 'people', f.member_count,
            'watt', case when 'medicalPowerRequired' = any (best.gaps) then f.min_power_wattage else 0 end),
          case when f.score >= 6 then 'critical' when f.score >= 3 then 'high' when f.score > 0 then 'medium' else 'low' end,
          t);
      end if;
      update public.family_units set status = 'recommended' where id = f.id;
      placed := placed + 1;
    elsif p_strict then
      null;
    else
      kind := 'full';
      foreach c in array needs loop
        if not exists (
          select 1 from public.shelters s
          where s.operation_area_id = any (scope)
            and s.operational_status = 'open' and s.verification_status = 'verified'
            and case c
              when 'medicalPowerRequired' then s.has_medical_power and s.backup_generator_capacity_watt >= f.min_power_wattage
              when 'chronicCareNeeded' then s.has_health_post
              when 'caregiverSpaceNeeded' then s.has_caregiver_rooms
              when 'noStairsRequired' then s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible
              else s.has_accessible_toilet end
        ) then
          kind := 'none_has';
          exit;
        end if;
      end loop;
      if kind = 'none_has' then needs := array[c]; else needs := '{}'; end if;
      insert into public.unmet_needs (family_id, missing_facility_type, detail, severity, reported_at)
      values (f.id,
        case needs[1] when 'medicalPowerRequired' then 'medical_power' when 'chronicCareNeeded' then 'health_service'
          when 'caregiverSpaceNeeded' then 'caregiver_room'
          when 'noStairsRequired' then 'no_stairs' when 'accessibleToiletNeeded' then 'accessible_toilet' else 'general_capacity' end,
        jsonb_build_object('kind', kind, 'needs', to_jsonb(needs), 'people', f.member_count,
          'watt', case when f.medical_power_required then f.min_power_wattage else 0 end),
        case when f.score >= 6 then 'critical' when f.score >= 3 then 'high' when f.score > 0 then 'medium' else 'low' end,
        t);
      update public.family_units set status = 'waiting_match' where id = f.id;
    end if;
  end loop;
  return placed;
end $$;

create or replace function public.matching_problem() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  ev public.disaster_events;
begin
  perform private.require_role(array['coordinator']);
  select * into ev from public.disaster_events where status = 'active' and operation_area_id = private.my_area();
  if not found then raise exception 'no_event'; end if;
  return (
    with fam as (
      select u.id, u.member_count, u.geog, n.*, private.vulnerability(n) as score,
             n.no_stairs_required or n.accessible_toilet_needed or n.caregiver_space_needed or n.medical_power_required
               or n.chronic_care_needed as special
      from public.family_units u join public.functional_needs n on n.family_id = u.id
      where u.operation_area_id = ev.operation_area_id and u.status in ('idle', 'waiting_match')
        and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false)
    ), sh as (
      select s.*, l.remaining, l.power_remaining,
             (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms or s.has_health_post as accessible
      from public.shelters s cross join lateral private.shelter_load(s.id) l
      where s.operation_area_id = any (private.area_scope(ev.operation_area_id))
        and s.operational_status = 'open' and s.verification_status = 'verified'
        and extensions.st_distance(s.geog, ev.geog, false) / 1000 > ev.radius_km
    ), pair as (
      select f.id as f, s.id as s,
        round(10 * (extensions.st_distance(f.geog, s.geog, false) / 1000
          + case when not f.special and s.accessible then 5 else 0 end
          + case when f.preferred_language = any (s.supported_languages) then 0 else 2 end))::int as cost
      from fam f join sh s on s.remaining >= f.member_count
      where (not f.no_stairs_required or (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible))
        and (not f.accessible_toilet_needed or s.has_accessible_toilet)
        and (not f.caregiver_space_needed or s.has_caregiver_rooms)
        and (not f.medical_power_required or (s.has_medical_power and s.power_remaining >= f.min_power_wattage))
        and (not f.chronic_care_needed or s.has_health_post)
        and not exists (select 1 from public.evacuation_assignments x
                        where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
    )
    select jsonb_build_object(
      'event', ev.id,
      'families', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'people', member_count,
                    'watt', case when medical_power_required then min_power_wattage else 0 end, 'weight', 1 + score) order by id) from fam), '[]'),
      'shelters', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'capacity', remaining, 'power', power_remaining) order by id) from sh), '[]'),
      'pairs', coalesce((select jsonb_agg(jsonb_build_object('f', f, 's', s, 'cost', cost) order by f, s) from pair), '[]'))
  );
end $$;

-- Demo data (same flags as web/src/data/mock.ts). A full reseed runs v2, Aceh, then these flags.
create or replace function private.seed_health() returns void language sql security definer set search_path to '' as $$
  update public.shelters set has_health_post = id in ('sh-01', 'sh-05', 'sh-08', 'sh-11', 'sh-12', 'sh-15', 'sh-19', 'sh-21',
    'sh-24', 'sh-25', 'sh-26', 'sh-29', 'sh-30', 'sh-32', 'sh-34', 'sh-35')
  where id ~ '^sh-[0-9]+$';
  update public.functional_needs set chronic_care_needed = family_id in ('fam-03', 'fam-07', 'fam-14', 'fam-26', 'fam-31', 'fam-35', 'fam-38', 'fam-42')
  where family_id ~ '^fam-[0-9]+$';
$$;

create or replace function private.seed_demo() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform private.seed_demo_v2();
  perform private.seed_aceh();
  perform private.seed_health();
end $fn$;

select private.seed_health();

revoke execute on function private.seed_health() from public, anon, authenticated;
