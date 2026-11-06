-- Before independent product publishing, the maker-level Trade Only flag hid
-- these rows even when their product flag retained the old public default.
-- Preserve the visibility visitors actually had: only the four products with
-- explicit public exception policies remain public under a Trade Only maker.
UPDATE public.designer_curator_picks p
SET trade_only = true
FROM public.designers d
WHERE d.id = p.designer_id
  AND d.is_published = true
  AND d.trade_only = true
  AND p.trade_only = false
  AND p.id NOT IN (
    '4b46af75-4c35-4a81-bea6-822810ae3422'::uuid,
    '11179934-a17e-4d81-9f49-b84c19b43a4a'::uuid,
    '6f7996bc-a985-45ec-8c31-bf97c4a71dd4'::uuid,
    'b0578007-d436-4fac-866f-1964b459942a'::uuid
  );