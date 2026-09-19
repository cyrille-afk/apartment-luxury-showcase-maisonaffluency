update designer_curator_picks
set size_variants = (
  select jsonb_agg(jsonb_set(v, '{base}', to_jsonb(replace(v->>'base', 'Version ', 'Shape '))))
  from jsonb_array_elements(size_variants) v
)
where id = 'b5ca7ae6-fc77-4cde-9137-65bf0e24e9b7';

update trade_products
set size_variants = (
  select jsonb_agg(jsonb_set(v, '{base}', to_jsonb(replace(v->>'base', 'Version ', 'Shape '))))
  from jsonb_array_elements(size_variants) v
)
where id = '0531499b-00a5-4025-8abc-75947977e018';