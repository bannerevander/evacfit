-- Last resort for city-wide hazards: when no shelter outside the zone has seats, use the nearest open and verified
-- shelter INSIDE the zone (its manager reports it operational; unsafe ones are set to closed_emergency) and flag it.
-- Shelters outside the zone always come first. The OR-Tools problem still contains outside-zone shelters only.
create or replace function private.match(p_ids text[], p_from jsonb default '{}', p_prefer jsonb default '{}', p_strict boolean default false) returns int
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

  -- Re-matching replaces earlier matcher records (backlog and temporary-placement gaps); check-in reports stay.
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
      case when f.caregiver_space_needed then 'caregiverSpaceNeeded' end,
      case when f.no_stairs_required then 'noStairsRequired' end,
      case when f.accessible_toilet_needed then 'accessibleToiletNeeded' end], null);

    -- Every open, verified shelter with seats and the needs it cannot meet; rule 1 = no gaps, rule 2 = nearest.
    select s.id, s.supported_languages, d.km, l.power_remaining, g.gaps, z.in_zone,
           (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms as accessible
    into best
    from public.shelters s
    cross join lateral (select extensions.st_distance(f.geog, s.geog, false) / 1000 as km) d
    cross join lateral private.shelter_load(s.id) l
    cross join lateral (select extensions.st_distance(s.geog, ev.geog, false) / 1000 <= ev.radius_km as in_zone) z
    cross join lateral (select array_remove(array[
        case when f.medical_power_required and not (s.has_medical_power and l.power_remaining >= f.min_power_wattage) then 'medicalPowerRequired' end,
        case when f.caregiver_space_needed and not s.has_caregiver_rooms then 'caregiverSpaceNeeded' end,
        case when f.no_stairs_required and not (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible) then 'noStairsRequired' end,
        case when f.accessible_toilet_needed and not s.has_accessible_toilet then 'accessibleToiletNeeded' end], null) as gaps) g
    where s.operation_area_id = any (scope)
      and s.operational_status = 'open' and s.verification_status = 'verified'
      and not exists (select 1 from public.evacuation_assignments x
                      where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
      and l.remaining >= f.member_count
      and (not p_strict or cardinality(g.gaps) = 0)
    -- Outside the hazard zone first; an open, verified shelter inside it is the last resort (e.g. a city-wide quake).
    order by z.in_zone,
      cardinality(g.gaps) = 0 desc,
      -- among full fits: solver choice, then the greedy cost; among partial fits: nearest, then fewest gaps
      case when cardinality(g.gaps) = 0 then (s.id = (p_prefer ->> f.id)) end desc nulls last,
      case when cardinality(g.gaps) = 0 then
        d.km
        + case when cardinality(needs) = 0 and ((s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms) then 5 else 0 end
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
        -- Shown to the shelter (prepare) and in the coordinator's backlog (follow up / refer).
        insert into public.unmet_needs (family_id, shelter_id, missing_facility_type, detail, severity, reported_at)
        values (f.id, best.id,
          case best.gaps[1] when 'medicalPowerRequired' then 'medical_power' when 'caregiverSpaceNeeded' then 'caregiver_room'
            when 'noStairsRequired' then 'no_stairs' else 'accessible_toilet' end,
          jsonb_build_object('kind', 'gaps', 'needs', to_jsonb(best.gaps), 'people', f.member_count,
            'watt', case when 'medicalPowerRequired' = any (best.gaps) then f.min_power_wattage else 0 end),
          case when f.score >= 6 then 'critical' when f.score >= 3 then 'high' when f.score > 0 then 'medium' else 'low' end,
          t);
      end if;
      update public.family_units set status = 'recommended' where id = f.id;
      placed := placed + 1;
    elsif p_strict then
      null; -- referral found nothing better: the caller keeps the family where it is
    else
      -- No safe shelter has seats; report which need nobody has at all, else plain capacity.
      kind := 'full';
      foreach c in array needs loop
        if not exists (
          select 1 from public.shelters s
          where s.operation_area_id = any (scope)
            and s.operational_status = 'open' and s.verification_status = 'verified'
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
      if kind = 'none_has' then needs := array[c]; else needs := '{}'; end if;
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

