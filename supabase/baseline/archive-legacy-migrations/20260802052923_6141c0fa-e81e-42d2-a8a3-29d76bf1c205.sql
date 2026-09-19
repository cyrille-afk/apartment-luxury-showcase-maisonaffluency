UPDATE public.fabrics
SET category = 'Fabric & Leather', updated_at = now()
WHERE lower(trim(category)) = 'shearling';