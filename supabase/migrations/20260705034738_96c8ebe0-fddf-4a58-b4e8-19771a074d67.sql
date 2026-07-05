CREATE OR REPLACE FUNCTION public.match_catalog_filtered(
  query_embedding vector,
  match_count integer DEFAULT 40,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  id uuid, source text, title text, designer text, materials text,
  category text, subcategory text, lead_time text, origin text,
  default_ship_mode text, currency text, trade_price_cents integer,
  price_prefix text, stock_status text, dimensions text,
  width_mm integer, depth_mm integer, height_mm integer,
  is_contract_grade boolean,
  similarity double precision, structural_fit double precision
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  f_category           text := nullif(filter->>'category','');
  f_subcategory        text := nullif(filter->>'subcategory','');
  f_designer           text := nullif(filter->>'designer','');
  f_max_lead_wks       int  := nullif(filter->>'max_lead_weeks','')::int;
  f_max_width_mm       int  := nullif(filter->>'max_width_mm','')::int;
  f_max_depth_mm       int  := nullif(filter->>'max_depth_mm','')::int;
  f_max_height_mm      int  := nullif(filter->>'max_height_mm','')::int;
  f_contract_only      boolean := coalesce((filter->>'contract_grade_only')::boolean, false);
  active_count         int  := (case when f_category is null then 0 else 1 end)
                             + (case when f_subcategory is null then 0 else 1 end)
                             + (case when f_designer is null then 0 else 1 end)
                             + (case when f_max_lead_wks is null then 0 else 1 end)
                             + (case when f_max_width_mm is null then 0 else 1 end)
                             + (case when f_max_depth_mm is null then 0 else 1 end)
                             + (case when f_max_height_mm is null then 0 else 1 end)
                             + (case when f_contract_only then 1 else 0 end);
  pool int := greatest(match_count * 4, 80);
begin
  return query
  with picks as (
    select
      p.id,
      'curator'::text as source,
      p.title,
      coalesce(d.display_name, d.name, 'Unknown') as designer,
      p.materials,
      p.category,
      p.subcategory,
      p.lead_time,
      NULL::smallint as lead_time_weeks_max,
      p.origin,
      p.default_ship_mode,
      p.currency,
      p.trade_price_cents,
      p.price_prefix,
      null::text as stock_status,
      p.dimensions,
      null::int as width_mm,
      null::int as depth_mm,
      null::int as height_mm,
      false as is_contract_grade,
      1 - (p.embedding <=> query_embedding) as similarity
    from public.designer_curator_picks p
    left join public.designers d on d.id = p.designer_id
    where p.embedding is not null
    order by p.embedding <=> query_embedding
    limit pool
  ),
  trades as (
    select
      t.id,
      'trade'::text as source,
      t.product_name as title,
      t.brand_name as designer,
      t.materials,
      t.category,
      t.subcategory,
      t.lead_time,
      t.lead_time_weeks_max,
      t.origin,
      t.default_ship_mode,
      t.currency,
      t.trade_price_cents,
      t.price_prefix,
      t.stock_status_override as stock_status,
      t.dimensions,
      t.width_mm,
      t.depth_mm,
      t.height_mm,
      coalesce(t.is_contract_grade, false) as is_contract_grade,
      1 - (t.embedding <=> query_embedding) as similarity
    from public.trade_products t
    where t.embedding is not null
      and t.is_active is true
      and coalesce(t.is_hidden, false) = false
    order by t.embedding <=> query_embedding
    limit pool
  ),
  unioned as (
    select * from picks
    union all
    select * from trades
  ),
  scored as (
    select
      u.*,
      case when active_count = 0 then 1.0::double precision else
        (
          (case when f_category    is not null and u.category    ilike '%'||f_category||'%'    then 1 else 0 end)
        + (case when f_subcategory is not null and u.subcategory ilike '%'||f_subcategory||'%' then 1 else 0 end)
        + (case when f_designer    is not null and u.designer    ilike '%'||f_designer||'%'    then 1 else 0 end)
        + (case
             when f_max_lead_wks is null then 0
             when u.lead_time_weeks_max is not null then
               case when u.lead_time_weeks_max <= f_max_lead_wks then 1 else 0 end
             when u.lead_time is null then 0
             else case
               when (regexp_match(u.lead_time,'(\d+)\s*(?:-|–|to)\s*(\d+)'))[2]::int <= f_max_lead_wks then 1
               when (regexp_match(u.lead_time,'(\d+)'))[1]::int <= f_max_lead_wks then 1
               else 0
             end
           end)
        + (case when f_max_width_mm  is not null and u.width_mm  is not null and u.width_mm  <= f_max_width_mm  then 1 else 0 end)
        + (case when f_max_depth_mm  is not null and u.depth_mm  is not null and u.depth_mm  <= f_max_depth_mm  then 1 else 0 end)
        + (case when f_max_height_mm is not null and u.height_mm is not null and u.height_mm <= f_max_height_mm then 1 else 0 end)
        + (case when f_contract_only and u.is_contract_grade then 1 else 0 end)
        )::double precision / active_count
      end as structural_fit_raw
    from unioned u
  )
  select
    s.id, s.source, s.title, s.designer, s.materials, s.category, s.subcategory,
    s.lead_time, s.origin, s.default_ship_mode, s.currency, s.trade_price_cents,
    s.price_prefix, s.stock_status, s.dimensions,
    s.width_mm, s.depth_mm, s.height_mm, s.is_contract_grade,
    s.similarity,
    s.structural_fit_raw as structural_fit
  from scored s
  where
    (f_category    is null or s.category    ilike '%'||f_category||'%')
    and (f_subcategory is null or s.subcategory ilike '%'||f_subcategory||'%')
    and (f_designer    is null or s.designer    ilike '%'||f_designer||'%')
    and (f_max_width_mm  is null or s.width_mm  is null or s.width_mm  <= f_max_width_mm)
    and (f_max_depth_mm  is null or s.depth_mm  is null or s.depth_mm  <= f_max_depth_mm)
    and (f_max_height_mm is null or s.height_mm is null or s.height_mm <= f_max_height_mm)
    and (not f_contract_only or s.is_contract_grade)
  order by (0.7 * s.similarity + 0.3 * s.structural_fit_raw) desc
  limit match_count;
end;
$function$;