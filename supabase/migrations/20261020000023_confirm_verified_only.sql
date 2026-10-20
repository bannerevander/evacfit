-- BUG-016: matching only uses verified shelters, so confirming must too. Covers recommendations made before
-- verification was revoked (or before facilities changed and the shelter went back to "needs inspection").
create or replace function public.confirm_assignment(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.evacuation_assignments;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  if (select verification_status from public.shelters where id = a.shelter_id) is distinct from 'verified' then
    raise exception 'shelter_unverified';
  end if;
  a := private.move(p_id, 'confirmed');
  update public.evacuation_assignments set confirmed_at = now() where id = p_id;
  update public.family_units set status = 'confirmed' where id = a.family_id;
  return '[]';
end $$;
