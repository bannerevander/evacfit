-- OFFL-3/4: field actions queued offline are replayed through run_once with the client's request UUID.
-- The request id is recorded in the same transaction as the action, so:
--   action failed  -> id rolled back too, a retry runs it again;
--   action applied but the reply was lost -> the retry finds the id and returns without applying twice.
create table private.client_requests (
  id uuid primary key,
  actor uuid,
  fn text not null,
  done_at timestamptz not null default now()
);

create function public.run_once(p_request uuid, p_fn text, p_args jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_fn not in ('save_family', 'depart', 'check_in', 'mark_ready') then raise exception 'forbidden'; end if;
  insert into private.client_requests (id, actor, fn) values (p_request, auth.uid(), p_fn) on conflict (id) do nothing;
  if not found then return '[]'; end if; -- already applied by an earlier attempt
  return case p_fn
    when 'save_family' then public.save_family(p_args -> 'f')
    when 'depart' then public.depart((p_args ->> 'p_id')::uuid)
    when 'check_in' then public.check_in((p_args ->> 'p_id')::uuid, nullif(p_args -> 'p_unmet', 'null'::jsonb))
    when 'mark_ready' then public.mark_ready((p_args ->> 'p_id')::uuid)
  end;
end $$;
revoke execute on function public.run_once(uuid, text, jsonb) from public, anon;
grant execute on function public.run_once(uuid, text, jsonb) to authenticated;

-- Housekeeping: request ids only need to outlive a device's offline period; pg_cron's own run log grows ~2.6 MB/day.
select cron.schedule('housekeeping', '17 3 * * *', $$
  delete from private.client_requests where done_at < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '3 days';
$$);
