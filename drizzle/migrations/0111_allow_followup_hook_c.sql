alter table public.acquisition_outreach_events drop constraint if exists acquisition_outreach_events_hook_check;
alter table public.acquisition_outreach_events add constraint acquisition_outreach_events_hook_check check (hook = any (array['A','B','C']));
alter table public.acquisition_link_clicks drop constraint if exists acquisition_link_clicks_hook_check;
alter table public.acquisition_link_clicks add constraint acquisition_link_clicks_hook_check check (hook = any (array['A','B','C']));