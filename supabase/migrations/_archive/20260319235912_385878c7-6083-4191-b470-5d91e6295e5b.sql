
-- Client collaboration boards
CREATE TABLE public.client_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Board',
  client_name text NOT NULL DEFAULT '',
  client_email text DEFAULT NULL,
  share_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(share_token)
);

ALTER TABLE public.client_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade users can manage own boards" ON public.client_boards
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')))
  WITH CHECK (user_id = auth.uid() AND (has_role(auth.uid(), 'trade_user') OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins can view all boards" ON public.client_boards
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view shared boards by token" ON public.client_boards
  FOR SELECT TO anon, authenticated
  USING (status != 'draft');

-- Board items
CREATE TABLE public.client_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 0,
  notes text DEFAULT NULL,
  approval_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board owners can manage items" ON public.client_board_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND user_id = auth.uid()));

CREATE POLICY "Anyone can view shared board items" ON public.client_board_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND status != 'draft'));

CREATE POLICY "Anyone can update approval on shared items" ON public.client_board_items
  FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND status = 'shared'))
  WITH CHECK (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND status = 'shared'));

-- Board comments
CREATE TABLE public.client_board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.client_boards(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.client_board_items(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Client',
  content text NOT NULL,
  is_client boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board owners can manage comments" ON public.client_board_comments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND user_id = auth.uid()));

CREATE POLICY "Anyone can view shared board comments" ON public.client_board_comments
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND status != 'draft'));

CREATE POLICY "Anyone can add comments on shared boards" ON public.client_board_comments
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM client_boards WHERE id = board_id AND status = 'shared'));
