UPDATE trade_products 
SET trade_price_cents = 1890000, currency = 'USD' 
WHERE product_name = 'Corteza Console Table' 
AND trade_price_cents IS NULL;