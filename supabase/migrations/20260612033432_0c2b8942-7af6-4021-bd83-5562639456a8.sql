DO $$
DECLARE
  scrape_job RECORD;
  monitor_job RECORD;
  scrape_secret TEXT;
  monitor_secret TEXT;
  scrape_url TEXT;
  monitor_url TEXT;
BEGIN
  SELECT jobid, schedule, command INTO scrape_job
  FROM cron.job
  WHERE jobname = 'scrape-products-daily';

  IF scrape_job.jobid IS NULL THEN
    RAISE EXCEPTION 'scrape-products-daily cron job not found';
  END IF;

  SELECT jobid, schedule, command INTO monitor_job
  FROM cron.job
  WHERE jobname = 'monitor-scrape-failures-daily';

  IF monitor_job.jobid IS NULL THEN
    RAISE EXCEPTION 'monitor-scrape-failures-daily cron job not found';
  END IF;

  scrape_secret := (regexp_match(scrape_job.command, '"X-Cron-Secret": "([^"]+)"'))[1];
  monitor_secret := (regexp_match(monitor_job.command, '"X-Cron-Secret": "([^"]+)"'))[1];
  scrape_url := (regexp_match(scrape_job.command, 'url := ''([^'']+)'''))[1];
  monitor_url := (regexp_match(monitor_job.command, 'url := ''([^'']+)'''))[1];

  IF scrape_secret IS NULL OR scrape_url IS NULL THEN
    RAISE EXCEPTION 'Could not extract scrape-products cron URL or secret';
  END IF;

  IF monitor_secret IS NULL OR monitor_url IS NULL THEN
    RAISE EXCEPTION 'Could not extract monitor-scrape-failures cron URL or secret';
  END IF;

  PERFORM cron.alter_job(
    job_id := scrape_job.jobid,
    schedule := scrape_job.schedule,
    command := format($cmd$
      WITH req AS (
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', %L
          ),
          body := '{"scheduled": true}'::jsonb,
          timeout_milliseconds := 15000
        ) AS id
      )
      INSERT INTO public.cron_http_call_log (request_id, jobname, url)
      SELECT id, 'scrape-products-daily', %L
      FROM req;
    $cmd$, scrape_url, scrape_secret, scrape_url),
    active := true
  );

  PERFORM cron.alter_job(
    job_id := monitor_job.jobid,
    schedule := monitor_job.schedule,
    command := format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', %L
        ),
        body := '{"scheduled": true}'::jsonb,
        timeout_milliseconds := 15000
      ) AS request_id;
    $cmd$, monitor_url, monitor_secret),
    active := true
  );
END $$;