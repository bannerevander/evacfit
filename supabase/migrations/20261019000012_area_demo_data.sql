-- Wire the existing demo data to areas after the North Sumatra import.
select private.refresh_areas();

-- Demo: Kota Medan's alert panel shows every live BMKG draft in Indonesia (jury sees real quakes).
-- A real BPBD keeps the default 300 km.
update public.operation_areas set alert_radius_km = 3000 where id = 'ID-SU-kota-medan';

update public.profiles set operation_area_id = 'ID-SU-kota-medan' where true;
update public.volunteers set operation_area_id = 'ID-SU-kota-medan' where true;

-- Reseeding keeps volunteers in Kota Medan (families and shelters get their area from the trigger).
alter function private.seed_demo() rename to seed_demo_v1;
create or replace function private.seed_demo() returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform private.seed_demo_v1();
  update public.volunteers set operation_area_id = 'ID-SU-kota-medan' where operation_area_id is null;
end $fn$;
