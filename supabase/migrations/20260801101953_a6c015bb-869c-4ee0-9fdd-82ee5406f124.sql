CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  full_name text,
  payment_method text NOT NULL DEFAULT 'card',
  status text NOT NULL DEFAULT 'pending',
  currency text NOT NULL DEFAULT 'usd',
  subtotal_cents integer NOT NULL DEFAULT 0,
  shipping_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  stripe_session_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  pick_id uuid,
  product_slug text,
  designer_slug text,
  title text NOT NULL,
  designer_name text,
  finish_label text,
  image_url text,
  lead_time text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  line_total_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON public.shop_orders(user_id);

GRANT SELECT ON public.shop_orders TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
GRANT SELECT ON public.shop_order_items TO authenticated;
GRANT ALL ON public.shop_order_items TO service_role;

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own orders" ON public.shop_orders
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all orders" ON public.shop_orders
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view their own order items" ON public.shop_order_items
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.shop_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

CREATE TRIGGER shop_orders_updated_at BEFORE UPDATE ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();