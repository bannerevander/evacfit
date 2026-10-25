-- Closing an operation ends it for every family in the area: the next activation starts clean instead of inheriting
-- last operation's arrivals, placements and backlog (assignments carry no event id, so they are scoped by area).
create or replace function public.close_event(p_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  area text := private.my_area();
begin
  perform private.require_role(array['coordinator']);
  update public.disaster_events set status = 'closed' where id = p_id and operation_area_id = area;
  if not found then raise exception 'not_found'; end if;
  delete from public.evacuation_assignments a using public.family_units f where a.family_id = f.id and f.operation_area_id = area;
  delete from public.unmet_needs u using public.family_units f where u.family_id = f.id and f.operation_area_id = area;
  update public.family_units set status = 'idle', current_lat = null, current_lng = null, current_at = null
  where operation_area_id = area;
  return jsonb_build_array(jsonb_build_object('tone', 'info', 'msg', jsonb_build_object('k', 'closed')));
end $$;
