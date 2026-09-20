-- Extend designer_curator_picks with shipping/crating metrics
ALTER TABLE public.designer_curator_picks
ADD COLUMN IF NOT EXISTS weight_kg numeric,
ADD COLUMN IF NOT EXISTS crated_width_mm integer,
ADD COLUMN IF NOT EXISTS crated_depth_mm integer,
ADD COLUMN IF NOT EXISTS crated_height_mm integer,
ADD COLUMN IF NOT EXISTS requires_white_glove boolean DEFAULT false;

-- Extend trade_credit_profiles with international tax exemption records
ALTER TABLE public.trade_credit_profiles
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS vat_valid_status boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_company_name text,
ADD COLUMN IF NOT EXISTS vat_last_checked_at timestamp with time zone;

-- Dedicated trade VAT/tax identity profile table
CREATE TABLE IF NOT EXISTS public.trade_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vat_number text,
    vat_valid_status boolean DEFAULT false,
    vat_company_name text,
    vat_last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_profiles TO authenticated;
GRANT ALL ON public.trade_profiles TO service_role;

ALTER TABLE public.trade_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade profile"
  ON public.trade_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trade profile"
  ON public.trade_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trade profile"
  ON public.trade_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all trade profiles"
  ON public.trade_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.set_trade_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_trade_profiles_updated_at ON public.trade_profiles;
CREATE TRIGGER set_trade_profiles_updated_at
BEFORE UPDATE ON public.trade_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_trade_profiles_updated_at();