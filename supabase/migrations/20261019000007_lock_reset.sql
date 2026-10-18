-- The app no longer has a "reset demo data" button; reseeding is an operator task (SQL: select private.seed_demo()).
revoke execute on function public.reset_demo() from authenticated;
drop function public.reset_demo();
