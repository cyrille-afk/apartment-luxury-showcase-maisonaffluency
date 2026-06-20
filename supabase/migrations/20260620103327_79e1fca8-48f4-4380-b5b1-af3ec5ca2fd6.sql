ALTER TABLE public.gallery_hotspots
ADD COLUMN IF NOT EXISTS mapped_pick_id uuid REFERENCES public.designer_curator_picks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gallery_hotspots_mapped_pick_id_idx
ON public.gallery_hotspots(mapped_pick_id);

COMMENT ON COLUMN public.gallery_hotspots.mapped_pick_id IS
'Optional manual override: when set, View Product opens this curator pick directly instead of fuzzy-matching by product/designer name.';