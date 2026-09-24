CREATE OR REPLACE FUNCTION public.catalog_material_terms()
RETURNS TABLE(term text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH corpus AS (
    SELECT lower(string_agg(concat_ws(' ', description, materials, materials_description), ' ')) AS txt
    FROM (
      SELECT description, materials, materials_description FROM public.trade_products
      UNION ALL
      SELECT description, materials, materials_description FROM public.designer_curator_picks
    ) s
  ),
  vocab AS (
    SELECT name AS t FROM public.material_taxonomy WHERE is_active
    UNION SELECT unnest(synonyms) FROM public.material_taxonomy WHERE is_active
    UNION SELECT unnest(ARRAY['Cast Iron','Wrought Iron','Patinated Brass','Brushed Brass','Polished Brass','Blackened Steel','Burl','Walnut Burl','Oak Veneer','Straw Marquetry','Mother of Pearl','Horn','Shagreen','Raffia','Cane','Wicker','Jute','Sisal','Mohair Velvet','Lava Stone','Sandstone','Quartzite','Bronze Patina','Gold Leaf','Silver Leaf','Brass Inlay','Paper Cord','Cork','Terracotta','Stoneware','Enamel','Pewter','Nickel','Chrome','Acrylic','Lucite','Fiberglass','Concrete'])
  )
  SELECT DISTINCT ON (lower(trim(v.t))) trim(v.t)
  FROM vocab v, corpus c
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
    AND length(trim(v.t)) > 2
    AND position(lower(trim(v.t)) in c.txt) > 0
  ORDER BY lower(trim(v.t));
$$;
REVOKE ALL ON FUNCTION public.catalog_material_terms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_material_terms() TO authenticated, service_role;