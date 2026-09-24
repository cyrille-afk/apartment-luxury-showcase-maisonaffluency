ALTER TABLE public.trade_accounts ADD COLUMN IF NOT EXISTS approved_at timestamptz;
UPDATE public.trade_accounts SET approved_at = COALESCE(reviewed_at, updated_at) WHERE status='approved' AND approved_at IS NULL;
CREATE OR REPLACE FUNCTION public.trade_accounts_set_approved_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN NEW.approved_at := now();
  ELSIF NEW.status<>'approved' THEN NEW.approved_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_trade_accounts_approved_at ON public.trade_accounts;
CREATE TRIGGER trg_trade_accounts_approved_at BEFORE INSERT OR UPDATE OF status ON public.trade_accounts FOR EACH ROW EXECUTE FUNCTION public.trade_accounts_set_approved_at();
CREATE INDEX IF NOT EXISTS trade_accounts_approved_at_idx ON public.trade_accounts(approved_at) WHERE approved_at IS NOT NULL;