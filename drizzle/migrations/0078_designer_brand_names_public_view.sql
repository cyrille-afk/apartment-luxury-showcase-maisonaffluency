-- Public, name-only roster of every published designer/house (including
-- trade-only houses such as "Sé Collections"). Used purely to decide whether a
-- child designer's `founder` value names an actual house (brand attribution
-- line) or a human founder. Exposes nothing but the display name.
create or replace view public.designer_brand_names
with (security_invoker = off) as
select d.name, d.display_name, d.slug, d.trade_only
from public.designers d
where d.is_published = true;

grant select on public.designer_brand_names to anon, authenticated;
grant all on public.designer_brand_names to service_role;