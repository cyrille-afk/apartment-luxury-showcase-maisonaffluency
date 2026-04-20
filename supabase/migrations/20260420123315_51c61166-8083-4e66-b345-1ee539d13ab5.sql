-- =========================================================
-- TMS Phase 1: Shipping rate matrix + quotes
-- =========================================================

-- Reusable updated_at trigger function (create if missing)
CREATE OR REPLACE FUNCTION public.tms_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- shipping_lanes ----------
CREATE TABLE public.shipping_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country text NOT NULL,
  origin_city text NOT NULL DEFAULT '',
  dest_country text NOT NULL,
  dest_zone text NOT NULL DEFAULT '',
  carrier_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('sea_lcl','sea_fcl','air','road','courier')),
  transit_days_min smallint NOT NULL DEFAULT 0,
  transit_days_max smallint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipping_lanes_lookup
  ON public.shipping_lanes (origin_country, dest_country, mode, active);

ALTER TABLE public.shipping_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipping lanes"
  ON public.shipping_lanes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users read shipping lanes"
  ON public.shipping_lanes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_shipping_lanes_updated
  BEFORE UPDATE ON public.shipping_lanes
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- ---------- shipping_rate_brackets ----------
CREATE TABLE public.shipping_rate_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id uuid NOT NULL REFERENCES public.shipping_lanes(id) ON DELETE CASCADE,
  min_volume_cbm numeric(10,3) NOT NULL DEFAULT 0,
  max_volume_cbm numeric(10,3) NOT NULL DEFAULT 9999,
  min_weight_kg numeric(10,2) NOT NULL DEFAULT 0,
  max_weight_kg numeric(10,2) NOT NULL DEFAULT 999999,
  base_rate_cents integer NOT NULL DEFAULT 0,
  rate_per_cbm_cents integer NOT NULL DEFAULT 0,
  rate_per_kg_cents integer NOT NULL DEFAULT 0,
  min_charge_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_brackets_lane ON public.shipping_rate_brackets (lane_id, valid_from);

ALTER TABLE public.shipping_rate_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rate brackets"
  ON public.shipping_rate_brackets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users read rate brackets"
  ON public.shipping_rate_brackets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_rate_brackets_updated
  BEFORE UPDATE ON public.shipping_rate_brackets
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- ---------- shipping_surcharges ----------
CREATE TABLE public.shipping_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surcharge_type text NOT NULL CHECK (surcharge_type IN ('fuel','insurance','customs','handling','last_mile','security','documentation')),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','lane','carrier','dest_zone')),
  lane_id uuid REFERENCES public.shipping_lanes(id) ON DELETE CASCADE,
  carrier_name text,
  dest_country text,
  dest_zone text,
  calc_method text NOT NULL CHECK (calc_method IN ('percent','flat','per_cbm','per_kg')),
  value_numeric numeric(12,4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_surcharges_lookup ON public.shipping_surcharges (surcharge_type, scope, active);

ALTER TABLE public.shipping_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage surcharges"
  ON public.shipping_surcharges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users read surcharges"
  ON public.shipping_surcharges FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_surcharges_updated
  BEFORE UPDATE ON public.shipping_surcharges
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- ---------- shipping_duty_rates ----------
CREATE TABLE public.shipping_duty_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dest_country text NOT NULL,
  hs_chapter text NOT NULL DEFAULT '94',
  category text NOT NULL DEFAULT 'furniture' CHECK (category IN ('furniture','lighting','art','textile','accessory','other')),
  duty_percent numeric(6,3) NOT NULL DEFAULT 0,
  vat_percent numeric(6,3) NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dest_country, hs_chapter, category)
);

ALTER TABLE public.shipping_duty_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage duty rates"
  ON public.shipping_duty_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users read duty rates"
  ON public.shipping_duty_rates FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_duty_rates_updated
  BEFORE UPDATE ON public.shipping_duty_rates
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- ---------- shipping_quotes ----------
CREATE TABLE public.shipping_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quote_id uuid REFERENCES public.trade_quotes(id) ON DELETE SET NULL,
  order_timeline_id uuid REFERENCES public.order_timeline(id) ON DELETE CASCADE,
  origin_country text NOT NULL DEFAULT '',
  origin_city text NOT NULL DEFAULT '',
  origin_address text,
  dest_country text NOT NULL DEFAULT '',
  dest_city text NOT NULL DEFAULT '',
  dest_address text,
  dest_zone text,
  total_volume_cbm numeric(10,3) NOT NULL DEFAULT 0,
  total_weight_kg numeric(10,2) NOT NULL DEFAULT 0,
  declared_value_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  selected_lane_id uuid REFERENCES public.shipping_lanes(id) ON DELETE SET NULL,
  selected_carrier text,
  selected_mode text,
  freight_cents integer NOT NULL DEFAULT 0,
  fuel_cents integer NOT NULL DEFAULT 0,
  insurance_cents integer NOT NULL DEFAULT 0,
  duty_cents integer NOT NULL DEFAULT 0,
  vat_cents integer NOT NULL DEFAULT 0,
  customs_cents integer NOT NULL DEFAULT 0,
  last_mile_cents integer NOT NULL DEFAULT 0,
  handling_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'estimate' CHECK (status IN ('estimate','confirmed','expired','cancelled')),
  valid_until date,
  computed_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE INDEX idx_shipping_quotes_user ON public.shipping_quotes (user_id, created_at DESC);
CREATE INDEX idx_shipping_quotes_order ON public.shipping_quotes (order_timeline_id);
CREATE INDEX idx_shipping_quotes_quote ON public.shipping_quotes (quote_id);

ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all shipping quotes"
  ON public.shipping_quotes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users manage own shipping quotes"
  ON public.shipping_quotes FOR ALL TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE TRIGGER trg_shipping_quotes_updated
  BEFORE UPDATE ON public.shipping_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();
