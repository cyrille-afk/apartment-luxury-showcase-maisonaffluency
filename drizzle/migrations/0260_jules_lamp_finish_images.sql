-- Jules Lamp (Michel Amar Studio): isolated finish fabrics with the new uploaded images.
-- Both source fabrics (Black Patinated Bronze, Alabaster) are shared by EZE Suspension,
-- Kisseh Stool and Coba Sconce, so create Jules-only rows instead of editing shared rows.
INSERT INTO public.fabrics (id, name, category, supplier, sort_order, is_active, currency, image_url)
VALUES
  (gen_random_uuid(), 'Black Patinated Bronze', 'Metal', 'Michel Amar Studio', 1, true, 'EUR', 'https://res.cloudinary.com/dif1oamtj/image/upload/v1793710800/finishes/michel-amar/jules-black-patina-bronze-20261103.png'),
  (gen_random_uuid(), 'Alabaster', 'Stone', 'Michel Amar', 1, true, 'EUR', 'https://res.cloudinary.com/dif1oamtj/image/upload/v1793710801/finishes/michel-amar/jules-white-alabaster-20261103.jpg');

UPDATE public.product_fabrics
SET fabric_id = (SELECT f.id FROM public.fabrics f WHERE f.image_url = 'https://res.cloudinary.com/dif1oamtj/image/upload/v1793710800/finishes/michel-amar/jules-black-patina-bronze-20261103.png')
WHERE pick_id = '7905ce6d-71e6-49ab-a0ab-f8c930a46917'
  AND fabric_id = '8fd1f6b3-9c76-4292-8d56-a3923813390e';

UPDATE public.product_fabrics
SET fabric_id = (SELECT f.id FROM public.fabrics f WHERE f.image_url = 'https://res.cloudinary.com/dif1oamtj/image/upload/v1793710801/finishes/michel-amar/jules-white-alabaster-20261103.jpg')
WHERE pick_id = '7905ce6d-71e6-49ab-a0ab-f8c930a46917'
  AND fabric_id = '6b2bb5e6-119a-4f2c-9060-4390b4b62a1a';