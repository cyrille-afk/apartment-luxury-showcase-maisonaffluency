
-- Keep the priced "Lantern Table Lamp" (d00f62fa), deactivate the duplicate without price
UPDATE trade_products SET is_active = false WHERE id = 'ae5b773d-4e76-4f03-8247-1df09a7031f7';

-- Deactivate the generic "Lantern" since "Lantern Table Lamp" with pricing is the correct record
UPDATE trade_products SET is_active = false WHERE id = '7d417dd8-0e7e-46ad-92ee-d50b281fb5fa';

-- Update the curator pick title to match the canonical name
UPDATE designer_curator_picks SET title = 'Lantern Table Lamp', trade_price_cents = 595000 WHERE id = 'be988b38-e8f9-402d-a7f1-7d8ffad9fae2';
