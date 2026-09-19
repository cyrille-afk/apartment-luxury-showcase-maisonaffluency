UPDATE public.designers
SET founder = NULL
WHERE slug IN (
  'leo-aerts-alinea',
  'alpange',
  'apparatus-studio',
  'atelier-demichelis'
)
AND founder = name;