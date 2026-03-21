ALTER TABLE designer_curator_picks 
ADD COLUMN trade_price_cents integer DEFAULT NULL,
ADD COLUMN currency text NOT NULL DEFAULT 'EUR';