-- Trade tier enum
DO $$ BEGIN
  CREATE TYPE public.trade_tier AS ENUM ('standard', 'silver', 'gold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add tier column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trade_tier public.trade_tier NOT NULL DEFAULT 'standard';

-- Helper: discount percentage for a tier (returns numeric like 0.08, 0.12, 0.18)
CREATE OR REPLACE FUNCTION public.tier_discount_pct(_tier public.trade_tier)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _tier
    WHEN 'gold'     THEN 0.18
    WHEN 'silver'   THEN 0.12
    ELSE 0.08
  END;
$$;

-- Helper: get current user's discount percentage (defaults to 0.08 if no profile)
CREATE OR REPLACE FUNCTION public.current_trade_discount_pct()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.tier_discount_pct((SELECT trade_tier FROM public.profiles WHERE id = auth.uid())),
    0.08
  );
$$;

-- Allow admins to update tier (profiles already has admin policies in most setups; ensure UPDATE works)
DO $$ BEGIN
  CREATE POLICY "Admins can update profile tier"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;