-- Tare — run the reminder check every 15 minutes.
-- Before running: replace YOUR_CRON_SECRET with the CRON_SECRET value you set
-- in Vercel, and check the URL is your app's address.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'tare-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tare-six.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
