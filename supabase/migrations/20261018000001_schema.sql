-- EvacFit schema (PRD §8). Column names are snake_case versions of web/src/types.ts fields so the client maps by renaming keys.
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.shelters (
  id text primary key,
  name text not null,
  address text not null default '',
  contact text not null default '',
  lat double precision not null,
  lng double precision not null,
  geog extensions.geography(point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  total_capacity int not null check (total_capacity >= 0),
  current_occupancy int not null default 0 check (current_occupancy >= 0),
  operational_status text not null default 'open' check (operational_status in ('open', 'full', 'closed_emergency', 'inactive')),
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified')),
  has_ramp boolean not null default false,
  ramp_slope_compliant boolean not null default false,
  door_width_accessible boolean not null default false,
  has_accessible_toilet boolean not null default false,
  accessible_toilet_count int not null default 0,
  has_medical_power boolean not null default false,
  backup_generator_capacity_watt int not null default 0 check (backup_generator_capacity_watt >= 0),
  has_caregiver_rooms boolean not null default false,
  supported_languages text[] not null default '{Indonesia}'
);
create index shelters_geog_idx on public.shelters using gist (geog);

create table public.volunteers (
  id text primary key,
  name text not null,
  vehicle_type text not null check (vehicle_type in ('standard_car', 'ambulance', 'wheelchair_accessible_van', 'bus', 'boat')),
  plate text not null default ''
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('citizen', 'coordinator', 'shelter_manager', 'volunteer')),
  display_name text not null default '',
  shelter_id text references public.shelters,
  volunteer_id text references public.volunteers
);

create table public.family_units (
  id text primary key,
  code text not null,
  family_name text not null,
  member_count int not null check (member_count > 0),
  contact_phone text not null default '',
  address_notes text not null default '',
  lat double precision not null,
  lng double precision not null,
  geog extensions.geography(point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  status text not null default 'idle' check (status in ('idle', 'waiting_match', 'recommended', 'confirmed', 'in_transit', 'arrived', 'cancelled')),
  registered_via text not null default 'self' check (registered_via in ('self', 'caregiver', 'field_triage')),
  owner_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index family_units_geog_idx on public.family_units using gist (geog);
create index family_units_owner_idx on public.family_units (owner_id);

-- REG-2 / RULE 4: functional needs only, never a diagnosis.
create table public.functional_needs (
  family_id text primary key references public.family_units on delete cascade,
  no_stairs_required boolean not null default false,
  accessible_toilet_needed boolean not null default false,
  caregiver_space_needed boolean not null default false,
  medical_power_required boolean not null default false,
  min_power_wattage int not null default 0 check (min_power_wattage >= 0),
  wheelchair_vehicle_needed boolean not null default false,
  preferred_language text not null default 'Indonesia',
  infant_count int not null default 0,
  pregnant_count int not null default 0,
  notes text not null default ''
);

create table public.disaster_events (
  id text primary key,
  source text not null check (source in ('manual', 'bmkg')),
  type text not null check (type in ('earthquake', 'flood', 'volcanic_eruption', 'wildfire')),
  title text not null,
  magnitude double precision,
  depth_km double precision,
  lat double precision not null,
  lng double precision not null,
  geog extensions.geography(point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  radius_km double precision not null check (radius_km > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  time timestamptz not null default now(),
  external_event_id text unique
);
-- One active emergency at a time.
create unique index disaster_events_one_active on public.disaster_events (status) where status = 'active';

create table public.evacuation_assignments (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.family_units on delete cascade,
  shelter_id text not null references public.shelters,
  status text not null check (status in ('recommended', 'confirmed', 'rejected', 'in_transit', 'arrived', 'reallocated')),
  reason jsonb not null,
  distance_km double precision not null,
  created_at timestamptz not null default now(),
  soft_lock_expires_at timestamptz,
  confirmed_at timestamptz,
  departed_at timestamptz,
  arrived_at timestamptz,
  ready_for_pickup_at timestamptz,
  rejection_code text check (rejection_code in ('facility_power_down', 'ramp_damaged', 'local_capacity_full', 'shelter_unsafe', 'other')),
  rejection_reason text,
  reallocated_from_id uuid references public.evacuation_assignments,
  volunteer_id text references public.volunteers,
  vehicle_type text
);
create index evacuation_assignments_family_idx on public.evacuation_assignments (family_id, created_at);
create index evacuation_assignments_shelter_idx on public.evacuation_assignments (shelter_id, status);
create index evacuation_assignments_volunteer_idx on public.evacuation_assignments (volunteer_id);
create index evacuation_assignments_lock_idx on public.evacuation_assignments (soft_lock_expires_at) where status = 'recommended';
create index evacuation_assignments_from_idx on public.evacuation_assignments (reallocated_from_id);

create table public.unmet_needs (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.family_units on delete cascade,
  shelter_id text references public.shelters,
  missing_facility_type text not null check (missing_facility_type in ('medical_power', 'caregiver_room', 'no_stairs', 'accessible_toilet', 'general_capacity')),
  detail jsonb,
  description text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  resolution_status text not null default 'open' check (resolution_status in ('open', 'in_progress', 'resolved')),
  reported_at timestamptz not null default now()
);
create index unmet_needs_family_idx on public.unmet_needs (family_id);
create index unmet_needs_shelter_idx on public.unmet_needs (shelter_id);

-- SEC-5: insert-only (no update/delete grants or policies).
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  row_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb
);
