-- Testing aid: a shelter manager can switch which shelter they staff, and a volunteer which crew/vehicle they are,
-- within their own area (+ neighbours). Permissions follow immediately because RLS reads these profile columns.
-- shortcut: self-service reassignment is fine while every account is a demo account; make it a coordinator action
-- (or remove it) once real accounts exist.
create function public.switch_work(p_shelter text default null, p_volunteer text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  scope text[] := private.area_scope(private.my_area());
begin
  if p_shelter is not null then
    perform private.require_role(array['shelter_manager']);
    if not exists (select 1 from public.shelters where id = p_shelter and operation_area_id = any (scope)) then raise exception 'not_found'; end if;
    update public.profiles set shelter_id = p_shelter where id = auth.uid();
  end if;
  if p_volunteer is not null then
    perform private.require_role(array['volunteer']);
    if not exists (select 1 from public.volunteers where id = p_volunteer and operation_area_id = any (scope)) then raise exception 'not_found'; end if;
    update public.profiles set volunteer_id = p_volunteer where id = auth.uid();
  end if;
  return '[]';
end $$;
revoke execute on function public.switch_work(text, text) from public, anon;
grant execute on function public.switch_work(text, text) to authenticated;
