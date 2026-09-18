ALTER TABLE public.trade_quotes
ADD COLUMN IF NOT EXISTS client_pdf_download_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS trade_quotes_client_pdf_download_token_key
ON public.trade_quotes (client_pdf_download_token);