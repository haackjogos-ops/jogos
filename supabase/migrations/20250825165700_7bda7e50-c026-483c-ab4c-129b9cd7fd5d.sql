-- Enable extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the auto-advance function to run every 10 seconds
SELECT cron.schedule(
  'auto-advance-fila-every-10s',
  '*/10 * * * * *', -- every 10 seconds
  $$
  SELECT
    net.http_post(
        url:='https://fjlseraeptjzjwngcqsm.supabase.co/functions/v1/auto-advance-fila',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbHNlcmFlcHRqemp3bmdjcXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3Nzg1MDgsImV4cCI6MjA3MTM1NDUwOH0.GsTI117jynXogJ0ppTccZpdEiGwE1CEvFlD2QpjEHjA"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);