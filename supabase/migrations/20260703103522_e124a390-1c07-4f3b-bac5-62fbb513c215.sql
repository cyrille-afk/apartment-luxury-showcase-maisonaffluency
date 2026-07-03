CREATE OR REPLACE FUNCTION public.add_gallery_product_to_quote(
  _user_id uuid,
  _quote_id uuid,
  _product_name text,
  _brand_name text,
  _category text DEFAULT ''::text,
  _image_url text DEFAULT NULL::text,
  _dimensions text DEFAULT NULL::text,
  _materials text DEFAULT NULL::text,
  _quantity integer DEFAULT 1,
  _variant_label text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _priced_id uuid;
  _item_id uuid;
  _target_words text[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trade_quotes WHERE id = _quote_id AND user_id = _user_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Quote not found or not in draft status';
  END IF;

  _target_words := string_to_array(
    lower(regexp_replace(regexp_replace(_product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')),
    ' '
  );

  SELECT id INTO _product_id
  FROM trade_products
  WHERE product_name = _product_name AND brand_name = _brand_name
  LIMIT 1;

  SELECT tp2.id INTO _priced_id
  FROM trade_products tp2
  WHERE tp2.brand_name = _brand_name
    AND (tp2.trade_price_cents IS NOT NULL OR tp2.rrp_price_cents IS NOT NULL)
    AND (_product_id IS NULL OR tp2.id != _product_id)
    AND _target_words @> string_to_array(
          lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')),
          ' '
        )
  ORDER BY tp2.trade_price_cents IS NOT NULL DESC
  LIMIT 1;

  IF _priced_id IS NOT NULL THEN
    UPDATE trade_products
    SET image_url = COALESCE(trade_products.image_url, _image_url),
        dimensions = COALESCE(trade_products.dimensions, _dimensions),
        materials = COALESCE(trade_products.materials, _materials)
    WHERE id = _priced_id;
    _product_id := _priced_id;
  ELSIF _product_id IS NOT NULL THEN
    UPDATE trade_products
    SET image_url = COALESCE(trade_products.image_url, _image_url),
        dimensions = COALESCE(trade_products.dimensions, _dimensions),
        materials = COALESCE(trade_products.materials, _materials)
    WHERE id = _product_id;
  ELSE
    INSERT INTO trade_products (product_name, brand_name, category, image_url, dimensions, materials, is_active)
    VALUES (_product_name, _brand_name, _category, _image_url, _dimensions, _materials, false)
    RETURNING id INTO _product_id;
  END IF;

  -- Merge lines only when BOTH product_id AND variant_label match.
  -- Different variants (e.g. 10-Lights vs 20-Lights chandelier) must remain
  -- distinct quote lines so each carries its own dimensions and price.
  -- NULL variant_label is treated as its own bucket ("no variant chosen").
  SELECT id INTO _item_id
  FROM trade_quote_items
  WHERE quote_id = _quote_id
    AND product_id = _product_id
    AND COALESCE(variant_label, '') = COALESCE(_variant_label, '');

  IF _item_id IS NOT NULL THEN
    UPDATE trade_quote_items
    SET quantity = quantity + _quantity,
        image_url = COALESCE(NULLIF(_image_url, ''), trade_quote_items.image_url)
    WHERE id = _item_id;
    RETURN _item_id;
  ELSE
    INSERT INTO trade_quote_items (quote_id, product_id, quantity, image_url, variant_label)
    VALUES (_quote_id, _product_id, _quantity, NULLIF(_image_url, ''), _variant_label)
    RETURNING id INTO _item_id;
    RETURN _item_id;
  END IF;
END;
$function$;