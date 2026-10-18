-- EMER-2: poll BMKG every minute through the bmkg-poll Edge Function (supabase/functions/bmkg-poll).
-- The bearer is the project's public anon key (already shipped to browsers); it only satisfies verify_jwt.
create extension if not exists pg_net with schema extensions;

select cron.schedule('bmkg-poll', '* * * * *', $$
  select net.http_post(
    url := 'https://fcomzjgermigsahkdtkw.supabase.co/functions/v1/bmkg-poll',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjb216amdlcm1pZ3NhaGtkdGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzQ0MTAsImV4cCI6MjEwNzkxMDQxMH0.dZ4EOZT7v4wAH5EvgeO9X1_YHbL5DIr9-qWVp4uOlBQ'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$$);
