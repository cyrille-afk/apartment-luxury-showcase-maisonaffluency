
-- 1) Create a security-definer function to fetch a board by share_token
CREATE OR REPLACE FUNCTION public.get_board_by_token(_token text)
RETURNS SETOF client_boards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM client_boards
  WHERE share_token = _token AND status != 'draft'
  LIMIT 1;
$$;

-- 2) Create a security-definer function to fetch board items by board_id + token validation
CREATE OR REPLACE FUNCTION public.get_board_items_by_token(_token text)
RETURNS SETOF client_board_items
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bi.* FROM client_board_items bi
  INNER JOIN client_boards b ON b.id = bi.board_id
  WHERE b.share_token = _token AND b.status != 'draft'
  ORDER BY bi.sort_order;
$$;

-- 3) Create a security-definer function to fetch board comments by board_id + token validation
CREATE OR REPLACE FUNCTION public.get_board_comments_by_token(_token text)
RETURNS SETOF client_board_comments
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bc.* FROM client_board_comments bc
  INNER JOIN client_boards b ON b.id = bc.board_id
  WHERE b.share_token = _token AND b.status != 'draft'
  ORDER BY bc.created_at;
$$;

-- 4) Create a security-definer function to insert a comment with token validation
CREATE OR REPLACE FUNCTION public.add_board_comment_by_token(
  _token text,
  _board_id uuid,
  _content text,
  _author_name text DEFAULT 'Client',
  _is_client boolean DEFAULT true,
  _item_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _comment_id uuid;
BEGIN
  -- Verify token matches board
  IF NOT EXISTS (
    SELECT 1 FROM client_boards
    WHERE id = _board_id AND share_token = _token AND status = 'shared'
  ) THEN
    RAISE EXCEPTION 'Invalid board token';
  END IF;

  INSERT INTO client_board_comments (board_id, item_id, content, author_name, is_client)
  VALUES (_board_id, _item_id, _content, _author_name, _is_client)
  RETURNING id INTO _comment_id;

  RETURN _comment_id;
END;
$$;

-- 5) Create a security-definer function to update item approval with token validation
CREATE OR REPLACE FUNCTION public.update_item_approval_by_token(
  _token text,
  _item_id uuid,
  _approval_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify token matches the item's board
  IF NOT EXISTS (
    SELECT 1 FROM client_board_items bi
    INNER JOIN client_boards b ON b.id = bi.board_id
    WHERE bi.id = _item_id AND b.share_token = _token AND b.status = 'shared'
  ) THEN
    RAISE EXCEPTION 'Invalid board token';
  END IF;

  UPDATE client_board_items SET approval_status = _approval_status
  WHERE id = _item_id;
END;
$$;

-- 6) Drop the vulnerable anon policies
DROP POLICY IF EXISTS "Anyone can view shared boards by token" ON client_boards;
DROP POLICY IF EXISTS "Anyone can view shared board items" ON client_board_items;
DROP POLICY IF EXISTS "Anyone can view shared board comments" ON client_board_comments;
DROP POLICY IF EXISTS "Anyone can add comments on shared boards" ON client_board_comments;
DROP POLICY IF EXISTS "Anyone can update approval on shared items" ON client_board_items;
