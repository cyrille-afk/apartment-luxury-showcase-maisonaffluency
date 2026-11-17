CREATE OR REPLACE FUNCTION public._shared_board_retail_price(_base bigint, _variants jsonb, _label text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
 WITH prices AS (
 SELECT v->>'label' AS label, (v->>'price_cents')::numeric AS cents
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_variants)='array' THEN _variants ELSE '[]'::jsonb END) v
 WHERE CASE WHEN v->>'price_cents' ~ '^[0-9]+([.][0-9]+)?$' THEN (v->>'price_cents')::numeric > 0 ELSE false END
 ), exact AS (SELECT min(cents) AS cents FROM prices WHERE lower(trim(label))=lower(trim(_label)) HAVING count(DISTINCT cents)=1)
 SELECT jsonb_build_object('cents',coalesce((SELECT cents FROM exact),CASE WHEN _base>0 THEN _base END,(SELECT min(cents) FROM prices)), 'from', NOT EXISTS(SELECT 1 FROM exact) AND coalesce(_base,0)<=0 AND EXISTS(SELECT 1 FROM prices));
$fn$;
REVOKE ALL ON FUNCTION public._shared_board_retail_price(bigint,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._shared_board_retail_price(bigint,jsonb,text) TO service_role;
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.get_shared_board(text)'::regprocedure) INTO definition;
 IF position('''msrp_cents'', coalesce(nullif(tp.trade_price_cents, 0), (' IN definition)=0 THEN RAISE EXCEPTION 'Shared board price projection changed; review before applying'; END IF;
 definition := replace(definition, '''msrp_cents'', coalesce(nullif(tp.trade_price_cents, 0), (', '''msrp_from'', coalesce((public._shared_board_retail_price(coalesce(nullif(tp.trade_price_cents,0),nullif(tp.rrp_price_cents,0)),tp.size_variants,bi.variant_label)->>''from'')::boolean,false),
      ''msrp_cents'', coalesce((public._shared_board_retail_price(coalesce(nullif(tp.trade_price_cents,0),nullif(tp.rrp_price_cents,0)),tp.size_variants,bi.variant_label)->>''cents'')::numeric, (');
 EXECUTE definition;
END $patch$;