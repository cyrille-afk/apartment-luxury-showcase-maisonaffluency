ALTER TABLE public.designer_curator_picks
  ADD COLUMN IF NOT EXISTS crate_specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hs_code_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS crate_specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hs_code_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.sync_pick_crate_specs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trade_products tp
  SET crate_specs   = NEW.crate_specs,
      hs_code_rules = NEW.hs_code_rules,
      updated_at    = now()
  WHERE tp.source_pick_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pick_crate_specs ON public.designer_curator_picks;
CREATE TRIGGER trg_sync_pick_crate_specs
AFTER INSERT OR UPDATE OF crate_specs, hs_code_rules ON public.designer_curator_picks
FOR EACH ROW EXECUTE FUNCTION public.sync_pick_crate_specs();