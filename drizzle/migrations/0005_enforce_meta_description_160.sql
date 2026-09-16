-- Enforce the ≤160-char SEO meta limit at the database layer for every write path.
-- Trims at a sentence boundary when possible, else at a word boundary.

CREATE OR REPLACE FUNCTION public.trim_meta_description()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  clean text;
  windowed text;
  sent_end int;
  word_end int;
BEGIN
  IF NEW.meta_description IS NULL THEN
    RETURN NEW;
  END IF;
  clean := btrim(regexp_replace(NEW.meta_description, '\s+', ' ', 'g'));
  IF length(clean) <= 160 THEN
    NEW.meta_description := clean;
    RETURN NEW;
  END IF;
  windowed := left(clean, 160);
  -- Last sentence-ending punctuation followed by a space inside the window
  sent_end := greatest(
    length(windowed) - length(regexp_replace(windowed, '^.*\.\s', '')) ,
    length(windowed) - length(regexp_replace(windowed, '^.*!\s', '')),
    length(windowed) - length(regexp_replace(windowed, '^.*\?\s', ''))
  );
  -- positions computed above are 0 when no match; only accept a clean cut >= 40
  IF sent_end >= 40 THEN
    NEW.meta_description := btrim(left(windowed, sent_end));
    RETURN NEW;
  END IF;
  IF right(windowed, 1) = '.' THEN
    NEW.meta_description := windowed;
    RETURN NEW;
  END IF;
  word_end := length(windowed) - length(regexp_replace(windowed, '^.*\s', ''));
  IF word_end >= 40 THEN
    NEW.meta_description := rtrim(left(windowed, word_end), '.,;:!?—–-') || '…';
  ELSE
    NEW.meta_description := rtrim(windowed, '.,;:!?—–-') || '…';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trim_meta_description_curator
  BEFORE INSERT OR UPDATE OF meta_description ON public.designer_curator_picks
  FOR EACH ROW EXECUTE FUNCTION public.trim_meta_description();

CREATE TRIGGER trim_meta_description_trade
  BEFORE INSERT OR UPDATE OF meta_description ON public.trade_products
  FOR EACH ROW EXECUTE FUNCTION public.trim_meta_description();