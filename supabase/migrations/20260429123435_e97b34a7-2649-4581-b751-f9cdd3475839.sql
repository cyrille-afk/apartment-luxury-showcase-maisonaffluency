-- Tables
CREATE TABLE public.trade_floor_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled plan',
  plan_image_url TEXT NOT NULL,
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trade_floor_plans_user ON public.trade_floor_plans(user_id);

CREATE TABLE public.trade_floor_plan_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.trade_floor_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Layout v1',
  layout JSONB NOT NULL DEFAULT '{"placements":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trade_floor_plan_layouts_plan ON public.trade_floor_plan_layouts(plan_id);
CREATE INDEX idx_trade_floor_plan_layouts_user ON public.trade_floor_plan_layouts(user_id);

ALTER TABLE public.trade_floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_floor_plan_layouts ENABLE ROW LEVEL SECURITY;

-- Floor plans policies
CREATE POLICY "owners view floor plans"
  ON public.trade_floor_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owners insert floor plans"
  ON public.trade_floor_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update floor plans"
  ON public.trade_floor_plans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owners delete floor plans"
  ON public.trade_floor_plans FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Layouts policies
CREATE POLICY "owners view layouts"
  ON public.trade_floor_plan_layouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owners insert layouts"
  ON public.trade_floor_plan_layouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owners update layouts"
  ON public.trade_floor_plan_layouts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owners delete layouts"
  ON public.trade_floor_plan_layouts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers (reuse existing helper if present)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_trade_floor_plans_updated
  BEFORE UPDATE ON public.trade_floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_trade_floor_plan_layouts_updated
  BEFORE UPDATE ON public.trade_floor_plan_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-plans', 'floor-plans', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users read own floor plan files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'floor-plans'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY "users upload own floor plan files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'floor-plans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "users update own floor plan files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'floor-plans'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );
CREATE POLICY "users delete own floor plan files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'floor-plans'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
  );