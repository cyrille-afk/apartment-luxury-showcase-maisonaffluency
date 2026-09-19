
ALTER TABLE public.product_fabrics ALTER COLUMN pick_id DROP NOT NULL;
ALTER TABLE public.product_fabrics ADD COLUMN IF NOT EXISTS product_label text;
ALTER TABLE public.product_fabrics DROP CONSTRAINT IF EXISTS product_fabrics_pick_id_fabric_id_key;
ALTER TABLE public.product_fabrics DROP CONSTRAINT IF EXISTS product_fabrics_pick_fabric_uq;
ALTER TABLE public.product_fabrics ADD CONSTRAINT product_fabrics_pick_fabric_uq UNIQUE (pick_id, fabric_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_fabrics_label_fabric_uq
  ON public.product_fabrics (product_label, fabric_id) WHERE product_label IS NOT NULL;
ALTER TABLE public.product_fabrics DROP CONSTRAINT IF EXISTS product_fabrics_target_chk;
ALTER TABLE public.product_fabrics ADD CONSTRAINT product_fabrics_target_chk
  CHECK (pick_id IS NOT NULL OR product_label IS NOT NULL);

-- Patch the public swatch materialization to skip free-text product rows.
CREATE OR REPLACE FUNCTION public.refresh_product_fabric_swatches_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  TRUNCATE TABLE public.product_fabric_swatches_public;

  INSERT INTO public.product_fabric_swatches_public (
    pick_id, fabric_id, sort_order, price_tier_label, image_indices,
    name, image_url, category, supplier, is_active, updated_at
  )
  SELECT
    pf.pick_id, pf.fabric_id, pf.sort_order, pf.price_tier_label, pf.image_indices,
    f.name, f.image_url, f.category, f.supplier, f.is_active, now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true
    AND pf.pick_id IS NOT NULL;

  RETURN NULL;
END;
$function$;

WITH pf(pick_id, product_label, fabric_id, tier) AS (
  VALUES
  ('9baeef6c-d0fa-4789-ac9d-2703209486dd'::uuid, NULL::text, '3c9a7bfb-7707-4cc4-8cd0-c9d42a31e146'::uuid, 'B'),
  ('b1534548-cba8-4df4-b6fb-616f802b7bd2', NULL, '8eb18f42-854e-41b0-a0e5-c39d93cd3577', 'C'),
  ('1b6a0347-30e3-41e0-a464-5cc998bf6ce6', NULL, '59ebfb7a-9aba-42ad-bd3a-704b0c5fd7dd', 'A'),
  ('1b6a0347-30e3-41e0-a464-5cc998bf6ce6', NULL, 'c1884064-6e0b-401e-bc63-8dd66fe80ed3', 'B'),
  ('1b6a0347-30e3-41e0-a464-5cc998bf6ce6', NULL, '497ae3f7-70cb-4018-882f-3029cef6c12e', 'C'),
  ('1b6a0347-30e3-41e0-a464-5cc998bf6ce6', NULL, '23d9dde3-55df-4645-9098-192bc90a89d6', 'C'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, '59ebfb7a-9aba-42ad-bd3a-704b0c5fd7dd', 'A'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, '162d9eea-b745-49c6-b57c-977c7cc2fe97', 'C'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, 'e55bd34c-533d-420f-9dae-8621fb900737', 'C'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, 'f12a985b-698b-46a4-bb1e-93c41b946106', 'C'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, '05237325-87ef-4fb6-b6c7-4e5a691d7659', 'C'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, '58b783d1-052f-4dfb-985e-0f620b57edd8', 'D'),
  ('0d33b077-dc1a-4aed-bc8e-86dd2884b2dd', NULL, '74dcdc97-589a-4d2f-bbdc-454979a2ca3a', 'D'),
  ('fc3a68b1-65cd-4d6f-941c-b8a2451dd064', NULL, '85e37594-f1cd-4528-8169-5c9f34d30110', 'B'),
  ('fc3a68b1-65cd-4d6f-941c-b8a2451dd064', NULL, 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),
  ('1547d5cf-ccf4-4ea5-b28a-40cedea1d6c2', NULL, '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  ('1547d5cf-ccf4-4ea5-b28a-40cedea1d6c2', NULL, '3b9208f3-4947-4491-a910-e3967b13af7c', 'B'),
  ('1547d5cf-ccf4-4ea5-b28a-40cedea1d6c2', NULL, '47f5ab96-560b-47ec-9abe-338638c19a70', 'B'),
  ('93a2dd5e-44fe-452b-973a-8ed75eb4784d', NULL, '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  ('93a2dd5e-44fe-452b-973a-8ed75eb4784d', NULL, '3b9208f3-4947-4491-a910-e3967b13af7c', 'B'),
  ('93a2dd5e-44fe-452b-973a-8ed75eb4784d', NULL, '47f5ab96-560b-47ec-9abe-338638c19a70', 'B'),

  (NULL, 'Upholstered Back Sofa c. 1924 (2 seater)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Upholstered Back Sofa c. 1924 (2 seater)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Upholstered Back Sofa c. 1924 (2 seater)', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Upholstered Back Sofa c. 1924 (2 seater)', 'f67d3ee2-b69a-4a66-9cb6-247b734766d0', 'D'),
  (NULL, 'Upholstered Back Sofa c. 1924 (2 seater)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Upholstered Back Sofa c. 1924 (3 seater)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Upholstered Back Sofa c. 1924 (3 seater)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Upholstered Back Sofa c. 1924 (3 seater)', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Upholstered Back Sofa c. 1924 (3 seater)', 'f67d3ee2-b69a-4a66-9cb6-247b734766d0', 'D'),
  (NULL, 'Upholstered Back Sofa c. 1924 (3 seater)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Club Sofa c. 1930 (2 seater)', '882e6187-5146-4ea0-a8e3-afc4143a581f', 'A'),
  (NULL, 'Club Sofa c. 1930 (2 seater)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Club Sofa c. 1930 (2 seater)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Club Sofa c. 1930 (2 seater)', 'c63d9a68-b8ff-47c7-903c-d0beb2b6bb9e', 'B'),
  (NULL, 'Club Sofa c. 1930 (2 seater)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Club Sofa c. 1930 (3 seater)', '882e6187-5146-4ea0-a8e3-afc4143a581f', 'A'),
  (NULL, 'Club Sofa c. 1930 (3 seater)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Club Sofa c. 1930 (3 seater)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Club Sofa c. 1930 (3 seater)', 'c63d9a68-b8ff-47c7-903c-d0beb2b6bb9e', 'B'),
  (NULL, 'Club Sofa c. 1930 (3 seater)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Bergere c. 1924', 'ccb06b71-66c7-4b1d-a240-4e81f901d30f', 'A'),
  (NULL, 'Bergere c. 1924', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),
  (NULL, 'Bergere c. 1924', '838c4cee-7bac-49c5-a292-bc1b53b9da47', 'B'),
  (NULL, 'Bergere c. 1924', '26a1cda7-9cef-4d3a-a16a-1089324b71e6', 'B'),

  (NULL, 'Rattan Bergere c. 1925', '58c3f225-a0cc-408a-9abe-15b1e44207bf', 'A'),
  (NULL, 'Rattan Bergere c. 1925', 'ccb06b71-66c7-4b1d-a240-4e81f901d30f', 'A'),
  (NULL, 'Rattan Bergere c. 1925', 'b544f1d2-d482-462f-be03-163d70ab08ad', 'A'),
  (NULL, 'Rattan Bergere c. 1925', '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  (NULL, 'Rattan Bergere c. 1925', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),

  (NULL, 'Club Armchair c. 1930', '882e6187-5146-4ea0-a8e3-afc4143a581f', 'A'),
  (NULL, 'Club Armchair c. 1930', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Club Armchair c. 1930', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Club Armchair c. 1930', 'c63d9a68-b8ff-47c7-903c-d0beb2b6bb9e', 'B'),
  (NULL, 'Club Armchair c. 1930', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Upholstered Back Armchair c. 1923 (Small)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Small)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Small)', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Small)', 'f67d3ee2-b69a-4a66-9cb6-247b734766d0', 'D'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Small)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Upholstered Back Armchair c. 1923 (Large)', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Large)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Large)', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Large)', 'f67d3ee2-b69a-4a66-9cb6-247b734766d0', 'D'),
  (NULL, 'Upholstered Back Armchair c. 1923 (Large)', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Cube Armchair c. 1922', '621e1cfc-9759-4084-9623-e3f12bd283f8', 'A'),
  (NULL, 'Cube Armchair c. 1922', '2097d5d8-bde2-4771-bb1a-1c4623a5944e', 'D'),
  (NULL, 'Cube Armchair c. 1922', 'e2dbff30-b7e6-44aa-9e79-7fdf1fb4206d', 'D'),
  (NULL, 'Cube Armchair c. 1922', '82154ca9-38a0-43e8-9526-19f24c7b08c0', 'E'),
  (NULL, 'Cube Armchair c. 1922', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Club Ottoman c. 1930', '882e6187-5146-4ea0-a8e3-afc4143a581f', 'A'),
  (NULL, 'Club Ottoman c. 1930', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Club Ottoman c. 1930', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Club Ottoman c. 1930', 'c63d9a68-b8ff-47c7-903c-d0beb2b6bb9e', 'B'),
  (NULL, 'Club Ottoman c. 1930', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Ottoman c. 1925', '24dcf677-9a00-4826-a5e2-7eb29fc761f7', 'A'),
  (NULL, 'Ottoman c. 1925', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Ottoman c. 1925', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Ottoman c. 1925', 'f67d3ee2-b69a-4a66-9cb6-247b734766d0', 'D'),
  (NULL, 'Ottoman c. 1925', 'f5af3d6e-7ff3-421d-afcb-4e150277f429', 'E'),

  (NULL, 'Rattan Chair c. 1925', '58c3f225-a0cc-408a-9abe-15b1e44207bf', 'A'),
  (NULL, 'Rattan Chair c. 1925', 'ccb06b71-66c7-4b1d-a240-4e81f901d30f', 'A'),
  (NULL, 'Rattan Chair c. 1925', 'b544f1d2-d482-462f-be03-163d70ab08ad', 'A'),
  (NULL, 'Rattan Chair c. 1925', '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  (NULL, 'Rattan Chair c. 1925', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),

  (NULL, 'Chair c. 1930', 'f200a220-8f3e-4ba7-aad5-e6830e1aeb29', 'B'),
  (NULL, 'Chair c. 1930', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Chair c. 1930', '31fd4905-164e-4331-87ff-451bde86adbe', 'B'),
  (NULL, 'Chair c. 1930', '838c4cee-7bac-49c5-a292-bc1b53b9da47', 'B'),
  (NULL, 'Chair c. 1930', '85e37594-f1cd-4528-8169-5c9f34d30110', 'B'),
  (NULL, 'Chair c. 1930', 'dc243909-4f33-4fdf-b0be-d4b7b33099e2', 'D'),

  (NULL, 'Upholstered Chair c. 1925', 'f200a220-8f3e-4ba7-aad5-e6830e1aeb29', 'B'),
  (NULL, 'Upholstered Chair c. 1925', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'Upholstered Chair c. 1925', '31fd4905-164e-4331-87ff-451bde86adbe', 'B'),
  (NULL, 'Upholstered Chair c. 1925', '838c4cee-7bac-49c5-a292-bc1b53b9da47', 'B'),
  (NULL, 'Upholstered Chair c. 1925', '85e37594-f1cd-4528-8169-5c9f34d30110', 'B'),
  (NULL, 'Upholstered Chair c. 1925', 'dc243909-4f33-4fdf-b0be-d4b7b33099e2', 'D'),

  (NULL, 'Bridge c. 1935', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Bridge c. 1935', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),
  (NULL, 'Bridge c. 1935', '31fd4905-164e-4331-87ff-451bde86adbe', 'B'),

  (NULL, 'Upholstered Bridge c. 1924', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'Upholstered Bridge c. 1924', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),
  (NULL, 'Upholstered Bridge c. 1924', '31fd4905-164e-4331-87ff-451bde86adbe', 'B'),

  (NULL, 'Rattan Bridge c. 1925', '58c3f225-a0cc-408a-9abe-15b1e44207bf', 'A'),
  (NULL, 'Rattan Bridge c. 1925', 'ccb06b71-66c7-4b1d-a240-4e81f901d30f', 'A'),
  (NULL, 'Rattan Bridge c. 1925', 'b544f1d2-d482-462f-be03-163d70ab08ad', 'A'),
  (NULL, 'Rattan Bridge c. 1925', '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  (NULL, 'Rattan Bridge c. 1925', '1f16ccb8-158e-462d-8c9d-38d42700f97c', 'A'),

  (NULL, 'X Stool (Round) c. 1930', '47f5ab96-560b-47ec-9abe-338638c19a70', 'B'),
  (NULL, 'X Stool (Round) c. 1930', '951d689d-17ee-494d-9207-447eb7de8156', 'B'),
  (NULL, 'X Stool (Round) c. 1930', '1ea43144-c359-4e36-9e6f-e7f2be190dfd', 'B'),
  (NULL, 'X Stool (Round) c. 1930', 'f8e853a6-31e3-41fa-9cd3-338d5e8ca9f7', 'B'),

  (NULL, 'X Stool (Square) c. 1930', '47f5ab96-560b-47ec-9abe-338638c19a70', 'B'),
  (NULL, 'X Stool (Square) c. 1930', '951d689d-17ee-494d-9207-447eb7de8156', 'B'),
  (NULL, 'X Stool (Square) c. 1930', '1ea43144-c359-4e36-9e6f-e7f2be190dfd', 'B'),
  (NULL, 'X Stool (Square) c. 1930', 'f8e853a6-31e3-41fa-9cd3-338d5e8ca9f7', 'B'),

  (NULL, 'W Armchair c. 1990', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'W Armchair c. 1990', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'W Armchair c. 1990', 'e2dbff30-b7e6-44aa-9e79-7fdf1fb4206d', 'D'),

  (NULL, 'W Sofa c. 1998 (2 seater)', '2b0e25e7-04d1-4906-b4be-14ba01ffe9f0', 'A'),
  (NULL, 'W Sofa c. 1998 (2 seater)', '18467dbb-65b8-4fcd-a801-4dd960c37b51', 'B'),
  (NULL, 'W Sofa c. 1998 (2 seater)', 'e2dbff30-b7e6-44aa-9e79-7fdf1fb4206d', 'D'),

  (NULL, 'Genève Bridge', '2a2fc297-7abe-4397-a893-161885cc4130', 'A'),
  (NULL, 'Genève Bridge', '47f5ab96-560b-47ec-9abe-338638c19a70', 'B'),
  (NULL, 'Genève Bridge', '838c4cee-7bac-49c5-a292-bc1b53b9da47', 'B')
)
INSERT INTO public.product_fabrics (pick_id, product_label, fabric_id, price_tier_label, sort_order)
SELECT pick_id, product_label, fabric_id, 'CAT ' || tier, 0
FROM pf
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_fabrics x
  WHERE x.fabric_id = pf.fabric_id
    AND ((pf.pick_id IS NOT NULL AND x.pick_id IS NOT DISTINCT FROM pf.pick_id)
      OR (pf.product_label IS NOT NULL AND x.product_label IS NOT DISTINCT FROM pf.product_label))
);
