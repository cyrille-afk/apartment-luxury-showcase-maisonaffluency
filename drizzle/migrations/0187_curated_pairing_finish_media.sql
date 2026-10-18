ALTER TABLE public.curated_pairing_rules ADD COLUMN IF NOT EXISTS finish_media jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE OR REPLACE FUNCTION public.validate_pairing_finish_media() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry jsonb; url text;
BEGIN
 IF jsonb_typeof(NEW.finish_media) <> 'array' OR jsonb_array_length(NEW.finish_media)>100 THEN RAISE EXCEPTION 'Finish media must contain at most 100 assignments'; END IF;
 IF jsonb_array_length(NEW.finish_media)>0 AND NEW.preferred_pick_id IS NULL THEN RAISE EXCEPTION 'Finish media requires a preferred product'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.finish_media) e GROUP BY e->>'key' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate finish image assignment'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.finish_media) LOOP
 IF jsonb_typeof(entry)<>'object' OR length(COALESCE(entry->>'key','')) NOT BETWEEN 1 AND 800 OR length(COALESCE(entry->>'label','')) NOT BETWEEN 1 AND 800 THEN RAISE EXCEPTION 'Invalid finish image assignment'; END IF;
 FOREACH url IN ARRAY ARRAY[entry->>'product_image_url',entry->>'macro_image_url'] LOOP
 IF url IS NOT NULL AND (length(url)>2048 OR url !~ '^https://[^/[:space:]]+/[^[:space:]]+$') THEN RAISE EXCEPTION 'Finish images require absolute HTTPS URLs'; END IF;
 END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_pairing_finish_media BEFORE INSERT OR UPDATE ON public.curated_pairing_rules FOR EACH ROW EXECUTE FUNCTION public.validate_pairing_finish_media();