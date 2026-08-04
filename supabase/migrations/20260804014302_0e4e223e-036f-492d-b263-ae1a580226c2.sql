update designer_curator_picks
set size_variants = (
  select jsonb_agg(
    v || jsonb_build_object('base', regexp_replace(regexp_replace(v->>'base', 'SI LVER','SILVER'), 'L ACQUERED','LACQUERED'))
    order by ord
  )
  from jsonb_array_elements(size_variants::jsonb) with ordinality t(v, ord)
)
where id in ('c3bf8200-deec-4b67-9504-7467a6392549','981c2e49-96b2-4fdb-949d-f1a6606f6227');

update designer_curator_picks
set size_variants = (
  select jsonb_agg(
    v || jsonb_build_object('base', regexp_replace(regexp_replace(v->>'base', 'BRAS S','BRASS'), 'BL ACKENED','BLACKENED'))
    order by ord
  )
  from jsonb_array_elements(size_variants::jsonb) with ordinality t(v, ord)
)
where id = 'c3bf8200-deec-4b67-9504-7467a6392549';