-- QUOTES
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  file_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read quotes" ON public.quotes
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Authenticated insert own quotes" ON public.quotes
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins update quotes" ON public.quotes
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins delete quotes" ON public.quotes
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  invoice_status text NOT NULL DEFAULT 'missing' CHECK (invoice_status IN ('missing','received','under_review')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','deposit_settled','fully_paid')),
  approved_by_manager boolean NOT NULL DEFAULT false,
  approval_date timestamptz,
  due_date date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read pos" ON public.purchase_orders
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Authenticated insert own pos" ON public.purchase_orders
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins update pos" ON public.purchase_orders
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins delete pos" ON public.purchase_orders
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ITEMS
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  brand text,
  category text,
  quantity integer NOT NULL DEFAULT 1,
  supplier_cost numeric(12,2) NOT NULL DEFAULT 0.00,
  markup_tier text NOT NULL DEFAULT 'Custom',
  markup_percentage numeric(5,2) NOT NULL DEFAULT 0.00,
  client_price numeric(12,2) NOT NULL DEFAULT 0.00,
  thumbnail_url text,
  expected_ready_date date,
  required_by_date date,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  deposit_required_percent numeric(5,2) NOT NULL DEFAULT 50.00,
  deposit_paid boolean NOT NULL DEFAULT false,
  balance_due numeric(12,2) NOT NULL DEFAULT 0.00,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read items" ON public.items
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Authenticated insert own items" ON public.items
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins update items" ON public.items
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Owners and admins delete items" ON public.items
FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Indexes for relational lookups
CREATE INDEX idx_quotes_supplier ON public.quotes(supplier_id);
CREATE INDEX idx_pos_quote ON public.purchase_orders(quote_id);
CREATE INDEX idx_pos_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_items_quote ON public.items(quote_id);
CREATE INDEX idx_items_po ON public.items(po_id);

-- Keep client_price and balance_due coherent on write
CREATE OR REPLACE FUNCTION public.items_recalc_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_price IS NULL OR NEW.client_price = 0 THEN
    NEW.client_price := ROUND(COALESCE(NEW.supplier_cost,0) * (1 + COALESCE(NEW.markup_percentage,0)/100), 2);
  END IF;
  NEW.balance_due := CASE
    WHEN NEW.deposit_paid THEN ROUND(NEW.client_price * (1 - COALESCE(NEW.deposit_required_percent,0)/100), 2)
    ELSE NEW.client_price
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_recalc_financials_trg
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.items_recalc_financials();