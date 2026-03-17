
-- Create sample request status enum
CREATE TYPE public.sample_request_status AS ENUM ('requested', 'approved', 'shipped', 'delivered', 'returned', 'cancelled');

-- Create sample requests table
CREATE TABLE public.trade_sample_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL DEFAULT '',
  shipping_city TEXT NOT NULL DEFAULT '',
  shipping_country TEXT NOT NULL DEFAULT 'Singapore',
  return_by DATE,
  notes TEXT,
  status sample_request_status NOT NULL DEFAULT 'requested',
  admin_notes TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_sample_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own sample requests
CREATE POLICY "Trade users can manage own sample requests"
  ON public.trade_sample_requests
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')))
  WITH CHECK (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')));

-- Admins can view all sample requests
CREATE POLICY "Admins can view all sample requests"
  ON public.trade_sample_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update all sample requests
CREATE POLICY "Admins can update all sample requests"
  ON public.trade_sample_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Enable realtime for sample requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_sample_requests;
