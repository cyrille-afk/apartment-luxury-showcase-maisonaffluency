
CREATE OR REPLACE FUNCTION public.add_gallery_product_to_quote(
  _user_id uuid, _quote_id uuid, _product_name text, _brand_name text,
  _category text DEFAULT ''::text, _image_url text DEFAULT NULL::text,
  _dimensions text DEFAULT NULL::text, _materials text DEFAULT NULL::text,
  _quantity integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _item_id uuid;
  _norm_name text;
BEGIN
  -- Verify the quote belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM trade_quotes WHERE id = _quote_id AND user_id = _user_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Quote not found or not in draft status';
  END IF;

  -- Normalize the product name for broader matching
  _norm_name := lower(regexp_replace(
    regexp_replace(_product_name, '[^a-zA-Z0-9 ]', ' ', 'g'),
    '\s+', ' ', 'g'
  ));

  -- 1) Exact match by brand + name
  SELECT id INTO _product_id
  FROM trade_products
  WHERE product_name = _product_name AND brand_name = _brand_name
  LIMIT 1;

  -- 2) If found but unpriced, check if there's a PRICED record from the same brand
  --    whose normalized name is contained in or contains the target name
  IF _product_id IS NOT NULL THEN
    DECLARE _priced_id uuid;
    BEGIN
      SELECT tp2.id INTO _priced_id
      FROM trade_products tp2
      WHERE tp2.brand_name = _brand_name
        AND (tp2.trade_price_cents IS NOT NULL OR tp2.rrp_price_cents IS NOT NULL)
        AND tp2.id != _product_id
        AND (
          _norm_name LIKE '%' || lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) || '%'
          OR lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) LIKE '%' || _norm_name || '%'
        )
      ORDER BY tp2.trade_price_cents IS NOT NULL DESC
      LIMIT 1;

      -- If we found a priced variant, prefer it but also update missing fields on it
      IF _priced_id IS NOT NULL THEN
        UPDATE trade_products
        SET image_url = COALESCE(trade_products.image_url, _image_url),
            dimensions = COALESCE(trade_products.dimensions, _dimensions),
            materials = COALESCE(trade_products.materials, _materials)
        WHERE id = _priced_id;
        _product_id := _priced_id;
      ELSE
        -- Update missing fields on the exact-match product
        UPDATE trade_products
        SET image_url = COALESCE(trade_products.image_url, _image_url),
            dimensions = COALESCE(trade_products.dimensions, _dimensions),
            materials = COALESCE(trade_products.materials, _materials)
        WHERE id = _product_id;
      END IF;
    END;
  END IF;

  -- 3) No exact match: try to find a priced record from same brand with fuzzy name match
  IF _product_id IS NULL THEN
    SELECT tp2.id INTO _product_id
    FROM trade_products tp2
    WHERE tp2.brand_name = _brand_name
      AND (tp2.trade_price_cents IS NOT NULL OR tp2.rrp_price_cents IS NOT NULL)
      AND (
        _norm_name LIKE '%' || lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) || '%'
        OR lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) LIKE '%' || _norm_name || '%'
      )
    ORDER BY tp2.trade_price_cents IS NOT NULL DESC
    LIMIT 1;

    IF _product_id IS NOT NULL THEN
      UPDATE trade_products
      SET image_url = COALESCE(trade_products.image_url, _image_url),
          dimensions = COALESCE(trade_products.dimensions, _dimensions),
          materials = COALESCE(trade_products.materials, _materials)
      WHERE id = _product_id;
    END IF;
  END IF;

  -- 4) Still nothing: create new product
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
    UPDATE trade_quote_items
    SET quantity = quantity + _quantity
    WHERE id = _item_id;
    RETURN _item_id;
  ELSE
    INSERT INTO trade_quote_items (quote_id, product_id, quantity)
    VALUES (_quote_id, _product_id, _quantity)
    RETURNING id INTO _item_id;
    RETURN _item_id;
  END IF;
END;
$function$
