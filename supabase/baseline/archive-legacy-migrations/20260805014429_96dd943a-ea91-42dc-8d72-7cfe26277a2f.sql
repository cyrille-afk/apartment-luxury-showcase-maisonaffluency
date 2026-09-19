DELETE FROM public.video_watch_events WHERE session_id LIKE 'rl-test-%';
DELETE FROM public.analytics_rate_limits WHERE bucket_key LIKE 'video_watch_events:rl-test-%';