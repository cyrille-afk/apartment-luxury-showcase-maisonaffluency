
UPDATE public.designers
SET founder = name
WHERE slug IN ('collection-particuliere','delcourt-collection','galerie-mcde','haymann-editions','mmairo','pouenat','se-collections','theoreme-editions')
AND (founder IS NULL OR founder != name);
