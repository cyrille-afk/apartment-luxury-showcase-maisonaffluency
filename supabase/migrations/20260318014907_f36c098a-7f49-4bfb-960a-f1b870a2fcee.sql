
-- Fix existing quote items that reference the unpriced "Ricky custom..." record
-- to point to the priced "Ricky Rug" record instead
UPDATE trade_quote_items 
SET product_id = '17a5a832-d3cc-4314-91d3-08208b1c9136' 
WHERE product_id = '3ea31a95-4133-4194-8c5a-64decf1ccc84';
