UPDATE designer_curator_picks
SET pdf_url = (pdf_urls->>0)::text
WHERE pdf_url IS NULL
  AND pdf_urls IS NOT NULL
  AND jsonb_array_length(pdf_urls) > 0;