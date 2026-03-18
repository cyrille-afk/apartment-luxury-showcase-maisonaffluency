
-- Create enum for axonometric request status
CREATE TYPE public.axonometric_request_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Create axonometric requests table
CREATE TABLE public.axonometric_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status axonometric_request_status NOT NULL DEFAULT 'pending',
  request_type TEXT NOT NULL DEFAULT 'elevation',
  image_url TEXT NOT NULL,
  notes TEXT,
  admin_notes TEXT,
  result_image_url TEXT,
  project_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.axonometric_requests ENABLE ROW LEVEL SECURITY;

-- Trade users can submit and view their own requests
CREATE POLICY "Trade users can manage own axonometric requests"
  ON public.axonometric_requests
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() AND (
      has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (
    user_id = auth.uid() AND (
      has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Admins can view and update all requests
CREATE POLICY "Admins can view all axonometric requests"
  ON public.axonometric_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all axonometric requests"
  ON public.axonometric_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
