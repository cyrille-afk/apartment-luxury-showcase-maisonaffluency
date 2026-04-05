
-- Order timeline table: tracks milestones for each confirmed quote
CREATE TABLE public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kanban_status text NOT NULL DEFAULT 'deposit_paid',
  deposit_paid_at timestamptz,
  production_start_at timestamptz,
  production_end_at timestamptz,
  balance_due_at timestamptz,
  balance_paid_at timestamptz,
  shipping_start_at timestamptz,
  shipping_end_at timestamptz,
  customs_start_at timestamptz,
  customs_cleared_at timestamptz,
  estimated_delivery_at timestamptz,
  actual_delivery_at timestamptz,
  production_weeks smallint NOT NULL DEFAULT 12,
  shipping_weeks smallint NOT NULL DEFAULT 3,
  customs_days smallint NOT NULL DEFAULT 5,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quote_id)
);

ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;

-- Admins can manage all timelines
CREATE POLICY "Admins can manage order timelines"
  ON public.order_timeline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trade users can view their own timelines
CREATE POLICY "Trade users can view own order timelines"
  ON public.order_timeline FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)));

-- Duration templates table: default durations per brand
CREATE TABLE public.order_duration_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  production_weeks smallint NOT NULL DEFAULT 12,
  shipping_weeks smallint NOT NULL DEFAULT 3,
  customs_days smallint NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_name, category)
);

ALTER TABLE public.order_duration_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Admins can manage duration templates"
  ON public.order_duration_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trade users can read templates
CREATE POLICY "Trade users can view duration templates"
  ON public.order_duration_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));
