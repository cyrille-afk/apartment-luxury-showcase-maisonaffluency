UPDATE public.fabrics
SET description = 'Dagmar upholstery/finish option — mill: ' || COALESCE(supplier, 'n/a'),
    supplier = 'Dagmar',
    updated_at = now()
WHERE created_at > now() - interval '2 days'
  AND description = 'Dagmar upholstery/finish option'
  AND supplier IS DISTINCT FROM 'Dagmar';