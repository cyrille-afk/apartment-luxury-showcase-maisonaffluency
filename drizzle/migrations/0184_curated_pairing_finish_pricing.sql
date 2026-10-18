CREATE FUNCTION public.valid_pairing_finish_options(options jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE option jsonb; seen text[] := ARRAY[]::text[]; option_key text;
BEGIN
 IF jsonb_typeof(options) <> 'array' OR jsonb_array_length(options) > 50 THEN RETURN false; END IF;
 FOR option IN SELECT value FROM jsonb_array_elements(options) LOOP
  IF jsonb_typeof(option) <> 'object' OR jsonb_typeof(option->'id') IS DISTINCT FROM 'string' OR length(option->>'id') NOT BETWEEN 1 AND 80 OR jsonb_typeof(option->'name') IS DISTINCT FROM 'string' OR length(trim(option->>'name')) NOT BETWEEN 1 AND 160 THEN RETURN false; END IF;
  option_key := option->>'id'; IF option_key = ANY(seen) THEN RETURN false; END IF; seen := array_append(seen, option_key);
  IF option->'price_cents' IS DISTINCT FROM 'null'::jsonb THEN
   IF jsonb_typeof(option->'price_cents') IS DISTINCT FROM 'number' OR (option->>'price_cents')::numeric <= 0 OR (option->>'price_cents')::numeric > 1000000000 OR trunc((option->>'price_cents')::numeric) <> (option->>'price_cents')::numeric THEN RETURN false; END IF;
  END IF;
  IF NOT (option ? 'price_cents') THEN RETURN false; END IF;
 END LOOP; RETURN true;
END $$;
ALTER TABLE public.curated_pairing_rules ADD COLUMN finish_options jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN finish_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.curated_pairing_rules ADD CONSTRAINT pairing_finish_options_valid CHECK (public.valid_pairing_finish_options(finish_options)), ADD CONSTRAINT pairing_finish_currency_valid CHECK (finish_currency IN ('USD','EUR','GBP','SGD','HKD','CHF','AED','AUD','CAD','JPY')), ADD CONSTRAINT pairing_finishes_require_piece CHECK (jsonb_array_length(finish_options)=0 OR preferred_pick_id IS NOT NULL);
COMMENT ON COLUMN public.curated_pairing_rules.finish_options IS 'Explicit public retail finish configurations for the preferred recommended piece. Empty array retains catalogue defaults; null price means Price upon Request. Never stores trade/net pricing.';
COMMENT ON COLUMN public.curated_pairing_rules.finish_currency IS 'Source currency of pairing-specific public retail finish prices.';