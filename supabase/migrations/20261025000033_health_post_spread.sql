-- Spread health posts across the demo shelters (not only Puskesmas), so each area has a mix. Same flags as web/src/data/mock.ts.
create or replace function private.seed_health() returns void language sql security definer set search_path to '' as $$
  update public.shelters set has_health_post = id in ('sh-01', 'sh-03', 'sh-05', 'sh-07', 'sh-08', 'sh-10', 'sh-11', 'sh-13', 'sh-14',
    'sh-15', 'sh-17', 'sh-18', 'sh-21', 'sh-22', 'sh-25', 'sh-26', 'sh-27', 'sh-29', 'sh-31', 'sh-32', 'sh-33', 'sh-35')
  where id ~ '^sh-[0-9]+$';
  update public.functional_needs set chronic_care_needed = family_id in ('fam-03', 'fam-07', 'fam-14', 'fam-26', 'fam-31', 'fam-35', 'fam-38', 'fam-42')
  where family_id ~ '^fam-[0-9]+$';
$$;

revoke execute on function private.seed_health() from public, anon, authenticated;

select private.seed_health();
