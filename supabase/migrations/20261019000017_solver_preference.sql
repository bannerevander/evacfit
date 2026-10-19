-- F3 / MTCH-1: OR-Tools CP-SAT chooses the placements; Postgres still applies and re-validates them.
-- Flow: matching_problem() -> solver service -> run_matching(p_prefer). Without a solver answer, p_prefer is null and
-- the greedy matcher runs exactly as before (fallback).

/** The problem the solver sees: families in the zone, usable shelters with free seats/watts, and every pair that already
    satisfies the hard constraints (needs, open, verified, outside the zone, not rejected before) with the greedy's cost. */
create function public.matching_problem() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.disaster_events;
begin
  perform private.require_role(array['coordinator']);
  select * into ev from public.disaster_events where status = 'active' and operation_area_id = private.my_area();
  if not found then raise exception 'no_event'; end if;
  return (
    with fam as (
      select u.id, u.member_count, u.geog, n.*, private.vulnerability(n) as score,
             n.no_stairs_required or n.accessible_toilet_needed or n.caregiver_space_needed or n.medical_power_required as special
      from public.family_units u join public.functional_needs n on n.family_id = u.id
      where u.operation_area_id = ev.operation_area_id and u.status in ('idle', 'waiting_match')
        and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false)
    ), sh as (
      select s.*, l.remaining, l.power_remaining,
             (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms as accessible
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
        and not exists (select 1 from public.evacuation_assignments x
                        where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
    )
    select jsonb_build_object(
      'event', ev.id,
      -- same priority as the greedy: more vulnerable families first (weight = 1 + vulnerability score)
      'families', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'people', member_count,
                    'watt', case when medical_power_required then min_power_wattage else 0 end, 'weight', 1 + score) order by id) from fam), '[]'),
      'shelters', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'capacity', remaining, 'power', power_remaining) order by id) from sh), '[]'),
      'pairs', coalesce((select jsonb_agg(jsonb_build_object('f', f, 's', s, 'cost', cost) order by f, s) from pair), '[]'))
  );
end $$;

-- The matcher takes the solver's choice as a preference: preferred families go first and take their chosen shelter while
-- it still passes every check (a joint CP-SAT solution always fits); the rest are matched greedily and explained if unmet.
drop function private.match(text[], jsonb);
create function private.match(p_ids text[], p_from jsonb default '{}', p_prefer jsonb default '{}') returns int
language plpgsql security definer set search_path = '' as $$
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
  where resolution_status <> 'resolved' and shelter_id is null and family_id = any (p_ids);

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
      case when f.caregiver_space_needed then 'caregiverSpaceNeeded' end,
      case when f.no_stairs_required then 'noStairsRequired' end,
      case when f.accessible_toilet_needed then 'accessibleToiletNeeded' end], null);

    select s.id, s.supported_languages, d.km, l.power_remaining,
           (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms as accessible
    into best
    from public.shelters s
    cross join lateral (select extensions.st_distance(f.geog, s.geog, false) / 1000 as km) d
    cross join lateral private.shelter_load(s.id) l
    where s.operation_area_id = any (scope)
      and s.operational_status = 'open' and s.verification_status = 'verified'
      and extensions.st_distance(s.geog, ev.geog, false) / 1000 > ev.radius_km
      and not exists (select 1 from public.evacuation_assignments x
                      where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
      and l.remaining >= f.member_count
      and (not f.no_stairs_required or (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible))
      and (not f.accessible_toilet_needed or s.has_accessible_toilet)
      and (not f.caregiver_space_needed or s.has_caregiver_rooms)
      and (not f.medical_power_required or (s.has_medical_power and l.power_remaining >= f.min_power_wattage))
    order by s.id = (p_prefer ->> f.id) desc nulls last,
      d.km
      + case when cardinality(needs) = 0 and ((s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms) then 5 else 0 end
      + case when f.preferred_language = any (s.supported_languages) then 0 else 2 end,
      s.id
    limit 1;

    if found then
      insert into public.evacuation_assignments (family_id, shelter_id, status, reason, distance_km, created_at, soft_lock_expires_at, reallocated_from_id)
      values (f.id, best.id, 'recommended', jsonb_strip_nulls(jsonb_build_object(
          'needs', to_jsonb(needs),
          'powerAvailable', case when f.medical_power_required then best.power_remaining end,
          'language', case when f.preferred_language <> 'Indonesia' and f.preferred_language = any (best.supported_languages) then f.preferred_language end,
          'general', case when cardinality(needs) = 0 then case when best.accessible then 'no_better' else 'keep_accessible' end end,
          'engine', case when p_prefer ->> f.id = best.id then 'cp-sat' end,
          'people', f.member_count,
          'km', best.km)),
        best.km, t, t + interval '15 minutes', (p_from ->> f.id)::uuid);
      update public.family_units set status = 'recommended' where id = f.id;
      placed := placed + 1;
    else
      kind := 'full';
      foreach c in array needs loop
        if not exists (
          select 1 from public.shelters s
          where s.operation_area_id = any (scope)
            and s.operational_status = 'open' and s.verification_status = 'verified'
            and extensions.st_distance(s.geog, ev.geog, false) / 1000 > ev.radius_km
            and case c
              when 'medicalPowerRequired' then s.has_medical_power and s.backup_generator_capacity_watt >= f.min_power_wattage
              when 'caregiverSpaceNeeded' then s.has_caregiver_rooms
              when 'noStairsRequired' then s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible
              else s.has_accessible_toilet end
        ) then
          kind := 'none_has';
          exit;
        end if;
      end loop;
      if kind = 'none_has' then needs := array[c]; end if;
      insert into public.unmet_needs (family_id, missing_facility_type, detail, severity, reported_at)
      values (f.id,
        case needs[1] when 'medicalPowerRequired' then 'medical_power' when 'caregiverSpaceNeeded' then 'caregiver_room'
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

drop function public.run_matching();
create function public.run_matching(p_prefer jsonb default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.disaster_events;
  ids text[];
  made int;
begin
  perform private.require_role(array['coordinator']);
  select * into ev from public.disaster_events where status = 'active' and operation_area_id = private.my_area();
  if not found then raise exception 'no_event'; end if;
  select coalesce(array_agg(id), '{}') into ids from public.family_units u
  where u.operation_area_id = ev.operation_area_id and u.status in ('idle', 'waiting_match')
    and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false);
  made := private.match(ids, '{}', p_prefer);
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg', jsonb_build_object('k', 'matched', 'made', made,
    'backlog', cardinality(ids) - made, 'engine', case when p_prefer is null then 'greedy' else 'cp-sat' end)));
end $$;

revoke execute on function public.matching_problem(), public.run_matching(jsonb) from public, anon;
grant execute on function public.matching_problem(), public.run_matching(jsonb) to authenticated;
