UPDATE public.fabrics SET category = 'Wood' WHERE category = 'Rattan';
UPDATE public.fabrics SET category = 'Glass' WHERE category = 'Other' AND name ILIKE '%glass%';