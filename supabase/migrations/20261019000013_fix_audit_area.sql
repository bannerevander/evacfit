-- Fix for 09: PL/pgSQL evaluates every record field in the statement, so new.family_id failed on tables without it
-- (activating an event raised "record new has no field family_id"). Read fields through jsonb instead.
create or replace function private.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_data, new_data, operation_area_id)
  values (auth.uid(), tg_table_name, r ->> 'id', tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'geog' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'geog' end,
          case when tg_table_name = 'evacuation_assignments' then private.family_area(r ->> 'family_id') else r ->> 'operation_area_id' end);
  return null;
end $$;
