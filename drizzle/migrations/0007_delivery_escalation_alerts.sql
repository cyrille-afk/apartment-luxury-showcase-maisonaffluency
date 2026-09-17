-- Amber -> Red delivery escalation: shared status helpers + in-app notifications

CREATE OR REPLACE FUNCTION public.parse_lead_weeks(p_text text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN p_text ~ '(\d+)\s*(?:-|–|—|to)\s*(\d+)'
      THEN ((regexp_match(p_text, '(\d+)\s*(?:-|–|—|to)\s*(\d+)'))[2])::int
    WHEN p_text ~ '\d+'
      THEN ((regexp_match(p_text, '(\d+)'))[1])::int
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.trade_expected_ready(
  p_actual timestamptz,
  p_estimated timestamptz,
  p_deposit timestamptz,
  p_shipping_weeks integer,
  p_quote_created timestamptz,
  p_lead_weeks integer
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_anchor timestamptz;
BEGIN
  IF p_actual IS NOT NULL THEN RETURN p_actual; END IF;
  IF p_estimated IS NOT NULL THEN RETURN p_estimated; END IF;
  v_anchor := COALESCE(p_deposit, p_quote_created);
  IF v_anchor IS NULL OR p_lead_weeks IS NULL THEN RETURN NULL; END IF;
  RETURN v_anchor + ((p_lead_weeks + COALESCE(p_shipping_weeks, 0)) * INTERVAL '7 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.trade_slack_days(p_required_by date, p_expected timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_required_by IS NULL OR p_expected IS NULL THEN NULL
    ELSE ROUND(EXTRACT(EPOCH FROM (p_required_by::timestamptz - p_expected)) / 86400.0)::int
  END
$$;

-- Current expected-ready / slack for a single quote line (used by the email hook).
CREATE OR REPLACE FUNCTION public.trade_item_delivery_status(p_item_id uuid)
RETURNS TABLE (expected timestamptz, slack integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_tl record;
  v_quote_created timestamptz;
  v_lead integer;
  v_expected timestamptz;
BEGIN
  SELECT i.id, i.quote_id, i.required_by_date, i.lead_time_weeks_override, p.lead_time
    INTO v_item
    FROM public.trade_quote_items i
    LEFT JOIN public.trade_products p ON p.id = i.product_id
   WHERE i.id = p_item_id;
  IF v_item IS NULL THEN RETURN; END IF;

  SELECT created_at INTO v_quote_created FROM public.trade_quotes WHERE id = v_item.quote_id;
  SELECT actual_delivery_at, estimated_delivery_at, deposit_paid_at, shipping_weeks
    INTO v_tl FROM public.order_timeline WHERE quote_id = v_item.quote_id LIMIT 1;

  v_lead := COALESCE(v_item.lead_time_weeks_override, public.parse_lead_weeks(v_item.lead_time));
  v_expected := public.trade_expected_ready(
    v_tl.actual_delivery_at, v_tl.estimated_delivery_at, v_tl.deposit_paid_at, v_tl.shipping_weeks,
    v_quote_created, v_lead);

  expected := v_expected;
  slack := public.trade_slack_days(v_item.required_by_date, v_expected);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trade_item_delivery_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parse_lead_weeks(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trade_expected_ready(timestamptz, timestamptz, timestamptz, integer, timestamptz, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trade_slack_days(date, timestamptz) TO authenticated, service_role;

-- Emits in-app notifications for the procurement team on an Amber -> Red transition.
CREATE OR REPLACE FUNCTION public.trade_emit_delivery_escalation(
  p_item_id uuid,
  p_old_slack integer,
  p_new_slack integer,
  p_old_expected timestamptz,
  p_new_expected timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_quote record;
  v_product record;
  v_recipients uuid[];
  v_uid uuid;
  v_link text;
  v_label text;
BEGIN
  SELECT * INTO v_item FROM public.trade_quote_items WHERE id = p_item_id;
  IF v_item IS NULL THEN RETURN; END IF;
  SELECT * INTO v_quote FROM public.trade_quotes WHERE id = v_item.quote_id;
  IF v_quote IS NULL THEN RETURN; END IF;
  SELECT product_name, brand_name INTO v_product
    FROM public.trade_products WHERE id = v_item.product_id;

  -- Do not re-alert on the same line within 24 hours.
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'delivery_escalation'
      AND metadata->>'item_id' = p_item_id::text
      AND created_at > now() - INTERVAL '24 hours'
  ) THEN
    RETURN;
  END IF;

  v_recipients := ARRAY(
    SELECT DISTINCT u FROM (
      SELECT v_quote.user_id AS u
      UNION
      SELECT sm.user_id FROM public.studio_members sm
        WHERE v_quote.studio_id IS NOT NULL
          AND sm.studio_id = v_quote.studio_id
          AND sm.role IN ('owner', 'admin', 'editor')
    ) s WHERE u IS NOT NULL
  );

  IF array_length(v_recipients, 1) IS NULL THEN RETURN; END IF;

  v_link := '/trade/delivery-tracker?item=' || p_item_id::text || '&quote=' || v_item.quote_id::text;
  v_label := 'Urgent: ' || COALESCE(v_product.product_name, 'Item')
    || CASE WHEN COALESCE(v_product.brand_name, '') <> '' THEN ' by ' || v_product.brand_name ELSE '' END
    || ' is now marked LATE. Click to view tracker.';

  FOREACH v_uid IN ARRAY v_recipients LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_uid,
      'delivery_escalation',
      v_label,
      'Required by ' || COALESCE(v_item.required_by_date::text, '—')
        || ' · expected ' || COALESCE(to_char(p_new_expected, 'DD Mon YYYY'), '—')
        || ' · ' || COALESCE(ABS(p_new_slack)::text, '0') || ' days overdue.',
      v_link,
      jsonb_build_object(
        'item_id', p_item_id,
        'quote_id', v_item.quote_id,
        'product_name', v_product.product_name,
        'brand_name', v_product.brand_name,
        'quantity', v_item.quantity,
        'old_slack', p_old_slack,
        'new_slack', p_new_slack,
        'previous_expected', p_old_expected,
        'new_expected', p_new_expected,
        'status', 'late',
        'action_label', 'View tracker',
        'action_link', v_link
      )
    );
  END LOOP;
END;
$$;

-- Trigger 1: REQUIRED BY / lead-time override changes on a quote line.
CREATE OR REPLACE FUNCTION public.trg_quote_item_delivery_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tl record;
  v_quote_created timestamptz;
  v_product_lead text;
  v_old_expected timestamptz;
  v_new_expected timestamptz;
  v_old_slack integer;
  v_new_slack integer;
BEGIN
  SELECT created_at INTO v_quote_created FROM public.trade_quotes WHERE id = NEW.quote_id;
  SELECT lead_time INTO v_product_lead FROM public.trade_products WHERE id = NEW.product_id;
  SELECT actual_delivery_at, estimated_delivery_at, deposit_paid_at, shipping_weeks
    INTO v_tl FROM public.order_timeline WHERE quote_id = NEW.quote_id LIMIT 1;

  v_old_expected := public.trade_expected_ready(
    v_tl.actual_delivery_at, v_tl.estimated_delivery_at, v_tl.deposit_paid_at, v_tl.shipping_weeks,
    v_quote_created, COALESCE(OLD.lead_time_weeks_override, public.parse_lead_weeks(v_product_lead)));
  v_new_expected := public.trade_expected_ready(
    v_tl.actual_delivery_at, v_tl.estimated_delivery_at, v_tl.deposit_paid_at, v_tl.shipping_weeks,
    v_quote_created, COALESCE(NEW.lead_time_weeks_override, public.parse_lead_weeks(v_product_lead)));

  v_old_slack := public.trade_slack_days(OLD.required_by_date, v_old_expected);
  v_new_slack := public.trade_slack_days(NEW.required_by_date, v_new_expected);

  IF v_old_slack IS NOT NULL AND v_new_slack IS NOT NULL
     AND v_old_slack >= 0 AND v_old_slack <= 14 AND v_new_slack < 0 THEN
    PERFORM public.trade_emit_delivery_escalation(NEW.id, v_old_slack, v_new_slack, v_old_expected, v_new_expected);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_quote_item_delivery_escalation ON public.trade_quote_items;
CREATE TRIGGER trade_quote_item_delivery_escalation
AFTER UPDATE OF required_by_date, lead_time_weeks_override ON public.trade_quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_quote_item_delivery_escalation();

-- Trigger 2: EXPECTED READY changes on the order timeline (affects every line of the quote).
CREATE OR REPLACE FUNCTION public.trg_order_timeline_delivery_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_created timestamptz;
  v_item record;
  v_lead integer;
  v_old_expected timestamptz;
  v_new_expected timestamptz;
  v_old_slack integer;
  v_new_slack integer;
BEGIN
  SELECT created_at INTO v_quote_created FROM public.trade_quotes WHERE id = NEW.quote_id;

  FOR v_item IN
    SELECT i.id, i.required_by_date, i.lead_time_weeks_override, p.lead_time
    FROM public.trade_quote_items i
    LEFT JOIN public.trade_products p ON p.id = i.product_id
    WHERE i.quote_id = NEW.quote_id AND i.required_by_date IS NOT NULL
  LOOP
    v_lead := COALESCE(v_item.lead_time_weeks_override, public.parse_lead_weeks(v_item.lead_time));
    v_old_expected := public.trade_expected_ready(
      OLD.actual_delivery_at, OLD.estimated_delivery_at, OLD.deposit_paid_at, OLD.shipping_weeks,
      v_quote_created, v_lead);
    v_new_expected := public.trade_expected_ready(
      NEW.actual_delivery_at, NEW.estimated_delivery_at, NEW.deposit_paid_at, NEW.shipping_weeks,
      v_quote_created, v_lead);

    v_old_slack := public.trade_slack_days(v_item.required_by_date, v_old_expected);
    v_new_slack := public.trade_slack_days(v_item.required_by_date, v_new_expected);

    IF v_old_slack IS NOT NULL AND v_new_slack IS NOT NULL
       AND v_old_slack >= 0 AND v_old_slack <= 14 AND v_new_slack < 0 THEN
      PERFORM public.trade_emit_delivery_escalation(v_item.id, v_old_slack, v_new_slack, v_old_expected, v_new_expected);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_timeline_delivery_escalation ON public.order_timeline;
CREATE TRIGGER order_timeline_delivery_escalation
AFTER UPDATE OF estimated_delivery_at, actual_delivery_at, deposit_paid_at, shipping_weeks ON public.order_timeline
FOR EACH ROW EXECUTE FUNCTION public.trg_order_timeline_delivery_escalation();