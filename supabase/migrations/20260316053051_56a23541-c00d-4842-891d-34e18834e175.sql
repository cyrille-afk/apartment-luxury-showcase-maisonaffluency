
-- Add workflow columns to trade_quotes
ALTER TABLE public.trade_quotes 
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Allow admins to update trade_quotes (they can currently only SELECT)
CREATE POLICY "Admins can update all quotes"
  ON public.trade_quotes
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update quote item prices
CREATE POLICY "Admins can update all quote items"
  ON public.trade_quote_items
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
