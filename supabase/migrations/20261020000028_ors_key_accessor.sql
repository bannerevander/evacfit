-- NAV-1/NAV-4: the route Edge Function reads the OpenRouteService key from Vault. The secret itself is created
-- outside migrations so it never lands in the repo:
--   select vault.create_secret('<ORS key>', 'ors_api_key', 'OpenRouteService key for the route Edge Function');
create function public.ors_api_key() returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ors_api_key' limit 1
$$;
revoke execute on function public.ors_api_key() from public, anon, authenticated;
grant execute on function public.ors_api_key() to service_role;
