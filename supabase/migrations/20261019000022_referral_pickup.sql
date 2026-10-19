-- Referral fixes: the family is physically at the origin shelter, so
--   * pickup point (and distance to the new shelter) = origin shelter, not the home address;
--   * the new placement says where to pick them up (reason.pickupShelter);
--   * the origin shelter's record says where they are going (reason.referredTo) so it can track the transfer.
create or replace function public.refer_family(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.evacuation_assignments;
  origin public.shelters;
  fam text;
begin
  select * into a from public.evacuation_assignments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  perform private.require_shelter(a.shelter_id);
  if a.status <> 'arrived' then raise exception 'bad_transition'; end if;
  select * into origin from public.shelters where id = a.shelter_id;
  begin
    perform private.move(p_id, 'reallocated');
    update public.family_units
    set status = 'waiting_match', current_lat = origin.lat, current_lng = origin.lng, current_at = now()
    where id = a.family_id;
    -- shortcut: the old shelter's seat is released now, while the family physically waits there for transport.
    if private.match(array[a.family_id], jsonb_build_object(a.family_id, p_id), '{}', true) = 0 then
      raise exception 'no_referral';
    end if;
  exception when raise_exception then
    if sqlerrm <> 'no_referral' then raise; end if;
    select family_name into fam from public.family_units where id = a.family_id;
    return jsonb_build_array(jsonb_build_object('tone', 'warning', 'msg', jsonb_build_object('k', 'no_referral', 'family', fam)));
  end;
  update public.evacuation_assignments set reason = reason || jsonb_build_object('pickupShelter', origin.name)
  where family_id = a.family_id and status = 'recommended';
  -- shortcut: names the first destination; if that shelter later rejects, the family's status still shows progress.
  update public.evacuation_assignments set reason = reason || jsonb_build_object('referredTo', (
    select s.name from public.evacuation_assignments n join public.shelters s on s.id = n.shelter_id
    where n.family_id = a.family_id and n.status = 'recommended'))
  where id = p_id;
  update public.unmet_needs set resolution_status = 'resolved'
  where family_id = a.family_id and shelter_id = a.shelter_id and resolution_status <> 'resolved';
  return private.realloc_alerts(array[a.family_id]);
end $$;
