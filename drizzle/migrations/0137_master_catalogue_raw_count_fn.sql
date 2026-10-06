-- Raw (RLS-bypassing) count of the master catalogue, for display labels.
-- The public Data API sees only published/trade-visible rows (594 today);
-- the Full Catalogue label must show the true backend total (673).
create or replace function public.master_catalogue_raw_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.designer_curator_picks_public;
$$;

revoke all on function public.master_catalogue_raw_count() from public;
grant execute on function public.master_catalogue_raw_count() to anon, authenticated, service_role;