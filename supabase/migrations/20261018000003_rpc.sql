-- Domain logic lives here, not in the browser (plan §3 principle 3). Each public function = one store Action.
-- Public RPCs return a jsonb array of alerts shaped like the client's { tone, msg: AlertMsg }.
-- Errors are raised with the client's error codes (no_event, not_found, bad_transition, not_confirmed, vehicle_mismatch, forbidden).

-- ---------- helpers (private schema: not exposed through the API) ----------

create function private.require_role(roles text[]) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(private.my_role(), '') <> all (roles) then raise exception 'forbidden'; end if;
end $$;

/** Coordinator, or the manager of this shelter. */
create function private.require_shelter(sid text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if private.my_role() is distinct from 'coordinator' and private.my_shelter() is distinct from sid then raise exception 'forbidden'; end if;
end $$;

create function private.vulnerability(n public.functional_needs) returns int language sql immutable as $$
  select (case when n.medical_power_required then 3 else 0 end) + (case when n.no_stairs_required then 2 else 0 end)
       + (case when n.wheelchair_vehicle_needed then 2 else 0 end) + (case when n.accessible_toilet_needed then 1 else 0 end)
       + (case when n.caregiver_space_needed then 1 else 0 end) + (case when n.pregnant_count > 0 then 1 else 0 end)
       + (case when n.infant_count > 0 then 1 else 0 end)
$$;

/** Seats and generator watts still free: arrivals and active reservations both count (mirrors lib/matching.ts shelterLoad). */
create function private.shelter_load(sid text, out remaining int, out power_remaining int) language sql stable set search_path = '' as $$
  select greatest(0, s.total_capacity - s.current_occupancy
           - coalesce(sum(u.member_count) filter (where a.status in ('recommended', 'confirmed', 'in_transit', 'arrived')), 0))::int,
         greatest(0, s.backup_generator_capacity_watt
           - coalesce(sum(n.min_power_wattage) filter (where n.medical_power_required and a.status in ('recommended', 'confirmed', 'in_transit', 'arrived')), 0))::int
  from public.shelters s
  left join public.evacuation_assignments a on a.shelter_id = s.id
  left join public.family_units u on u.id = a.family_id
  left join public.functional_needs n on n.family_id = a.family_id
  where s.id = sid
  group by s.id
$$;

/** CONF-1 / MTCH-6 state machine (web/src/state/machine.ts). Locks the row. */
create function private.move(p_id uuid, p_to text) returns public.evacuation_assignments language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not p_to = any (case a.status
      when 'recommended' then array['confirmed', 'rejected', 'reallocated']
      when 'confirmed' then array['in_transit', 'rejected', 'reallocated']
      when 'in_transit' then array['arrived', 'reallocated']
      else array[]::text[] end) then
    raise exception 'bad_transition';
  end if;
  update public.evacuation_assignments set status = p_to where id = p_id returning * into a;
  return a;
end $$;

/**
 * Greedy matcher, same hard constraints (MTCH-2) and preferences (MTCH-3/4) as web/src/lib/matching.ts.
 * shortcut: greedy in SQL until the OR-Tools service (F3) exists; it will write through this same table.
 * p_from maps family_id -> the assignment it replaces.
 */
create function private.match(p_ids text[], p_from jsonb default '{}') returns int language plpgsql security definer set search_path = '' as $$
declare
  ev public.disaster_events;
  f record;
  best record;
  needs text[];
  c text;
  kind text;
  placed int := 0;
  t timestamptz := now();
begin
  select * into ev from public.disaster_events where status = 'active';
  if not found or coalesce(cardinality(p_ids), 0) = 0 then return 0; end if;
  -- ARCH-4: concurrent runs queue behind these row locks, so a seat can never be booked twice.
  perform 1 from public.shelters order by id for update;

  update public.unmet_needs set resolution_status = 'resolved'
  where resolution_status <> 'resolved' and shelter_id is null and family_id = any (p_ids);

  for f in
    select u.id, u.member_count, u.geog, n.*, private.vulnerability(n) as score
    from public.family_units u join public.functional_needs n on n.family_id = u.id
    -- re-checked after the lock: a family placed by a parallel run is skipped
    where u.id = any (p_ids) and u.status in ('idle', 'waiting_match')
    order by score desc, u.id
  loop
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
    where s.operational_status = 'open' and s.verification_status = 'verified'
      and extensions.st_distance(s.geog, ev.geog, false) / 1000 > ev.radius_km
      and not exists (select 1 from public.evacuation_assignments x
                      where x.family_id = f.id and x.shelter_id = s.id and x.status in ('rejected', 'reallocated'))
      and l.remaining >= f.member_count
      and (not f.no_stairs_required or (s.has_ramp and s.ramp_slope_compliant and s.door_width_accessible))
      and (not f.accessible_toilet_needed or s.has_accessible_toilet)
      and (not f.caregiver_space_needed or s.has_caregiver_rooms)
      and (not f.medical_power_required or (s.has_medical_power and l.power_remaining >= f.min_power_wattage))
    order by d.km
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
          'people', f.member_count,
          'km', best.km)),
        best.km, t, t + interval '15 minutes', (p_from ->> f.id)::uuid);
      update public.family_units set status = 'recommended' where id = f.id;
      placed := placed + 1;
    else
      -- UNMT-2: report the first need no usable shelter has at all (power judged on the full generator), else "all full".
      kind := 'full';
      foreach c in array needs loop
        if not exists (
          select 1 from public.shelters s
          where s.operational_status = 'open' and s.verification_status = 'verified'
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

/** "Moved to X" or "no alternative" for each family, from its latest assignment. */
create function private.realloc_alerts(fids text[]) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(case when a.status = 'recommended'
      then jsonb_build_object('tone', 'warning', 'msg', jsonb_build_object('k', 'reallocated', 'family', u.family_name, 'shelter', s.name))
      else jsonb_build_object('tone', 'critical', 'msg', jsonb_build_object('k', 'no_alternative', 'family', u.family_name)) end), '[]')
  from unnest(fids) fid
  join public.family_units u on u.id = fid
  left join lateral (select * from public.evacuation_assignments x where x.family_id = fid order by x.created_at desc limit 1) a on true
  left join public.shelters s on s.id = a.shelter_id
$$;

/** SHLT-6, CONF-2, MTCH-7: release these assignments and re-match their families elsewhere. */
create function private.reallocate(ids uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i uuid;
  fids text[];
  m jsonb;
begin
  if coalesce(cardinality(ids), 0) = 0 then return '[]'; end if;
  foreach i in array ids loop perform private.move(i, 'reallocated'); end loop;
  select array_agg(family_id), jsonb_object_agg(family_id, id) into fids, m from public.evacuation_assignments where id = any (ids);
  update public.family_units set status = 'waiting_match' where id = any (fids);
  perform private.match(fids, m);
  return private.realloc_alerts(fids);
end $$;

/** CONF-2: run by pg_cron every minute. */
create function private.expire_soft_locks() returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.reallocate(array(
    select id from public.evacuation_assignments where status = 'recommended' and soft_lock_expires_at <= now()));
end $$;

-- ---------- public RPCs ----------

create function public.activate_event(e jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.disaster_events;
  n int;
begin
  perform private.require_role(array['coordinator']);
  update public.disaster_events set status = 'closed' where status = 'active' and id <> e ->> 'id';
  insert into public.disaster_events (id, source, type, title, magnitude, depth_km, lat, lng, radius_km, status, time)
  values (e ->> 'id', e ->> 'source', e ->> 'type', e ->> 'title', (e ->> 'magnitude')::float8, (e ->> 'depthKm')::float8,
          (e ->> 'lat')::float8, (e ->> 'lng')::float8, (e ->> 'radiusKm')::float8, 'active', coalesce((e ->> 'time')::timestamptz, now()))
  on conflict (id) do update set type = excluded.type, title = excluded.title, lat = excluded.lat, lng = excluded.lng,
    radius_km = excluded.radius_km, status = 'active'
  returning * into ev;
  update public.family_units u set status = 'waiting_match'
  where u.status in ('idle', 'waiting_match') and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false);
  get diagnostics n = row_count;
  return jsonb_build_array(jsonb_build_object('tone', 'critical', 'msg', jsonb_build_object('k', 'activated', 'title', ev.title, 'n', n)));
end $$;

create function public.close_event(p_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(array['coordinator']);
  update public.disaster_events set status = 'closed' where id = p_id;
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg', jsonb_build_object('k', 'closed')));
end $$;

/** EMER-5 / MTCH-1: match every family in the hazard zone that still needs a place. */
create function public.run_matching() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.disaster_events;
  ids text[];
  made int;
begin
  perform private.require_role(array['coordinator']);
  select * into ev from public.disaster_events where status = 'active';
  if not found then raise exception 'no_event'; end if;
  select coalesce(array_agg(id), '{}') into ids from public.family_units u
  where u.status in ('idle', 'waiting_match') and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false);
  made := private.match(ids);
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg',
    jsonb_build_object('k', 'matched', 'made', made, 'backlog', cardinality(ids) - made)));
end $$;

create function public.confirm_assignment(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  a := private.move(p_id, 'confirmed');
  update public.evacuation_assignments set confirmed_at = now() where id = p_id;
  update public.family_units set status = 'confirmed' where id = a.family_id;
  return '[]';
end $$;

create function public.reject_assignment(p_id uuid, p_code text, p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  a := private.move(p_id, 'rejected');
  update public.evacuation_assignments set rejection_code = p_code, rejection_reason = p_note where id = p_id;
  update public.family_units set status = 'waiting_match' where id = a.family_id;
  perform private.match(array[a.family_id], jsonb_build_object(a.family_id, p_id));
  return private.realloc_alerts(array[a.family_id]);
end $$;

/** Citizen taps "ready for pickup". */
create function public.mark_ready(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if private.my_role() is distinct from 'coordinator' and not exists (
    select 1 from public.evacuation_assignments a join public.family_units u on u.id = a.family_id
    where a.id = p_id and u.owner_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  update public.evacuation_assignments set ready_for_pickup_at = now() where id = p_id;
  return '[]';
end $$;

/** RULE 5 + NAV-3. */
create function public.dispatch_assignment(p_id uuid, p_volunteer text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.evacuation_assignments;
  v public.volunteers;
begin
  perform private.require_role(array['coordinator']);
  select * into a from public.evacuation_assignments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into v from public.volunteers where id = p_volunteer;
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'confirmed' then raise exception 'not_confirmed'; end if;
  if exists (select 1 from public.functional_needs n where n.family_id = a.family_id and n.wheelchair_vehicle_needed)
     and v.vehicle_type not in ('wheelchair_accessible_van', 'ambulance') then
    raise exception 'vehicle_mismatch';
  end if;
  update public.evacuation_assignments set volunteer_id = v.id, vehicle_type = v.vehicle_type where id = p_id;
  return '[]';
end $$;

create function public.depart(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if private.my_role() is distinct from 'coordinator' and private.my_volunteer() is distinct from a.volunteer_id then raise exception 'forbidden'; end if;
  a := private.move(p_id, 'in_transit');
  update public.evacuation_assignments set departed_at = now() where id = p_id;
  update public.family_units set status = 'in_transit' where id = a.family_id;
  return '[]';
end $$;

/** CHKN: p_unmet = { type, description, severity } when the shelter could not provide something. */
create function public.check_in(p_id uuid, p_unmet jsonb default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.evacuation_assignments;
  fam text;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  a := private.move(p_id, 'arrived');
  update public.evacuation_assignments set arrived_at = now() where id = p_id;
  update public.family_units set status = 'arrived' where id = a.family_id returning family_name into fam;
  if p_unmet is null then return '[]'; end if;
  insert into public.unmet_needs (family_id, shelter_id, missing_facility_type, description, severity)
  values (a.family_id, a.shelter_id, p_unmet ->> 'type', p_unmet ->> 'description', p_unmet ->> 'severity');
  return jsonb_build_array(jsonb_build_object('tone', 'warning', 'msg',
    jsonb_build_object('k', 'checkin_unmet', 'family', fam, 'facility', p_unmet ->> 'type')));
end $$;

/** REG-1..3 and field triage. Status and owner are server-managed and never taken from the client. */
create function public.save_family(f jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    min_power_wattage, wheelchair_vehicle_needed, preferred_language, infant_count, pregnant_count, notes)
  values (f ->> 'id', (n ->> 'noStairsRequired')::boolean, (n ->> 'accessibleToiletNeeded')::boolean, (n ->> 'caregiverSpaceNeeded')::boolean,
    (n ->> 'medicalPowerRequired')::boolean, coalesce((n ->> 'minPowerWattage')::int, 0), (n ->> 'wheelchairVehicleNeeded')::boolean,
    coalesce(n ->> 'preferredLanguage', 'Indonesia'), coalesce((n ->> 'infantCount')::int, 0), coalesce((n ->> 'pregnantCount')::int, 0),
    coalesce(n ->> 'notes', ''))
  on conflict (family_id) do update set no_stairs_required = excluded.no_stairs_required, accessible_toilet_needed = excluded.accessible_toilet_needed,
    caregiver_space_needed = excluded.caregiver_space_needed, medical_power_required = excluded.medical_power_required,
    min_power_wattage = excluded.min_power_wattage, wheelchair_vehicle_needed = excluded.wheelchair_vehicle_needed,
    preferred_language = excluded.preferred_language, infant_count = excluded.infant_count, pregnant_count = excluded.pregnant_count,
    notes = excluded.notes;
  return '[]';
end $$;

/** SHLT-2: facility details. Status and verification have their own RPCs. */
create function public.save_shelter(s jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare x jsonb := s -> 'features';
begin
  perform private.require_shelter(s ->> 'id');
  update public.shelters set name = s ->> 'name', address = s ->> 'address', contact = s ->> 'contact',
    total_capacity = (s ->> 'totalCapacity')::int, current_occupancy = (s ->> 'currentOccupancy')::int,
    has_ramp = (x ->> 'hasRamp')::boolean, ramp_slope_compliant = (x ->> 'rampSlopeCompliant')::boolean,
    door_width_accessible = (x ->> 'doorWidthAccessible')::boolean, has_accessible_toilet = (x ->> 'hasAccessibleToilet')::boolean,
    accessible_toilet_count = (x ->> 'accessibleToiletCount')::int, has_medical_power = (x ->> 'hasMedicalPower')::boolean,
    backup_generator_capacity_watt = (x ->> 'backupGeneratorCapacityWatt')::int, has_caregiver_rooms = (x ->> 'hasCaregiverRooms')::boolean,
    supported_languages = array(select jsonb_array_elements_text(x -> 'supportedLanguages'))
  where id = s ->> 'id';
  if not found then raise exception 'not_found'; end if;
  return '[]';
end $$;

/** SHLT-6: closing a shelter moves everyone heading there. */
create function public.set_shelter_status(p_id text, p_status text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_shelter(p_id);
  update public.shelters set operational_status = p_status where id = p_id;
  if p_status not in ('closed_emergency', 'inactive') then return '[]'; end if;
  return private.reallocate(array(
    select id from public.evacuation_assignments where shelter_id = p_id and status in ('recommended', 'confirmed', 'in_transit')));
end $$;

/** SHLT-5. */
create function public.verify_shelter(p_id text, p_verified boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(array['coordinator']);
  update public.shelters set verification_status = case when p_verified then 'verified' else 'unverified' end where id = p_id;
  return '[]';
end $$;

/** UNMT-3. */
create function public.resolve_unmet(p_id uuid, p_status text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(array['coordinator']);
  update public.unmet_needs set resolution_status = p_status where id = p_id;
  return '[]';
end $$;

-- Only signed-in users may call RPCs; role checks happen inside each function.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon;
