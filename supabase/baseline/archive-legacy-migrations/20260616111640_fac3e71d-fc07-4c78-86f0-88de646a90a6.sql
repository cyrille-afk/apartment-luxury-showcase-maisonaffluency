
-- Repoint Rodeo's link to the kept swatch (b219da75)
UPDATE public.product_fabrics
SET fabric_id = 'b219da75-167d-49fd-9776-5c0b472b49c9'
WHERE id = 'e8cd4c91-8b47-4182-bb92-e8ad2bb3ecf3';

-- Delete the now-orphaned duplicate fabric
DELETE FROM public.fabrics
WHERE id = '6d8f2dd0-4b06-4c02-92cc-176501e31411';
