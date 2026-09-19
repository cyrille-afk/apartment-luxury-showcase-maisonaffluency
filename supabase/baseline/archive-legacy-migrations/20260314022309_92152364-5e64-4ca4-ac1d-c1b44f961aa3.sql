
-- Function to add a product to a quote from hardcoded gallery data
-- Uses SECURITY DEFINER to bypass RLS on trade_products (trade users can only SELECT)
CREATE OR REPLACE FUNCTION public.add_gallery_product_to_quote(
  _user_id uuid,
  _quote_id uuid,
  _product_name text,
  _brand_name text,
  _category text DEFAULT '',
  _image_url text DEFAULT NULL,
  _dimensions text DEFAULT NULL,
  _materials text DEFAULT NULL,
  _quantity int DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_id uuid;
  _item_id uuid;
BEGIN
  -- Verify the quote belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM trade_quotes WHERE id = _quote_id AND user_id = _user_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Quote not found or not in draft status';
  END IF;

  -- Upsert the product (find by brand + name, or create)
  SELECT id INTO _product_id
  FROM trade_products
  WHERE product_name = _product_name AND brand_name = _brand_name
  LIMIT 1;

  IF _product_id IS NULL THEN
    INSERT INTO trade_products (product_name, brand_name, category, image_url, dimensions, materials, is_active)
    VALUES (_product_name, _brand_name, _category, _image_url, _dimensions, _materials, true)
    RETURNING id INTO _product_id;
  END IF;

  -- Check if this product is already in the quote
  SELECT id INTO _item_id
  FROM trade_quote_items
  WHERE quote_id = _quote_id AND product_id = _product_id;

  IF _item_id IS NOT NULL THEN
    -- Increment quantity
    UPDATE trade_quote_items
    SET quantity = quantity + _quantity
    WHERE id = _item_id;
    RETURN _item_id;
  ELSE
    -- Insert new item
    INSERT INTO trade_quote_items (quote_id, product_id, quantity)
    VALUES (_quote_id, _product_id, _quantity)
    RETURNING id INTO _item_id;
    RETURN _item_id;
  END IF;
END;
$$;
