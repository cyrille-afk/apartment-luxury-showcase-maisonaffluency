-- Flag any Trade Account spec-sheet link not hosted on maisonaffluency.com
-- whenever catalogue entries change. Flags are written to content_audit_log
-- with operation = 'spec_sheet_offdomain_flag'.

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
  v_host text;
BEGIN
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

  -- Flag any absolute http(s) URL whose host is not maisonaffluency.com.
  FOR v_url IN SELECT jsonb_array_elements_text(v_urls)
  LOOP
    IF v_url ~* '^https?://' THEN
      v_host := lower(split_part(split_part(v_url, '://', 2), '/', 1));
      v_host := split_part(v_host, ':', 1); -- strip port
      IF NOT (v_host = ANY (v_allowed)) THEN
        v_bad := v_bad || to_jsonb(v_url);
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_bad) > 0 THEN
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
        'product_name', COALESCE(
          CASE WHEN TG_TABLE_NAME = 'trade_products' THEN NEW.product_name END,
          CASE WHEN TG_TABLE_NAME = 'designer_curator_picks' THEN NEW.title END
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_offdomain_spec_sheet_trade ON public.trade_products;
CREATE TRIGGER trg_flag_offdomain_spec_sheet_trade
  AFTER INSERT OR UPDATE OF spec_sheet_url, pdf_urls ON public.trade_products
  FOR EACH ROW EXECUTE FUNCTION public.flag_offdomain_spec_sheet();

DROP TRIGGER IF EXISTS trg_flag_offdomain_spec_sheet_picks ON public.designer_curator_picks;
CREATE TRIGGER trg_flag_offdomain_spec_sheet_picks
  AFTER INSERT OR UPDATE OF pdf_url, pdf_urls ON public.designer_curator_picks
  FOR EACH ROW EXECUTE FUNCTION public.flag_offdomain_spec_sheet();