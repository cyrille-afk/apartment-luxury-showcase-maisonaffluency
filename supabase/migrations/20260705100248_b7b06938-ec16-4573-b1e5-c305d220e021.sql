
-- 1. Extend inquiries
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS designer_name TEXT,
  ADD COLUMN IF NOT EXISTS concierge_lead_id UUID UNIQUE REFERENCES public.concierge_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS linked_quote_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Broaden source values now that we track more origins.
-- (No CHECK constraint — status/source values evolve.)

CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON public.inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_product_id ON public.inquiries (product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_source ON public.inquiries (source);

-- 2. Extend trade_quotes
ALTER TABLE public.trade_quotes
  ADD COLUMN IF NOT EXISTS quote_kind TEXT NOT NULL DEFAULT 'trade',
  ADD COLUMN IF NOT EXISTS source_inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_quotes_source_inquiry ON public.trade_quotes (source_inquiry_id);

-- FK from inquiries.linked_quote_id back to trade_quotes (deferred so both columns exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inquiries_linked_quote_fk'
  ) THEN
    ALTER TABLE public.inquiries
      ADD CONSTRAINT inquiries_linked_quote_fk
      FOREIGN KEY (linked_quote_id) REFERENCES public.trade_quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Auto-bridge concierge_leads → inquiries when a lead has an email in signals
CREATE OR REPLACE FUNCTION public.bridge_concierge_lead_to_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_company TEXT;
  v_product_name TEXT;
  v_designer_name TEXT;
BEGIN
  -- Only bridge qualified leads
  IF NEW.qualified_score < 40 THEN
    RETURN NEW;
  END IF;

  -- Try to extract email from signals JSON — accept common shapes
  BEGIN
    v_email := COALESCE(
      NEW.signals->>'email',
      (NEW.signals->'contact'->>'email'),
      (NEW.signals->'lead'->>'email')
    );
    v_phone := COALESCE(
      NEW.signals->>'phone',
      (NEW.signals->'contact'->>'phone')
    );
    v_company := COALESCE(
      NEW.signals->>'company',
      NEW.signals->>'firm',
      NEW.signals->>'studio'
    );
    v_product_name := COALESCE(
      NEW.signals->>'product',
      NEW.signals->>'product_name',
      (NEW.signals->'product'->>'name')
    );
    v_designer_name := COALESCE(
      NEW.signals->>'designer',
      NEW.signals->>'designer_name',
      (NEW.signals->'designer'->>'name')
    );
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inquiries (
    name, company, email, phone, message,
    source, concierge_lead_id,
    product_name, designer_name,
    status, user_agent
  ) VALUES (
    COALESCE(NEW.name, 'Concierge visitor'),
    v_company,
    v_email,
    v_phone,
    COALESCE(NEW.first_message, ''),
    'concierge_lead',
    NEW.id,
    v_product_name,
    v_designer_name,
    'new',
    NEW.user_agent
  )
  ON CONFLICT (concierge_lead_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_concierge_lead_to_inquiry ON public.concierge_leads;
CREATE TRIGGER trg_bridge_concierge_lead_to_inquiry
  AFTER INSERT OR UPDATE OF qualified_score, signals ON public.concierge_leads
  FOR EACH ROW EXECUTE FUNCTION public.bridge_concierge_lead_to_inquiry();
