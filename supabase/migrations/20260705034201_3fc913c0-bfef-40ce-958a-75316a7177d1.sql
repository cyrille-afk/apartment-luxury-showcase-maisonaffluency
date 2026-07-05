-- 1. Add canonical numeric lead-time columns
ALTER TABLE public.trade_products
  ADD COLUMN IF NOT EXISTS lead_time_weeks_min smallint,
  ADD COLUMN IF NOT EXISTS lead_time_weeks_max smallint;

COMMENT ON COLUMN public.trade_products.lead_time_weeks_min IS
  'Canonical minimum lead time in weeks. Prefer over lead_weeks_min_override (legacy) and free-text lead_time.';
COMMENT ON COLUMN public.trade_products.lead_time_weeks_max IS
  'Canonical maximum lead time in weeks. Prefer over lead_weeks_max_override (legacy) and free-text lead_time.';

-- 2. Backfill from existing override columns first (highest trust)
UPDATE public.trade_products
   SET lead_time_weeks_min = lead_weeks_min_override
 WHERE lead_time_weeks_min IS NULL
   AND lead_weeks_min_override IS NOT NULL;

UPDATE public.trade_products
   SET lead_time_weeks_max = lead_weeks_max_override
 WHERE lead_time_weeks_max IS NULL
   AND lead_weeks_max_override IS NOT NULL;

-- 3. Parse remaining rows from free-text lead_time
-- Handles: "10-16 weeks", "12 - 14 weeks", "12 weeks", "7 - 8 weeks",
--          "Ready to ship..." → 0, "in stock" → 0
DO $$
DECLARE
  r RECORD;
  s text;
  lo int;
  hi int;
  m text[];
BEGIN
  FOR r IN
    SELECT id, lead_time
      FROM public.trade_products
     WHERE lead_time IS NOT NULL
       AND lead_time <> ''
       AND (lead_time_weeks_min IS NULL OR lead_time_weeks_max IS NULL)
  LOOP
    s := lower(r.lead_time);
    lo := NULL;
    hi := NULL;

    IF s ~ 'ready to ship|in stock|available now|immediate' THEN
      lo := 0;
      hi := 0;
    ELSE
      -- Range: "10-16", "12 - 14", "7 – 8" (en-dash), "10 to 16"
      m := regexp_match(s, '(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})');
      IF m IS NOT NULL THEN
        lo := m[1]::int;
        hi := m[2]::int;
      ELSE
        -- Single number followed by "week"
        m := regexp_match(s, '(\d{1,3})\s*week');
        IF m IS NOT NULL THEN
          lo := m[1]::int;
          hi := m[1]::int;
        END IF;
      END IF;
    END IF;

    -- Sanity: cap at 104 weeks (2 years) to reject junk
    IF lo IS NOT NULL AND lo BETWEEN 0 AND 104
       AND hi IS NOT NULL AND hi BETWEEN 0 AND 104
       AND lo <= hi THEN
      UPDATE public.trade_products
         SET lead_time_weeks_min = COALESCE(lead_time_weeks_min, lo),
             lead_time_weeks_max = COALESCE(lead_time_weeks_max, hi)
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 4. Helpful index for filtered searches by max lead weeks
CREATE INDEX IF NOT EXISTS trade_products_lead_time_weeks_max_idx
  ON public.trade_products (lead_time_weeks_max)
  WHERE lead_time_weeks_max IS NOT NULL;