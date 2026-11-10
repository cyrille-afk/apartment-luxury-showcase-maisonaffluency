DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.get_shared_board(text)'::regprocedure) INTO definition;
  IF strpos(definition, '''designer_name''') = 0 THEN
    definition := replace(definition, '''image_url'', tp.image_url,', '''image_url'', tp.image_url,
       ''designer_name'', coalesce(nullif(d.display_name, ''''), d.name),
       ''brand_name'', tp.brand_name,
       ''house_name'', CASE WHEN EXISTS (SELECT 1 FROM public.designers house WHERE lower(trim(house.name)) = lower(trim(d.founder))) THEN d.founder ELSE NULL END,
       ''edition'', p.edition,
       ''edition_number'', p.edition_number,
       ''edition_signing'', p.edition_signing,');
    definition := replace(definition, 'WHERE bi.board_id = b.id;', 'LEFT JOIN LATERAL (
      SELECT pick.* FROM public.designer_curator_picks pick
      WHERE pick.id = tp.source_pick_id OR (tp.source_pick_id IS NULL AND trim(pick.title) = trim(tp.product_name)
        AND (SELECT count(*) FROM public.designer_curator_picks candidate WHERE trim(candidate.title) = trim(tp.product_name)) = 1)
      ORDER BY (pick.id = tp.source_pick_id) DESC NULLS LAST LIMIT 1
    ) p ON true
    LEFT JOIN public.designers d ON d.id = p.designer_id
    WHERE bi.board_id = b.id;');
    IF strpos(definition, '''designer_name''') = 0 OR strpos(definition, 'd.id = p.designer_id') = 0 THEN RAISE EXCEPTION 'Shared board definition did not match expected attribution boundary'; END IF;
    EXECUTE definition;
  END IF;
END $migration$;