
-- ============ Favorite folders ============
CREATE TABLE public.favorite_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_favorite_folders_user ON public.favorite_folders(user_id);
ALTER TABLE public.favorite_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read folders" ON public.favorite_folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner insert folders" ON public.favorite_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update folders" ON public.favorite_folders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete folders" ON public.favorite_folders
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tg_favorite_folders_updated
  BEFORE UPDATE ON public.favorite_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Favorite folder items ============
CREATE TABLE public.favorite_folder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.favorite_folders(id) ON DELETE CASCADE,
  favorite_id uuid NOT NULL REFERENCES public.trade_favorites(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, favorite_id)
);
CREATE INDEX idx_favorite_folder_items_folder ON public.favorite_folder_items(folder_id);
ALTER TABLE public.favorite_folder_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read folder items" ON public.favorite_folder_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.favorite_folders f
    WHERE f.id = folder_id AND f.user_id = auth.uid()
  ));
CREATE POLICY "owner insert folder items" ON public.favorite_folder_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.favorite_folders f
    WHERE f.id = folder_id AND f.user_id = auth.uid()
  ));
CREATE POLICY "owner update folder items" ON public.favorite_folder_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.favorite_folders f
    WHERE f.id = folder_id AND f.user_id = auth.uid()
  ));
CREATE POLICY "owner delete folder items" ON public.favorite_folder_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.favorite_folders f
    WHERE f.id = folder_id AND f.user_id = auth.uid()
  ));

-- ============ FF&E entitlements ============
CREATE TABLE public.ffe_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_session_id text UNIQUE,
  amount_cents integer NOT NULL DEFAULT 10000,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','consumed','refunded')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ffe_entitlements_user ON public.ffe_entitlements(user_id, status);
ALTER TABLE public.ffe_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read entitlements" ON public.ffe_entitlements
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============ Trade credits ============
CREATE TABLE public.trade_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_ref uuid,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','applied','expired')),
  applied_to_quote_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);
CREATE INDEX idx_trade_credits_user_status ON public.trade_credits(user_id, status);
ALTER TABLE public.trade_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read credits" ON public.trade_credits
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============ trade_quotes credit display column ============
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS credit_applied_cents integer NOT NULL DEFAULT 0;

-- ============ RPC to atomically apply oldest available credit to a quote on submission ============
CREATE OR REPLACE FUNCTION public.apply_available_credit_to_quote(_quote_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid;
  _credit RECORD;
BEGIN
  SELECT user_id INTO _user FROM public.trade_quotes WHERE id = _quote_id;
  IF _user IS NULL OR _user <> auth.uid() THEN
    RETURN 0;
  END IF;

  SELECT id, amount_cents INTO _credit
  FROM public.trade_credits
  WHERE user_id = _user AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.trade_credits
  SET status = 'applied',
      applied_to_quote_id = _quote_id,
      applied_at = now()
  WHERE id = _credit.id;

  UPDATE public.trade_quotes
  SET credit_applied_cents = COALESCE(credit_applied_cents, 0) + _credit.amount_cents
  WHERE id = _quote_id;

  RETURN _credit.amount_cents;
END;
$$;
