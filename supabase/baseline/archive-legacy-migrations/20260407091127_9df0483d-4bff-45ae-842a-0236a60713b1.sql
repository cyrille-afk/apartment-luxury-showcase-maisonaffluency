
-- Add expiry and rotation tracking columns
ALTER TABLE public.client_boards
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS token_rotated_at timestamptz;

-- Backfill existing boards: set expiry 30 days from now
UPDATE public.client_boards
SET token_expires_at = now() + interval '30 days'
WHERE token_expires_at IS NULL;

-- Update get_board_by_token to check expiry
CREATE OR REPLACE FUNCTION public.get_board_by_token(_token text)
RETURNS SETOF client_boards
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM client_boards
  WHERE share_token = _token
    AND status != 'draft'
    AND (token_expires_at IS NULL OR token_expires_at > now())
  LIMIT 1;
$$;

-- Update get_board_items_by_token to check expiry
CREATE OR REPLACE FUNCTION public.get_board_items_by_token(_token text)
RETURNS SETOF client_board_items
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bi.* FROM client_board_items bi
  INNER JOIN client_boards b ON b.id = bi.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bi.sort_order;
$$;

-- Update get_board_comments_by_token to check expiry
CREATE OR REPLACE FUNCTION public.get_board_comments_by_token(_token text)
RETURNS SETOF client_board_comments
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bc.* FROM client_board_comments bc
  INNER JOIN client_boards b ON b.id = bc.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bc.created_at;
$$;

-- Update add_board_comment_by_token to check expiry
CREATE OR REPLACE FUNCTION public.add_board_comment_by_token(
  _token text, _board_id uuid, _content text,
  _author_name text DEFAULT 'Client', _is_client boolean DEFAULT true,
  _item_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _comment_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM client_boards
    WHERE id = _board_id AND share_token = _token AND status = 'shared'
      AND (token_expires_at IS NULL OR token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid or expired board token';
  END IF;

  INSERT INTO client_board_comments (board_id, item_id, content, author_name, is_client)
  VALUES (_board_id, _item_id, _content, _author_name, _is_client)
  RETURNING id INTO _comment_id;
  RETURN _comment_id;
END;
$$;

-- Update update_item_approval_by_token to check expiry
CREATE OR REPLACE FUNCTION public.update_item_approval_by_token(
  _token text, _item_id uuid, _approval_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM client_board_items bi
    INNER JOIN client_boards b ON b.id = bi.board_id
    WHERE bi.id = _item_id AND b.share_token = _token AND b.status = 'shared'
      AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid or expired board token';
  END IF;

  UPDATE client_board_items SET approval_status = _approval_status
  WHERE id = _item_id;
END;
$$;

-- New: rotate_board_token function
CREATE OR REPLACE FUNCTION public.rotate_board_token(_board_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _new_token text;
BEGIN
  -- Only the board owner can rotate
  IF NOT EXISTS (
    SELECT 1 FROM client_boards WHERE id = _board_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to rotate this token';
  END IF;

  _new_token := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE client_boards
  SET share_token = _new_token,
      token_expires_at = now() + interval '30 days',
      token_rotated_at = now(),
      updated_at = now()
  WHERE id = _board_id;

  RETURN _new_token;
END;
$$;
