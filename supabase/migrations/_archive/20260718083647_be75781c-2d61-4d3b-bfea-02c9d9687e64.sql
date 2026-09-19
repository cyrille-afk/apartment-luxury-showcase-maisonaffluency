-- ============================================================
-- Phase 3: trade_products availability + Mandarin overrides
-- ============================================================
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS in_situ_sg boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_from date NULL,
  ADD COLUMN IF NOT EXISTS provenance_cn text NULL,
  ADD COLUMN IF NOT EXISTS asia_lead_time_days integer NULL;

COMMENT ON COLUMN public.trade_products.in_situ_sg IS 'True when the piece is physically available at the Singapore District 9 showroom for immediate white-glove delivery.';
COMMENT ON COLUMN public.trade_products.available_from IS 'Optional date the in-situ piece becomes available; NULL means immediately.';
COMMENT ON COLUMN public.trade_products.provenance_cn IS 'Optional Mandarin provenance snippet used by the CN concierge instead of the auto-translated version.';
COMMENT ON COLUMN public.trade_products.asia_lead_time_days IS 'Optional per-product override for Asia (Greater China / SEA) lead time, in days. Overrides the brand-level default.';

-- ============================================================
-- Phase 4: cn_director_briefs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cn_director_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NULL REFERENCES public.portal_sessions(id) ON DELETE SET NULL,
  user_id uuid NULL,
  invited_name text NULL,
  contact_email text NULL,
  contact_phone text NULL,
  project_summary text NULL,
  aesthetic text NULL,
  budget_band text NULL,
  sentiment text NULL,
  pieces_of_interest jsonb NOT NULL DEFAULT '[]'::jsonb,
  viewing_requested_at timestamptz NULL,
  status text NOT NULL DEFAULT 'new',
  admin_notes text NULL,
  last_email_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Status validation via trigger (avoids CHECK-constraint dump/restore issues).
CREATE OR REPLACE FUNCTION public.cn_director_briefs_validate_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('new', 'contacted', 'booked', 'closed') THEN
    RAISE EXCEPTION 'Invalid cn_director_briefs.status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_cn_director_briefs_validate ON public.cn_director_briefs;
CREATE TRIGGER trg_cn_director_briefs_validate
  BEFORE INSERT OR UPDATE ON public.cn_director_briefs
  FOR EACH ROW EXECUTE FUNCTION public.cn_director_briefs_validate_status();

CREATE INDEX IF NOT EXISTS idx_cn_director_briefs_status ON public.cn_director_briefs(status);
CREATE INDEX IF NOT EXISTS idx_cn_director_briefs_session ON public.cn_director_briefs(session_id);
CREATE INDEX IF NOT EXISTS idx_cn_director_briefs_updated ON public.cn_director_briefs(updated_at DESC);

-- Grants
GRANT SELECT, UPDATE ON public.cn_director_briefs TO authenticated;
GRANT ALL ON public.cn_director_briefs TO service_role;

-- RLS
ALTER TABLE public.cn_director_briefs ENABLE ROW LEVEL SECURITY;

-- Admins/super_admins can read
CREATE POLICY "Admins can read cn director briefs"
  ON public.cn_director_briefs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Admins/super_admins can update (status, notes)
CREATE POLICY "Admins can update cn director briefs"
  ON public.cn_director_briefs
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Admins/super_admins can delete
CREATE POLICY "Admins can delete cn director briefs"
  ON public.cn_director_briefs
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- No insert policy for authenticated users — only service_role (edge functions) inserts.
