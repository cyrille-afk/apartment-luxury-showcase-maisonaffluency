UPDATE trade_products tp
SET image_url = sub.product_image_url
FROM (
  SELECT DISTINCT ON (tp2.id) tp2.id, gh.product_image_url
  FROM trade_products tp2
  JOIN gallery_hotspots gh ON LOWER(TRIM(tp2.product_name)) = LOWER(TRIM(gh.product_name))
  WHERE tp2.image_url IS NULL AND gh.product_image_url IS NOT NULL
) sub
WHERE tp.id = sub.id;