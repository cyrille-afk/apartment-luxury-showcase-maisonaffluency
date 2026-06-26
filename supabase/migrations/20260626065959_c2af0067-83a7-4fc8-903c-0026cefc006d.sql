-- 1. Delete the duplicate "for MSE" picks under Lazzarini & Pickering
DELETE FROM public.designer_curator_picks
WHERE designer_id = 'c9d289d6-5b47-4305-94b1-799f9b3f1f9a';

-- 2. Move MSE parent's picks to the actual sub-designer (Herzog rows first)
UPDATE public.designer_curator_picks
SET designer_id = '8e55ccf4-e847-46f8-9536-891592b481f6'
WHERE designer_id = 'bccc53bd-69e3-4e38-9f8d-34d3a4d65483'
  AND title ~* '(Herzog|Demeuron|de Meuron)';

-- Remaining MSE parent picks belong to Lazzarini & Pickering
UPDATE public.designer_curator_picks
SET designer_id = 'c9d289d6-5b47-4305-94b1-799f9b3f1f9a'
WHERE designer_id = 'bccc53bd-69e3-4e38-9f8d-34d3a4d65483';

-- 3. Strip attribution suffixes so titles read like Ecart sub-designers
UPDATE public.designer_curator_picks
SET title = btrim(regexp_replace(
  title,
  '\s+(?:by|for)\s+(?:Lazzarini\s*&?\s*Pickering|MSE|Herzog\s*&\s*De?\s*[Mm]euron)\s*$',
  '', 'i'))
WHERE designer_id IN (
  'c9d289d6-5b47-4305-94b1-799f9b3f1f9a',
  '8e55ccf4-e847-46f8-9536-891592b481f6'
);

UPDATE public.designer_curator_picks
SET title = btrim(regexp_replace(
  title,
  '\s+Herzog\s*&\s*De?\s*[Mm]euron\s*$',
  '', 'i'))
WHERE designer_id = '8e55ccf4-e847-46f8-9536-891592b481f6';

-- 4. Tag them as "Edition" so the cards show an EDITION badge (not Re-edition)
UPDATE public.designer_curator_picks
SET tags = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || ARRAY['Edition']))
)
WHERE designer_id IN (
  'c9d289d6-5b47-4305-94b1-799f9b3f1f9a',
  '8e55ccf4-e847-46f8-9536-891592b481f6'
);