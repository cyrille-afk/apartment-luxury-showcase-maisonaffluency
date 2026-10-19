create or replace function public._hotspot_blocked_designer_names()
returns text[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(array_agg(distinct n), '{}'::text[])
  from public.designers d
  cross join lateral (values (public._norm_designer_name(d.name)), (public._norm_designer_name(d.display_name))) v(n)
  where n is not null and (coalesce(d.trade_only,false) = true or coalesce(d.is_published,false) = false);
$$;
revoke all on function public._hotspot_blocked_designer_names() from public;
grant execute on function public._hotspot_blocked_designer_names() to anon, authenticated;

drop policy if exists "Public can read hotspots for public content" on public.gallery_hotspots;
create policy "Public can read hotspots for public content" on public.gallery_hotspots
for select to anon, authenticated using (
  has_role(auth.uid(), 'admin'::app_role)
  or (
    _hotspot_mapped_pick_public(mapped_pick_id)
    and (designer_id is null or exists (
      select 1 from public.designers d where d.id = gallery_hotspots.designer_id
        and coalesce(d.is_published,false) = true and coalesce(d.trade_only,false) = false))
    and (designer_name is null
      or public._norm_designer_name(designer_name) is null
      or public._norm_designer_name(designer_name) <> all (coalesce((select public._hotspot_blocked_designer_names()), '{}'::text[])))
  )
);