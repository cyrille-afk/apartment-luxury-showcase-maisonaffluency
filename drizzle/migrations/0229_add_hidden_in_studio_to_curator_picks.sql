ALTER TABLE public.designer_curator_picks
  ADD COLUMN hidden_in_studio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.designer_curator_picks.hidden_in_studio IS 'When true, the piece is hidden from Studio Mode trade surfaces (Trade Gallery grids and designer Studio Mode pages) while remaining visible in Presentation Mode and public pages.';