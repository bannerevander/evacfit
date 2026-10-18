-- SEC-2: RLS on every table. Reads are scoped per role; every write goes through the RPCs in the next migration,
-- so there are no insert/update/delete policies for clients at all.

-- Helpers are SECURITY DEFINER so policies can look across tables without recursing into each other's RLS.
create function private.my_role() returns text language sql stable security definer set search_path = '' as
$$ select role from public.profiles where id = (select auth.uid()) $$;

create function private.my_shelter() returns text language sql stable security definer set search_path = '' as
$$ select shelter_id from public.profiles where id = (select auth.uid()) $$;

create function private.my_volunteer() returns text language sql stable security definer set search_path = '' as
$$ select volunteer_id from public.profiles where id = (select auth.uid()) $$;

/** Citizen: own families. Volunteer: families on their tasks + ones they triaged. Shelter: families sent to their shelter. */
create function private.can_see_family(fid text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.my_role() = 'coordinator'
    or exists (select 1 from public.family_units f where f.id = fid and f.owner_id = (select auth.uid()))
    or exists (
      select 1 from public.evacuation_assignments a
      where a.family_id = fid and (a.shelter_id = private.my_shelter() or a.volunteer_id = private.my_volunteer())
    )
$$;

grant execute on all functions in schema private to authenticated;

alter table public.profiles enable row level security;
alter table public.shelters enable row level security;
alter table public.volunteers enable row level security;
alter table public.family_units enable row level security;
alter table public.functional_needs enable row level security;
alter table public.disaster_events enable row level security;
alter table public.evacuation_assignments enable row level security;
alter table public.unmet_needs enable row level security;
alter table public.audit_log enable row level security;

create policy "own profile or coordinator" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.my_role()) = 'coordinator');

-- Shelter registry, volunteer roster and the emergency itself are operational info every signed-in role needs.
create policy "signed-in read" on public.shelters for select to authenticated using (true);
create policy "signed-in read" on public.volunteers for select to authenticated using (true);
create policy "signed-in read" on public.disaster_events for select to authenticated using (true);

create policy "family scope" on public.family_units for select to authenticated using (private.can_see_family(id));
create policy "family scope" on public.functional_needs for select to authenticated using (private.can_see_family(family_id));

create policy "assignment scope" on public.evacuation_assignments for select to authenticated using (
  (select private.my_role()) = 'coordinator'
  or shelter_id = (select private.my_shelter())
  or volunteer_id = (select private.my_volunteer())
  or exists (select 1 from public.family_units f where f.id = family_id and f.owner_id = (select auth.uid()))
);

create policy "unmet scope" on public.unmet_needs for select to authenticated using (
  (select private.my_role()) = 'coordinator'
  or shelter_id = (select private.my_shelter())
  or exists (select 1 from public.family_units f where f.id = family_id and f.owner_id = (select auth.uid()))
);

create policy "coordinator reads audit" on public.audit_log for select to authenticated
  using ((select private.my_role()) = 'coordinator');

-- Belt and braces: clients only read; anon gets nothing.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
