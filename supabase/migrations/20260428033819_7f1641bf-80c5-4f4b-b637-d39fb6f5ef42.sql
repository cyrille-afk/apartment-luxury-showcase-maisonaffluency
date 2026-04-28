
-- Fix miscategorized lighting curator picks based on subtitle/tags

-- Pendant → Ceiling Lights
UPDATE public.designer_curator_picks
SET subcategory = 'Ceiling Lights'
WHERE id = 'dbe2ca2d-3ba1-4e66-a7f6-1bbc1ca8af4e'; -- Autumn Light (Pendant)

-- Wall Lamps → Wall Lights
UPDATE public.designer_curator_picks
SET subcategory = 'Wall Lights'
WHERE id IN (
  '23b8c7c4-c0f3-456a-8623-87fe16c55ced', -- BEAM 800
  'd8cfb5a0-cb74-48e0-a7ed-7c244b4f2717', -- Ghost
  '0bb3ff82-2eab-4a40-bf26-55a4c17013de', -- Ghost (dup)
  '9920c3d6-3967-482b-bb8f-a07a631b3082', -- Toast
  'd0e5288e-3ea5-4f38-918e-2d9f3df06996', -- Toast (dup)
  'f23a6275-a6ad-402a-8fae-2298b6ecace4', -- BRAUN 650
  'a3f24a87-5f96-43e0-99ec-b51d7fdca0c4', -- BRAUN 650 (dup)
  '7794fedc-18ad-4b35-a769-fe1b4d37921b', -- MARTEL
  '8cc918f0-64af-4366-a4ba-612caa262be8', -- MARTEL (dup)
  'c62def48-2615-4374-b267-ccdcd1720c98'  -- BEAM 800 (dup)
);

-- Floor Lamp → Floor Lights
UPDATE public.designer_curator_picks
SET subcategory = 'Floor Lights'
WHERE id = '1cf020cf-8d02-48e6-a820-4e46bf8e6908'; -- Metronome (Reading Floor Lamp)

-- BRASILIA LP — subtitle is brand only; tags include "Floor Lamp" — keep as Floor Lights
UPDATE public.designer_curator_picks
SET subcategory = 'Floor Lights'
WHERE id = '794ee19a-5e49-417a-a4f4-8c370d0dd017'; -- BRASILIA LP

-- Sonde (Table Lamp) wrongly in Ceiling Lights → Table Lights
UPDATE public.designer_curator_picks
SET subcategory = 'Table Lights'
WHERE id = '17c71fd2-417d-46b3-bffd-4d3e716cefbf'; -- Sonde
