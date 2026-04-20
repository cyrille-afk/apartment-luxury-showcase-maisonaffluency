UPDATE public.designers 
SET name = 'Alinea Design Objects',
    instagram_handle = NULL
WHERE slug = 'leo-aerts-alinea';

-- Also update any brand normalization references if needed
-- Update founder references if any designers have this as founder
UPDATE public.designers 
SET founder = 'Alinea Design Objects'
WHERE founder = 'Alinéa Design Objects' OR founder = 'Alinea Design Objects';