ALTER TABLE public.designers ADD COLUMN IF NOT EXISTS max_trade_discount numeric(5,2);

COMMENT ON COLUMN public.designers.max_trade_discount IS 'Optional brand-level safety cap on trade discount, expressed in percent (e.g. 5.00 = 5%). NULL means no cap.';