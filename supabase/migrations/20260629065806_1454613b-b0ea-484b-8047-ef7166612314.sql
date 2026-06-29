UPDATE public.designers
SET founder = NULL
WHERE slug IN ('adrien-messie','felix-aublet','felix-agostini','gounot-jahnke');

UPDATE public.designers
SET founder = NULL, name = 'Dagmar'
WHERE slug = 'dagmar-london';
