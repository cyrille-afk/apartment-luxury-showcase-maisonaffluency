CREATE TABLE public.trade_quote_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_quote_extras TO authenticated;
GRANT ALL ON public.trade_quote_extras TO service_role;

ALTER TABLE public.trade_quote_extras ENABLE ROW LEVEL SECURITY;

-- Owners of the parent quote can fully manage their extras.
CREATE POLICY "Quote owner manages extras"
  ON public.trade_quote_extras
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = trade_quote_extras.quote_id AND q.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = trade_quote_extras.quote_id AND q.user_id = auth.uid()));

-- Admins (existing has_role pattern) can manage all extras.
CREATE POLICY "Admins manage all quote extras"
  ON public.trade_quote_extras
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX trade_quote_extras_quote_id_idx ON public.trade_quote_extras(quote_id);

CREATE TRIGGER trade_quote_extras_set_updated_at
  BEFORE UPDATE ON public.trade_quote_extras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();