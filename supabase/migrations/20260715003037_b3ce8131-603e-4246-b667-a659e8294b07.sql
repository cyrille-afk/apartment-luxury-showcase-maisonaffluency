
-- 1. Columns
ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS era text
    CHECK (era IN ('pre_1950','mid_century','contemporary')),
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS facets_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS designers_era_idx ON public.designers(era);
CREATE INDEX IF NOT EXISTS designers_country_idx ON public.designers(country);

-- 2. Era backfill from biography years
WITH years AS (
  SELECT
    id,
    -- capture first 4-digit year that looks like a birth year:
    --   "(1895–1941)" / "(1895-1941)" / "born 1962" / "b. 1970"
    COALESCE(
      NULLIF((regexp_match(biography, '\((\d{4})\s*[–\-—]'))[1], '')::int,
      NULLIF((regexp_match(biography, '\bborn(?:\s+in)?\s+(\d{4})', 'i'))[1], '')::int,
      NULLIF((regexp_match(biography, '\bb\.\s*(\d{4})'))[1], '')::int
    ) AS birth_year
  FROM public.designers
)
UPDATE public.designers d
SET era = CASE
      WHEN y.birth_year IS NULL THEN 'contemporary'
      WHEN y.birth_year < 1900 THEN 'pre_1950'
      WHEN y.birth_year BETWEEN 1900 AND 1935 THEN 'mid_century'
      ELSE 'contemporary'
    END,
    facets_updated_at = now()
FROM years y
WHERE y.id = d.id
  AND d.era IS NULL;

-- 3. Country backfill from biography nationality keywords
UPDATE public.designers d
SET country = c.country,
    facets_updated_at = now()
FROM (
  SELECT id,
    CASE
      WHEN biography ~* '\bFrench\b|\bParis(ian)?\b' THEN 'France'
      WHEN biography ~* '\bItalian\b|\bItaly\b|\bMilan(ese)?\b' THEN 'Italy'
      WHEN biography ~* '\bBelgian\b|\bBelgium\b' THEN 'Belgium'
      WHEN biography ~* '\bBritish\b|\bEnglish\b|\bLondon-based\b|\bUnited Kingdom\b' THEN 'United Kingdom'
      WHEN biography ~* '\bAmerican\b|\bU\.S\.|\bUnited States\b|\bNew York-based\b' THEN 'United States'
      WHEN biography ~* '\bDutch\b|\bNetherlands\b|\bHolland\b' THEN 'Netherlands'
      WHEN biography ~* '\bSpanish\b|\bSpain\b' THEN 'Spain'
      WHEN biography ~* '\bJapanese\b|\bJapan\b' THEN 'Japan'
      WHEN biography ~* '\bBrazilian\b|\bBrazil\b' THEN 'Brazil'
      WHEN biography ~* '\bDanish\b|\bDenmark\b|\bCopenhagen-based\b' THEN 'Denmark'
      WHEN biography ~* '\bSwedish\b|\bSweden\b|\bStockholm-based\b' THEN 'Sweden'
      WHEN biography ~* '\bSwiss\b|\bSwitzerland\b' THEN 'Switzerland'
      WHEN biography ~* '\bGerman\b|\bGermany\b|\bBerlin-based\b' THEN 'Germany'
      WHEN biography ~* '\bArgentin(ian|e)\b|\bArgentina\b' THEN 'Argentina'
      WHEN biography ~* '\bMexican\b|\bMexico\b' THEN 'Mexico'
      WHEN biography ~* '\bAustrian\b|\bAustria\b|\bVienna-based\b' THEN 'Austria'
      WHEN biography ~* '\bCzech\b' THEN 'Czech Republic'
      WHEN biography ~* '\bSouth African\b' THEN 'South Africa'
      WHEN biography ~* '\bPortuguese\b|\bPortugal\b' THEN 'Portugal'
      WHEN biography ~* '\bAustralian\b|\bAustralia\b' THEN 'Australia'
      ELSE NULL
    END AS country
  FROM public.designers
) c
WHERE c.id = d.id
  AND c.country IS NOT NULL
  AND d.country IS NULL;
