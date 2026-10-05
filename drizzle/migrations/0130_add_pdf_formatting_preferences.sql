ALTER TABLE public.studios
  ADD COLUMN pdf_locale text NOT NULL DEFAULT 'en-GB';

ALTER TABLE public.studios
  ADD CONSTRAINT studios_pdf_locale_allowed
  CHECK (pdf_locale IN ('en-GB', 'en-US', 'en-SG', 'iso'));

ALTER TABLE public.trade_quotes
  ADD COLUMN pdf_locale text;

ALTER TABLE public.trade_quotes
  ADD CONSTRAINT trade_quotes_pdf_locale_allowed
  CHECK (pdf_locale IS NULL OR pdf_locale IN ('en-GB', 'en-US', 'en-SG', 'iso'));

COMMENT ON COLUMN public.studios.pdf_locale IS 'Studio-wide locale and date preset for generated trade PDFs; monetary values always use two decimals.';
COMMENT ON COLUMN public.trade_quotes.pdf_locale IS 'Optional per-proforma locale/date preset override; NULL inherits the studio default.';