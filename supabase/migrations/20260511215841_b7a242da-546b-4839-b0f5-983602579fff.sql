-- Backfill clients from legacy client_name on trade_quotes and projects.
-- Strategy: for each distinct (studio_id, trim(client_name)), upsert a client row
-- (case-insensitive match on existing clients), then set client_id on the source rows.
-- client_name is preserved on the source rows for export fallback.

DO $$
DECLARE
  r RECORD;
  _client_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT
      sm.studio_id,
      btrim(src.client_name) AS name,
      src.user_id
    FROM (
      SELECT user_id, client_name FROM public.trade_quotes
        WHERE client_id IS NULL AND COALESCE(btrim(client_name),'') <> ''
      UNION ALL
      SELECT user_id, client_name FROM public.projects
        WHERE client_id IS NULL AND COALESCE(btrim(client_name),'') <> ''
    ) src
    JOIN public.studio_members sm ON sm.user_id = src.user_id
  LOOP
    SELECT id INTO _client_id
    FROM public.clients
    WHERE studio_id = r.studio_id AND lower(name) = lower(r.name)
    LIMIT 1;

    IF _client_id IS NULL THEN
      INSERT INTO public.clients (studio_id, created_by, name, type)
      VALUES (r.studio_id, r.user_id, r.name, 'company')
      RETURNING id INTO _client_id;
    END IF;

    UPDATE public.trade_quotes tq
      SET client_id = _client_id
      FROM public.studio_members sm
      WHERE tq.user_id = sm.user_id
        AND sm.studio_id = r.studio_id
        AND tq.client_id IS NULL
        AND lower(btrim(tq.client_name)) = lower(r.name);

    UPDATE public.projects p
      SET client_id = _client_id
      FROM public.studio_members sm
      WHERE p.user_id = sm.user_id
        AND sm.studio_id = r.studio_id
        AND p.client_id IS NULL
        AND lower(btrim(p.client_name)) = lower(r.name);
  END LOOP;
END $$;

-- Specific update for QU-A88A59: rename to "De Beers Jewellers Ltd" with billing
-- address and Margot Watson as the primary contact.
DO $$
DECLARE _cid uuid; _studio uuid := '8f16a389-f13c-487a-83a2-01b81639e7dd';
BEGIN
  SELECT client_id INTO _cid FROM public.trade_quotes
   WHERE id = 'a88a5941-dea2-414f-9378-9c0c028a3f37';

  IF _cid IS NOT NULL THEN
    UPDATE public.clients SET
      name = 'De Beers Jewellers Ltd',
      type = 'company',
      billing_address_line1 = '17 Charterhouse Street',
      billing_city = 'London',
      billing_postal_code = 'EC1N 6RA',
      billing_country = 'United Kingdom',
      default_currency = COALESCE(default_currency, 'GBP'),
      updated_at = now()
    WHERE id = _cid;

    -- Update the denormalized client_name on quote + project to match
    UPDATE public.trade_quotes SET client_name = 'De Beers Jewellers Ltd'
      WHERE client_id = _cid;
    UPDATE public.projects SET client_name = 'De Beers Jewellers Ltd'
      WHERE client_id = _cid;

    -- Insert primary contact if not present
    IF NOT EXISTS (
      SELECT 1 FROM public.client_contacts
       WHERE client_id = _cid AND lower(first_name)='margot' AND lower(last_name)='watson'
    ) THEN
      INSERT INTO public.client_contacts (client_id, first_name, last_name, is_primary)
      VALUES (_cid, 'Margot', 'Watson', true);
    END IF;
  END IF;
END $$;
