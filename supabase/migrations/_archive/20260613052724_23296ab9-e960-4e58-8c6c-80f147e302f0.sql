-- =========================================================================
-- Worldwide Trade Billing — Phase 1 Step 1: Foundation schema
-- =========================================================================

-- 1. Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.billing_mode AS ENUM ('agent_commission', 'net_buy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payer_type AS ENUM ('end_client', 'designer_firm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. studio_payout_accounts --------------------------------------------
CREATE TABLE IF NOT EXISTS public.studio_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  label text NOT NULL,                              -- "Main USD account", "EUR (Crédit Mutuel)", etc.
  country_code text NOT NULL,                       -- ISO 3166-1 alpha-2
  currency text NOT NULL,                           -- ISO 4217
  -- One of these blocks is populated depending on country_code:
  account_holder_name text NOT NULL,
  iban text,                                        -- EU/UK/CH
  swift_bic text,                                   -- EU/UK/CH/MENA/APAC
  ach_routing_number text,                          -- US
  ach_account_number text,                          -- US
  bank_name text,
  bank_address text,
  -- Tax & compliance references (URL pointers, not the documents themselves):
  tax_form_kind text,                               -- 'W9', 'W8BEN', 'W8BENE', 'VAT_ID', etc.
  tax_form_reference text,                          -- VAT number, EIN, etc.
  tax_form_document_path text,                      -- path inside the private 'client-documents' bucket
  -- Stripe Connect linkage (populated when the studio has onboarded):
  stripe_connect_account_id text UNIQUE,
  stripe_connect_status text NOT NULL DEFAULT 'pending'
    CHECK (stripe_connect_status IN ('pending', 'onboarding', 'verified', 'restricted', 'disabled')),
  -- Misc:
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_payout_accounts_studio ON public.studio_payout_accounts(studio_id);
-- Only one default per studio:
CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_payout_default
  ON public.studio_payout_accounts(studio_id) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_payout_accounts TO authenticated;
GRANT ALL ON public.studio_payout_accounts TO service_role;

ALTER TABLE public.studio_payout_accounts ENABLE ROW LEVEL SECURITY;

-- Members of the studio can read; only studio admins (or platform admins) can write.
CREATE POLICY "Studio members read payout accounts"
  ON public.studio_payout_accounts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_view_studio(auth.uid(), studio_id)
  );

CREATE POLICY "Studio admins manage payout accounts"
  ON public.studio_payout_accounts
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  );

CREATE TRIGGER trg_studio_payout_accounts_updated
  BEFORE UPDATE ON public.studio_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. studio_resale_certificates ----------------------------------------
CREATE TABLE IF NOT EXISTS public.studio_resale_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  state_code text NOT NULL,                         -- 2-letter US state, or 'MULTI' for MTC/SST (kept for future flexibility but UI uses per-state in v1)
  certificate_number text,
  document_path text NOT NULL,                      -- path inside the private 'client-documents' bucket
  issued_on date,
  expires_on date,                                  -- nullable; many states do not expire
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  rejected_reason text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_resale_certs_studio
  ON public.studio_resale_certificates(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_resale_certs_state
  ON public.studio_resale_certificates(studio_id, state_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_resale_certificates TO authenticated;
GRANT ALL ON public.studio_resale_certificates TO service_role;

ALTER TABLE public.studio_resale_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members read resale certs"
  ON public.studio_resale_certificates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_view_studio(auth.uid(), studio_id)
  );

CREATE POLICY "Studio admins manage resale certs"
  ON public.studio_resale_certificates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  );

CREATE TRIGGER trg_studio_resale_certificates_updated
  BEFORE UPDATE ON public.studio_resale_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. Helper: does the studio have a verified, non-expired cert for a state?
CREATE OR REPLACE FUNCTION public.studio_has_resale_cert_for_state(
  _studio_id uuid,
  _state text
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.studio_resale_certificates
    WHERE studio_id = _studio_id
      AND upper(state_code) = upper(_state)
      AND verification_status = 'verified'
      AND (expires_on IS NULL OR expires_on >= current_date)
  );
$$;


-- 5. trade_quotes — extend with billing mode & payer fields ------------
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS billing_mode public.billing_mode NOT NULL DEFAULT 'agent_commission',
  ADD COLUMN IF NOT EXISTS payer_type public.payer_type NOT NULL DEFAULT 'end_client',
  ADD COLUMN IF NOT EXISTS commission_pct numeric,                        -- snapshot at quote time; 0 in net_buy
  ADD COLUMN IF NOT EXISTS net_discount_pct numeric,                      -- snapshot at quote time; 0 in agent_commission
  ADD COLUMN IF NOT EXISTS end_client_billing jsonb,                      -- { name, email, address1, address2, city, state, postal_code, country, phone }
  ADD COLUMN IF NOT EXISTS designer_payout_account_id uuid
    REFERENCES public.studio_payout_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resale_certificate_id uuid
    REFERENCES public.studio_resale_certificates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_quotes_billing_mode
  ON public.trade_quotes(billing_mode);


-- 6. Validation trigger — enforce the business rules without CHECK
--    (CHECK can't read another table for resale certs).
CREATE OR REPLACE FUNCTION public.tg_validate_trade_quote_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _state text;
BEGIN
  -- In agent_commission mode: payer must be end_client AND end_client_billing must be present at submit time.
  IF NEW.billing_mode = 'agent_commission' THEN
    IF NEW.payer_type <> 'end_client' THEN
      RAISE EXCEPTION 'agent_commission billing_mode requires payer_type=end_client';
    END IF;
    IF NEW.status NOT IN ('draft') AND (NEW.end_client_billing IS NULL
        OR NULLIF(NEW.end_client_billing->>'email', '') IS NULL) THEN
      RAISE EXCEPTION 'agent_commission quotes must capture end-client billing (name + email) before submission';
    END IF;
  END IF;

  -- In net_buy mode: payer must be designer_firm, and US ship-to requires a verified resale cert for that state.
  IF NEW.billing_mode = 'net_buy' THEN
    IF NEW.payer_type <> 'designer_firm' THEN
      RAISE EXCEPTION 'net_buy billing_mode requires payer_type=designer_firm';
    END IF;
    IF NEW.status NOT IN ('draft') AND upper(COALESCE(NEW.ship_to_country, '')) = 'US' THEN
      _state := NULLIF(upper(NEW.ship_to_state), '');
      IF _state IS NULL THEN
        RAISE EXCEPTION 'net_buy US quotes require ship_to_state';
      END IF;
      IF NEW.studio_id IS NULL THEN
        RAISE EXCEPTION 'net_buy quotes must be attached to a studio so we can verify resale certificate';
      END IF;
      IF NOT public.studio_has_resale_cert_for_state(NEW.studio_id, _state) THEN
        RAISE EXCEPTION 'net_buy to % requires a verified resale certificate for that state', _state;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trade_quote_billing ON public.trade_quotes;
CREATE TRIGGER trg_validate_trade_quote_billing
  BEFORE INSERT OR UPDATE ON public.trade_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_trade_quote_billing();
