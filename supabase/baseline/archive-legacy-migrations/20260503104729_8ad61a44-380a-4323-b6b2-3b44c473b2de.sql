-- Recent views (lightweight signal for predictive personalization)
CREATE TABLE public.trade_recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('designer','product','curator_pick')),
  entity_id uuid,
  entity_label text,
  brand_name text,
  category text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trade_recent_views_user_time ON public.trade_recent_views(user_id, viewed_at DESC);
CREATE INDEX idx_trade_recent_views_user_entity ON public.trade_recent_views(user_id, entity_type, entity_id);

ALTER TABLE public.trade_recent_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recent views"
  ON public.trade_recent_views FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all recent views"
  ON public.trade_recent_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Concierge escalations (sentiment-driven hand-offs to a human concierge)
CREATE TABLE public.trade_concierge_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_sentiment text NOT NULL,
  trigger_intent text,
  conversation_excerpt jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  notified_admins boolean NOT NULL DEFAULT false,
  notified_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trade_concierge_escalations_user ON public.trade_concierge_escalations(user_id, created_at DESC);
CREATE INDEX idx_trade_concierge_escalations_status ON public.trade_concierge_escalations(status, created_at DESC);

ALTER TABLE public.trade_concierge_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own escalations"
  ON public.trade_concierge_escalations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own escalations"
  ON public.trade_concierge_escalations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all escalations"
  ON public.trade_concierge_escalations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update escalations"
  ON public.trade_concierge_escalations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_concierge_escalations_updated
  BEFORE UPDATE ON public.trade_concierge_escalations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();