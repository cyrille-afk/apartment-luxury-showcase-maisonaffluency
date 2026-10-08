-- Fix flag_offdomain_spec_sheet: plpgsql validates every NEW.<field> reference at
-- plan time, so the COALESCE over NEW.product_name / NEW.title crashed with
-- 'record "new" has no field ...' whenever the other table's trigger fired,
-- aborting the product save. Read the name via to_jsonb(NEW) instead, which is
-- record-shape agnostic. Also widen allowed hosts to the project's own storage
-- and Cloudinary, matching src/lib/specSheetUrl.ts.

CREATE OR REPLACE FUNCTION public.flag_offdomain_spec_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_urls jsonb := '[]'::jsonb;
  v_url text;
  v_bad jsonb := '[]'::jsonb;
  v_allowed text[] := ARRAY['maisonaffluency.com', 'www.maisonaffluency.com'];
  v_allowed_suffix text[] := ARRAY['.supabase.co', '.cloudinary.com'];
  v_host text;
  v_row jsonb;
  v_name text;
BEGIN
  v_row := to_jsonb(NEW);

  -- Collect candidate spec-sheet URLs from whichever columns the row has.
  IF TG_TABLE_NAME = 'trade_products' THEN
    IF NEW.spec_sheet_url IS NOT NULL AND btrim(NEW.spec_sheet_url) <> '' THEN
      v_urls := v_urls || to_jsonb(NEW.spec_sheet_url);
    END IF;
  ELSIF TG_TABLE_NAME = 'designer_curator_picks' THEN
    IF NEW.pdf_url IS NOT NULL AND btrim(NEW.pdf_url) <> '' THEN
      v_urls := v_urls || to_jsonb(NEW.pdf_url);
    END IF;
  END IF;

  IF NEW.pdf_urls IS NOT NULL AND jsonb_typeof(NEW.pdf_urls) = 'array' THEN
    FOR v_url IN
      SELECT COALESCE(elem->>'url', elem #>> '{}')
      FROM jsonb_array_elements(NEW.pdf_urls) AS elem
    LOOP
      IF v_url IS NOT NULL AND btrim(v_url) <> '' THEN
        v_urls := v_urls || to_jsonb(v_url);
      END IF;
    END LOOP;
  END IF;

  -- Flag any absolute http(s) URL whose host is not an allowed host.
  FOR v_url IN SELECT jsonb_array_elements_text(v_urls)
  LOOP
    IF v_url ~* '^https?://' THEN
      v_host := lower(split_part(split_part(v_url, '://', 2), '/', 1));
      v_host := split_part(v_host, ':', 1); -- strip port
      IF NOT (v_host = ANY (v_allowed))
         AND NOT (v_host LIKE '%' || v_allowed_suffix[1])
         AND NOT (v_host LIKE '%' || v_allowed_suffix[2]) THEN
        v_bad := v_bad || to_jsonb(v_url);
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_bad) > 0 THEN
    v_name := COALESCE(v_row->>'product_name', v_row->>'title');
    INSERT INTO public.content_audit_log (
      table_name, operation, record_id, changed_by, old_data, new_data
    ) VALUES (
      TG_TABLE_NAME,
      'spec_sheet_offdomain_flag',
      NEW.id,
      auth.uid(),
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      jsonb_build_object(
        'flagged_urls', v_bad,
        'allowed_hosts', to_jsonb(v_allowed),
        'product_name', v_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$;