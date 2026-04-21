-- Merge "Okha Design Studio - Adam Courts" (child) into "OKHA" (parent), then remove the child.
-- Move curator picks
UPDATE public.designer_curator_picks
SET designer_id = '908c1661-0661-41ef-b3b4-14adbe6636ef'
WHERE designer_id = '3d5dee04-9e89-4ffa-841d-7bbb869a3b61';

-- Move instagram posts
UPDATE public.designer_instagram_posts
SET designer_id = '908c1661-0661-41ef-b3b4-14adbe6636ef'
WHERE designer_id = '3d5dee04-9e89-4ffa-841d-7bbb869a3b61';

-- Promote OKHA record with founder attribution + display fields preserved from parent
UPDATE public.designers
SET founder = COALESCE(NULLIF(founder, ''), 'Adam Courts'),
    display_name = COALESCE(NULLIF(display_name, ''), 'OKHA')
WHERE id = '908c1661-0661-41ef-b3b4-14adbe6636ef';

-- Delete the child "Adam Courts" designer record
DELETE FROM public.designers
WHERE id = '3d5dee04-9e89-4ffa-841d-7bbb869a3b61';