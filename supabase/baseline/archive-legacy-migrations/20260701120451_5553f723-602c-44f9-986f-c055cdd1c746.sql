-- Clear the incorrect Travertino Silver photo from the Angelo M/R Port Saint Laurent quote line
-- so it falls back to the product's primary image instead of showing the wrong marble.
UPDATE trade_quote_items
SET image_url = NULL
WHERE id = 'e223fedd-682f-40f1-8650-d46e62adfff1'
  AND variant_label ILIKE '%Port Saint Laurent%';