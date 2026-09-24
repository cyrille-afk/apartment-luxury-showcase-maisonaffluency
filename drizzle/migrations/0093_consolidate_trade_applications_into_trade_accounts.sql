ALTER TABLE public.trade_accounts
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS tax_vat_id text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS legacy_application_id uuid UNIQUE;

CREATE INDEX IF NOT EXISTS trade_accounts_user_id_idx ON public.trade_accounts(user_id);

-- Merge legacy rows whose email already exists
UPDATE public.trade_accounts t SET
  user_id = ta.user_id, job_title = ta.job_title, country = ta.country, city = ta.city,
  instagram_handle = ta.instagram_handle, tax_vat_id = ta.tax_vat_id,
  legacy_application_id = ta.id,
  status = CASE WHEN ta.status::text = 'approved' THEN 'approved' ELSE t.status END
FROM public.trade_applications ta JOIN public.profiles p ON p.id = ta.user_id
WHERE lower(p.email) = lower(t.email) AND t.legacy_application_id IS NULL;

-- Copy remaining legacy rows
INSERT INTO public.trade_accounts (email, studio_name, contact_name, website_or_ig, business_reg_number,
  credential_document_path, status, reviewed_by, reviewed_at, created_at, phone_number,
  user_id, job_title, country, city, instagram_handle, tax_vat_id, source, legacy_application_id)
SELECT p.email, ta.company_name, NULLIF(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),
  coalesce(ta.company_website, ta.instagram_handle), ta.corporate_reg_number, ta.credential_document_path,
  CASE ta.status::text WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'pending_review' END,
  ta.reviewed_by, ta.reviewed_at, ta.created_at,
  CASE WHEN char_length(p.phone) BETWEEN 7 AND 30 THEN p.phone ELSE NULL END,
  ta.user_id, ta.job_title, ta.country, ta.city, ta.instagram_handle, ta.tax_vat_id, 'legacy_trade_register', ta.id
FROM public.trade_applications ta JOIN public.profiles p ON p.id = ta.user_id
WHERE p.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.trade_accounts t WHERE t.legacy_application_id = ta.id OR lower(t.email) = lower(p.email));

-- Link any account to an existing user by email
UPDATE public.trade_accounts t SET user_id = p.id FROM public.profiles p
WHERE t.user_id IS NULL AND lower(p.email) = lower(t.email);

-- Members can read their own account row
CREATE POLICY "Users view own trade account" ON public.trade_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Approval grants trade access
CREATE OR REPLACE FUNCTION public.trade_accounts_grant_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    uid := NEW.user_id;
    IF uid IS NULL THEN
      SELECT id INTO uid FROM public.profiles WHERE lower(email) = lower(NEW.email) LIMIT 1;
      IF uid IS NOT NULL THEN NEW.user_id := uid; END IF;
    END IF;
    IF uid IS NOT NULL THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (uid, 'trade_user') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_trade_accounts_grant_access BEFORE INSERT OR UPDATE OF status ON public.trade_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trade_accounts_grant_access();

COMMENT ON TABLE public.trade_applications IS 'DEPRECATED: migrated into trade_accounts (legacy_application_id). Read-only backup.';