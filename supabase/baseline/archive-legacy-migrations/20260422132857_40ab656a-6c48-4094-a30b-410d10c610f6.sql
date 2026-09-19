ALTER TABLE public.designer_curator_picks
ADD COLUMN variant_placeholder text;

COMMENT ON COLUMN public.designer_curator_picks.variant_placeholder IS
'Custom placeholder text for the variant/material dropdown on this product (e.g. "Select your fabric choice"). When null, falls back to the default UI label.';