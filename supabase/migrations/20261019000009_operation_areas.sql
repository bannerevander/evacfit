-- Phase 2 (RISET-Skala-Universal.md §3.1): countries + operation areas (one BPBD / county / municipality each).
-- Families, shelters and volunteers belong to the area their coordinates fall in; set by trigger, never by the client.

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'), -- ISO 3166-1 alpha-2
  name text not null,
  emergency_number text not null,
  service_languages text[] not null,
  time_zone text not null
);
insert into public.countries values
  ('ID', 'Indonesia', '112', '{Indonesia,English,BISINDO,Batak Toba,Karo,Mandailing,Jawa,Minang}', 'Asia/Jakarta');

create table public.operation_areas (
  id text primary key,
  country_code text not null references public.countries,
  name text not null,
  admin_level int not null, -- 1 = province/state, 2 = regency/city/county, …
  source text not null,     -- where the boundary comes from (geoBoundaries, BIG, COD-AB, …)
  source_code text,         -- the source's own code (P-code, Kemendagri code, shapeID)
  boundary extensions.geography(multipolygon, 4326) not null,
  center_lat double precision generated always as (extensions.st_y(extensions.st_pointonsurface(boundary::extensions.geometry))) stored,
  center_lng double precision generated always as (extensions.st_x(extensions.st_pointonsurface(boundary::extensions.geometry))) stored,
  -- BMKG/USGS/GDACS drafts within this distance of the boundary are shown to the area's coordinator.
  alert_radius_km double precision not null default 300,
  -- Areas sharing a border: their shelters may receive this area's families (cross-border evacuation).
  neighbors text[] not null default '{}'
);
create index operation_areas_boundary_idx on public.operation_areas using gist (boundary);
create index operation_areas_country_idx on public.operation_areas (country_code);

alter table public.profiles add column operation_area_id text references public.operation_areas;
alter table public.family_units add column operation_area_id text references public.operation_areas;
alter table public.shelters add column operation_area_id text references public.operation_areas;
alter table public.volunteers add column operation_area_id text references public.operation_areas;
-- Set when a coordinator activates the event; null for unapproved drafts.
alter table public.disaster_events add column operation_area_id text references public.operation_areas;
alter table public.audit_log add column operation_area_id text;
create index profiles_area_idx on public.profiles (operation_area_id);
create index family_units_area_idx on public.family_units (operation_area_id);
create index shelters_area_idx on public.shelters (operation_area_id);
create index volunteers_area_idx on public.volunteers (operation_area_id);
create index disaster_events_area_idx on public.disaster_events (operation_area_id);

-- One active emergency per area instead of one globally.
drop index public.disaster_events_one_active;
create unique index disaster_events_one_active_per_area on public.disaster_events (operation_area_id) where status = 'active';

-- ---------- area helpers ----------

create function private.area_at(p_lat double precision, p_lng double precision) returns text language sql stable set search_path = '' as $$
  select a.id from public.operation_areas a
  where extensions.st_covers(a.boundary, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
  order by a.admin_level desc
  limit 1
$$;

create function private.set_area() returns trigger language plpgsql set search_path = '' as $$
begin
  new.operation_area_id := private.area_at(new.lat, new.lng);
  return new;
end $$;
create trigger set_area before insert or update of lat, lng on public.family_units for each row execute function private.set_area();
create trigger set_area before insert or update of lat, lng on public.shelters for each row execute function private.set_area();

/** Recomputes neighbours and re-tags rows; run after importing or changing boundaries. */
create function private.refresh_areas() returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.operation_areas a set neighbors = coalesce((
    select array_agg(b.id order by b.id) from public.operation_areas b
    where b.id <> a.id and extensions.st_dwithin(a.boundary, b.boundary, 100)), '{}')
  where true;
  update public.family_units set operation_area_id = private.area_at(lat, lng) where true;
  update public.shelters set operation_area_id = private.area_at(lat, lng) where true;
end $$;

create function private.my_area() returns text language sql stable security definer set search_path = '' as
$$ select operation_area_id from public.profiles where id = (select auth.uid()) $$;

/** My area plus its neighbours. */
create function private.area_scope(aid text) returns text[] language sql stable security definer set search_path = '' as
$$ select coalesce((select array[a.id] || a.neighbors from public.operation_areas a where a.id = aid), '{}') $$;

create function private.family_area(fid text) returns text language sql stable security definer set search_path = '' as
$$ select operation_area_id from public.family_units where id = fid $$;

create function private.shelter_area(sid text) returns text language sql stable security definer set search_path = '' as
$$ select operation_area_id from public.shelters where id = sid $$;

/** Shelters/volunteers on this account's own placements (a resident must see where they are going and who picks them up). */
create function private.my_assigned_shelters() returns setof text language sql stable security definer set search_path = '' as $$
  select a.shelter_id from public.evacuation_assignments a join public.family_units f on f.id = a.family_id where f.owner_id = (select auth.uid())
$$;
create function private.my_assigned_volunteers() returns setof text language sql stable security definer set search_path = '' as $$
  select a.volunteer_id from public.evacuation_assignments a join public.family_units f on f.id = a.family_id
  where f.owner_id = (select auth.uid()) and a.volunteer_id is not null
$$;

grant execute on function private.my_area(), private.area_scope(text), private.family_area(text), private.shelter_area(text),
  private.my_assigned_shelters(), private.my_assigned_volunteers() to authenticated;

-- ---------- RLS per area ----------

alter table public.countries enable row level security;
alter table public.operation_areas enable row level security;
create policy "public reference data" on public.countries for select to authenticated using (true);
create policy "public reference data" on public.operation_areas for select to authenticated using (true);
grant select on public.countries, public.operation_areas to authenticated;

create or replace function private.can_see_family(fid text) returns boolean language sql stable security definer set search_path = '' as $$
  select (private.my_role() = 'coordinator' and (
            private.family_area(fid) = private.my_area()
            -- families from a neighbouring area placed in one of my shelters
            or exists (select 1 from public.evacuation_assignments a where a.family_id = fid and private.shelter_area(a.shelter_id) = private.my_area())))
    or exists (select 1 from public.family_units f where f.id = fid and f.owner_id = (select auth.uid()))
    or exists (
      select 1 from public.evacuation_assignments a
      where a.family_id = fid and (a.shelter_id = private.my_shelter() or a.volunteer_id = private.my_volunteer())
    )
$$;

drop policy "own profile or coordinator" on public.profiles;
create policy "own profile or area coordinator" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or ((select private.my_role()) = 'coordinator' and operation_area_id = (select private.my_area())));

drop policy "signed-in read" on public.shelters;
create policy "area shelters" on public.shelters for select to authenticated using (
  operation_area_id = any (private.area_scope((select private.my_area())))
  or id = (select private.my_shelter())
  or id in (select private.my_assigned_shelters())
);

drop policy "signed-in read" on public.volunteers;
create policy "area volunteers" on public.volunteers for select to authenticated using (
  operation_area_id = any (private.area_scope((select private.my_area())))
  or id = (select private.my_volunteer())
  or id in (select private.my_assigned_volunteers())
);

drop policy "signed-in read" on public.disaster_events;
create policy "area events" on public.disaster_events for select to authenticated using (
  operation_area_id = (select private.my_area())
  or operation_area_id in (select f.operation_area_id from public.family_units f where f.owner_id = (select auth.uid()))
  -- unapproved drafts near my area, for the coordinator's alert panel (EMER-3)
  or (status = 'draft' and (select private.my_role()) = 'coordinator' and exists (
        select 1 from public.operation_areas a
        where a.id = (select private.my_area()) and extensions.st_dwithin(a.boundary, geog, a.alert_radius_km * 1000)))
);

drop policy "assignment scope" on public.evacuation_assignments;
create policy "assignment scope" on public.evacuation_assignments for select to authenticated using (
  ((select private.my_role()) = 'coordinator'
    and (private.family_area(family_id) = (select private.my_area()) or private.shelter_area(shelter_id) = (select private.my_area())))
  or shelter_id = (select private.my_shelter())
  or volunteer_id = (select private.my_volunteer())
  or exists (select 1 from public.family_units f where f.id = family_id and f.owner_id = (select auth.uid()))
);

drop policy "unmet scope" on public.unmet_needs;
create policy "unmet scope" on public.unmet_needs for select to authenticated using (
  ((select private.my_role()) = 'coordinator'
    and (private.family_area(family_id) = (select private.my_area()) or private.shelter_area(shelter_id) = (select private.my_area())))
  or shelter_id = (select private.my_shelter())
  or exists (select 1 from public.family_units f where f.id = family_id and f.owner_id = (select auth.uid()))
);

drop policy "coordinator reads audit" on public.audit_log;
create policy "area coordinator reads audit" on public.audit_log for select to authenticated
  using ((select private.my_role()) = 'coordinator' and operation_area_id = (select private.my_area()));

create or replace function private.audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_data, new_data, operation_area_id)
  values (auth.uid(), tg_table_name, coalesce(new.id, old.id)::text, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'geog' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'geog' end,
          case tg_table_name
            when 'evacuation_assignments' then private.family_area(coalesce(new.family_id, old.family_id))
            else coalesce(new.operation_area_id, old.operation_area_id) end);
  return null;
end $$;

-- ---------- matching per area ----------

/**
 * Same greedy as before, but each family is matched against the active emergency of ITS area,
 * using shelters in that area and its neighbours.
 * shortcut: one global shelter lock serialises all areas; partition the lock per area when load requires it.
 */
create or replace function private.match(p_ids text[], p_from jsonb default '{}') returns int language plpgsql security definer set search_path = '' as $$
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
  perform 1 from public.shelters order by id for update;

  update public.unmet_needs set resolution_status = 'resolved'
  where resolution_status <> 'resolved' and shelter_id is null and family_id = any (p_ids);

  for f in
    select u.id, u.member_count, u.geog, u.operation_area_id as area, n.*, private.vulnerability(n) as score
    from public.family_units u join public.functional_needs n on n.family_id = u.id
    where u.id = any (p_ids) and u.status in ('idle', 'waiting_match')
    order by score desc, u.id
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

-- ---------- RPCs that change with areas ----------

create or replace function public.activate_event(e jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.disaster_events;
  area text := private.my_area();
  n int;
begin
  perform private.require_role(array['coordinator']);
  if area is null then raise exception 'forbidden'; end if;
  update public.disaster_events set status = 'closed' where status = 'active' and operation_area_id = area and id <> e ->> 'id';
  insert into public.disaster_events (id, source, type, title, magnitude, depth_km, lat, lng, radius_km, status, time, operation_area_id)
  values (e ->> 'id', e ->> 'source', e ->> 'type', e ->> 'title', (e ->> 'magnitude')::float8, (e ->> 'depthKm')::float8,
          (e ->> 'lat')::float8, (e ->> 'lng')::float8, (e ->> 'radiusKm')::float8, 'active', coalesce((e ->> 'time')::timestamptz, now()), area)
  on conflict (id) do update set type = excluded.type, title = excluded.title, lat = excluded.lat, lng = excluded.lng,
    radius_km = excluded.radius_km, status = 'active', operation_area_id = area
  -- a draft or my own event only; another area's live event cannot be taken over
  where public.disaster_events.operation_area_id is null or public.disaster_events.operation_area_id = area
  returning * into ev;
  if ev.id is null then raise exception 'forbidden'; end if;
  update public.family_units u set status = 'waiting_match'
  where u.operation_area_id = area and u.status in ('idle', 'waiting_match')
    and extensions.st_dwithin(u.geog, ev.geog, ev.radius_km * 1000, false);
  get diagnostics n = row_count;
  return jsonb_build_array(jsonb_build_object('tone', 'critical', 'msg', jsonb_build_object('k', 'activated', 'title', ev.title, 'n', n)));
end $$;

create or replace function public.close_event(p_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(array['coordinator']);
  update public.disaster_events set status = 'closed' where id = p_id and operation_area_id = private.my_area();
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg', jsonb_build_object('k', 'closed')));
end $$;

create or replace function public.run_matching() returns jsonb language plpgsql security definer set search_path = '' as $$
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
  made := private.match(ids);
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg',
    jsonb_build_object('k', 'matched', 'made', made, 'backlog', cardinality(ids) - made)));
end $$;

create or replace function public.dispatch_assignment(p_id uuid, p_volunteer text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.evacuation_assignments;
  v public.volunteers;
begin
  perform private.require_role(array['coordinator']);
  select * into a from public.evacuation_assignments where id = p_id for update;
  if not found or private.family_area(a.family_id) is distinct from private.my_area() then raise exception 'not_found'; end if;
  select * into v from public.volunteers where id = p_volunteer and operation_area_id = any (private.area_scope(private.my_area()));
  if not found then raise exception 'not_found'; end if;
  if a.status <> 'confirmed' then raise exception 'not_confirmed'; end if;
  if exists (select 1 from public.functional_needs n where n.family_id = a.family_id and n.wheelchair_vehicle_needed)
     and v.vehicle_type not in ('wheelchair_accessible_van', 'ambulance') then
    raise exception 'vehicle_mismatch';
  end if;
  update public.evacuation_assignments set volunteer_id = v.id, vehicle_type = v.vehicle_type where id = p_id;
  return '[]';
end $$;

/** SHLT-2 + location. Moving a shelter sends it back to "needs inspection" (SHLT-5); it must stay inside a served area. */
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
    verification_status = case when moved then 'unverified' else verification_status end,
    total_capacity = (s ->> 'totalCapacity')::int, current_occupancy = (s ->> 'currentOccupancy')::int,
    has_ramp = (x ->> 'hasRamp')::boolean, ramp_slope_compliant = (x ->> 'rampSlopeCompliant')::boolean,
    door_width_accessible = (x ->> 'doorWidthAccessible')::boolean, has_accessible_toilet = (x ->> 'hasAccessibleToilet')::boolean,
    accessible_toilet_count = (x ->> 'accessibleToiletCount')::int, has_medical_power = (x ->> 'hasMedicalPower')::boolean,
    backup_generator_capacity_watt = (x ->> 'backupGeneratorCapacityWatt')::int, has_caregiver_rooms = (x ->> 'hasCaregiverRooms')::boolean,
    supported_languages = array(select jsonb_array_elements_text(x -> 'supportedLanguages'))
  where id = s ->> 'id';
  return '[]';
end $$;

/** Location picker: which served area a point is in (null = outside every area). */
create function public.area_at(p_lat double precision, p_lng double precision) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'name', a.name) from public.operation_areas a where a.id = private.area_at(p_lat, p_lng)
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
