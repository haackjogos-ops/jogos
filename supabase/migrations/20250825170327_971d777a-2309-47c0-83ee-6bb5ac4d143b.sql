-- Re-schedule cron to call public function without JWT
select cron.unschedule('auto-advance-fila-every-10s');

select
cron.schedule(
  'auto-advance-fila-every-10s',
  '*/10 * * * * *', -- every 10 seconds
  $$
  select
    net.http_post(
        url:='https://fjlseraeptjzjwngcqsm.supabase.co/functions/v1/auto-advance-fila',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);