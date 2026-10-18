-- SEC-5: every placement status change and shelter decision is recorded. audit_log has no update/delete path.
create function private.audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, coalesce(new.id, old.id)::text, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'geog' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'geog' end);
  return null;
end $$;

create trigger audit after insert or update of status on public.evacuation_assignments
  for each row execute function private.audit();
create trigger audit after update of operational_status, verification_status on public.shelters
  for each row execute function private.audit();
create trigger audit after insert or update of status on public.disaster_events
  for each row execute function private.audit();
revoke execute on function private.audit() from public, anon, authenticated;

-- CONF-2: soft-locks expire server-side, whether or not any browser is open.
select cron.schedule('expire-soft-locks', '* * * * *', 'select private.expire_soft_locks()');
