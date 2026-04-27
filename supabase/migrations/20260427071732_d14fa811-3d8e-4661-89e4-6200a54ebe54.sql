
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'trade_tier' AND e.enumlabel = 'platinum'
  ) THEN
    ALTER TYPE public.trade_tier ADD VALUE 'platinum';
  END IF;
END $$;
