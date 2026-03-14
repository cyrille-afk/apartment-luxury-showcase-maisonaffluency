
-- Trade Products table
CREATE TABLE public.trade_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  product_name text NOT NULL,
  sku text,
  description text,
  category text NOT NULL DEFAULT '',
  subcategory text DEFAULT '',
  trade_price_cents integer,
  rrp_price_cents integer,
  currency text NOT NULL DEFAULT 'SGD',
  dimensions text,
  materials text,
  lead_time text,
  image_url text,
  gallery_images text[] DEFAULT '{}',
  spec_sheet_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_products ENABLE ROW LEVEL SECURITY;

-- Only trade_users and admins can view products
CREATE POLICY "Trade users can view products"
  ON public.trade_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage products
CREATE POLICY "Admins can manage products"
  ON public.trade_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trade Documents table
CREATE TABLE public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  brand_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'tearsheet',
  file_url text NOT NULL,
  file_size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade users can view documents"
  ON public.trade_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'trade_user') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage documents"
  ON public.trade_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trade Quotes table
CREATE TABLE public.trade_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quotes"
  ON public.trade_quotes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all quotes"
  ON public.trade_quotes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trade Quote Items table
CREATE TABLE public.trade_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quote items"
  ON public.trade_quote_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = quote_id AND q.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.trade_quotes q WHERE q.id = quote_id AND q.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all quote items"
  ON public.trade_quote_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
