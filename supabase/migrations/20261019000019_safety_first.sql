-- Safety first, needs second. A family in the hazard zone is never left waiting for a "perfect" shelter:
--   1. a verified shelter that meets every need and has seats (as before, nearest / solver-chosen);
--   2. otherwise the NEAREST safe shelter with seats, placed now with its gaps recorded so the shelter can prepare
--      and, once the family has arrived, refer them on (refer_family) when a fitting shelter has room;
--   3. backlog only when no safe shelter has seats at all.
-- p_strict (used by referrals) keeps rule 1 only: a family already safe is moved only to a place that fits.

-- Arrived families can be moved on by a referral.
create or replace function private.move(p_id uuid, p_to text) returns public.evacuation_assignments language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not p_to = any (case a.status
      when 'recommended' then array['confirmed', 'rejected', 'reallocated']
      when 'confirmed' then array['in_transit', 'rejected', 'reallocated']
      when 'in_transit' then array['arrived', 'reallocated']
      when 'arrived' then array['reallocated']
      else array[]::text[] end) then
    raise exception 'bad_transition';
  end if;
  update public.evacuation_assignments set status = p_to where id = p_id returning * into a;
  return a;
end $$;

drop function private.match(text[], jsonb, jsonb);
create function private.match(p_ids text[], p_from jsonb default '{}', p_prefer jsonb default '{}', p_strict boolean default false) returns int
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

    -- Every safe shelter with seats, with the needs it cannot meet; rule 1 = no gaps, rule 2 = nearest.
    select s.id, s.supported_languages, d.km, l.power_remaining, g.gaps,
           (s.has_ramp and s.has_accessible_toilet) or s.has_medical_power or s.has_caregiver_rooms as accessible
    into best
    from public.shelters s
    cross join lateral (select extensions.st_distance(f.geog, s.geog, false) / 1000 as km) d
    cross join lateral private.shelter_load(s.id) l
    cross join lateral (select array_remove(array[
        case when f.medical_power_required and not (s.has_medical_power and l.power_remaining >= f.min_power_wattage) then 'medicalPowerRequired' end,
        case when f.caregiver_space_needed and not s.has_caregiver_rooms then 'caregiverSpaceNeeded' end,
        case when f.no_stairs_required and not (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible) then 'noStairsRequired' end,
        case when f.accessible_toilet_needed and not s.has_accessible_toilet then 'accessibleToiletNeeded' end], null) as gaps) g
    where s.operation_area_id = any (scope)
      and s.operational_status = 'open' and s.verification_status = 'verified'
      and extensions.st_distance(s.geog, ev.geog, false) / 1000 > ev.radius_km
      and not exists (select 1 from public.evacuation_assignments x
                      where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
      and l.remaining >= f.member_count
      and (not p_strict or cardinality(g.gaps) = 0)
    order by cardinality(g.gaps) = 0 desc,
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

/** After arrival: move the family to a shelter that meets every need, if one has room; otherwise they stay (safe). */
create function public.refer_family(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.evacuation_assignments;
  fam text;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  if a.status <> 'arrived' then raise exception 'bad_transition'; end if;
  begin
    perform private.move(p_id, 'reallocated');
    update public.family_units set status = 'waiting_match' where id = a.family_id;
    -- shortcut: the old shelter's seat is released now, while the family physically waits there for transport.
    if private.match(array[a.family_id], jsonb_build_object(a.family_id, p_id), '{}', true) = 0 then
      raise exception 'no_referral';
    end if;
  exception when raise_exception then
    if sqlerrm <> 'no_referral' then raise; end if;
    select family_name into fam from public.family_units where id = a.family_id;
    return jsonb_build_array(jsonb_build_object('tone', 'warning', 'msg', jsonb_build_object('k', 'no_referral', 'family', fam)));
  end;
  update public.unmet_needs set resolution_status = 'resolved'
  where family_id = a.family_id and shelter_id = a.shelter_id and resolution_status <> 'resolved';
  return private.realloc_alerts(array[a.family_id]);
end $$;
revoke execute on function public.refer_family(uuid) from public, anon;
grant execute on function public.refer_family(uuid) to authenticated;

-- Same-timestamp tie (two placements in one transaction) must not hide the live one.
create or replace function private.realloc_alerts(fids text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(case when a.status = 'recommended'
      then jsonb_build_object('tone', 'warning', 'msg', jsonb_build_object('k', 'reallocated', 'family', u.family_name, 'shelter', s.name))
      else jsonb_build_object('tone', 'critical', 'msg', jsonb_build_object('k', 'no_alternative', 'family', u.family_name)) end), '[]')
  from unnest(fids) fid
  join public.family_units u on u.id = fid
  left join lateral (select * from public.evacuation_assignments x where x.family_id = fid
                     order by x.created_at desc, x.status = 'recommended' desc limit 1) a on true
  left join public.shelters s on s.id = a.shelter_id
$$;
