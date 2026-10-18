-- Supabase advisors: pin search_path on the remaining helper, index profile FKs.
alter function private.vulnerability(public.functional_needs) set search_path = '';
create index profiles_shelter_idx on public.profiles (shelter_id);
create index profiles_volunteer_idx on public.profiles (volunteer_id);
