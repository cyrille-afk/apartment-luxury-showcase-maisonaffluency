CREATE OR REPLACE FUNCTION public.client_change_quote_finish(_slug text, _session text, _line integer, _choice text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  s public.quote_client_shares;
  ln jsonb; ch jsonb; item public.trade_quote_items; q public.trade_quotes;
  new_unit bigint; old_retail bigint; new_retail bigint; lines jsonb; snap jsonb;
BEGIN
  SELECT sh.* INTO s FROM public.quote_access_sessions a JOIN public.quote_client_shares sh ON sh.id=a.share_id
   WHERE a.token_hash=encode(digest(coalesce(_session,''),'sha256'),'hex') AND a.expires_at>now()
     AND sh.public_slug=_slug AND sh.revoked_at IS NULL AND sh.expires_at>now()
   FOR UPDATE OF sh;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  ln := s.snapshot->'lines'->_line;
  IF ln IS NULL OR coalesce(ln->>'itemId','')='' THEN RAISE EXCEPTION 'not changeable'; END IF;
  SELECT c INTO ch FROM jsonb_array_elements(coalesce(ln->'finishChoices','[]'::jsonb)) c WHERE c->>'key'=_choice LIMIT 1;
  IF ch IS NULL THEN RAISE EXCEPTION 'unknown finish'; END IF;
  SELECT * INTO item FROM public.trade_quote_items WHERE id=(ln->>'itemId')::uuid AND quote_id=s.quote_id FOR UPDATE;
  IF item.id IS NULL THEN RAISE EXCEPTION 'line missing'; END IF;
  SELECT * INTO q FROM public.trade_quotes WHERE id=s.quote_id;

  old_retail := nullif(ln->>'unitCents','')::bigint;
  new_retail := nullif(ch->>'unitCents','')::bigint;
  new_unit := item.unit_price_cents;
  IF new_retail IS NOT NULL AND new_retail>0 THEN
    IF old_retail IS NOT NULL AND old_retail>0 AND item.unit_price_cents IS NOT NULL THEN
      new_unit := round(item.unit_price_cents::numeric * new_retail / old_retail);
    ELSIF upper(coalesce(item.unit_price_currency,''))=upper(coalesce(ch->>'currency','')) THEN
      new_unit := new_retail;
    END IF;
  END IF;

  UPDATE public.trade_quote_items SET
    variant_label = ch->>'variantLabel',
    wood_fabric_id = coalesce(nullif(ch->>'fabricId','')::uuid, wood_fabric_id),
    unit_price_cents = new_unit
  WHERE id=item.id;

  ln := ln || jsonb_build_object(
    'selectedFinishKey', ch->>'key',
    'clientChanged', (ch->>'key') IS DISTINCT FROM (ln->>'designerFinishKey'),
    'finish', ch->>'name',
    'finishSwatches', jsonb_build_array(jsonb_build_object('name', ch->>'name', 'image', ch->'image')),
    'unitCents', ch->'unitCents',
    'currency', ch->'currency',
    'lineTotalCents', CASE WHEN new_retail IS NULL THEN 'null'::jsonb ELSE to_jsonb(new_retail * coalesce((ln->>'quantity')::bigint,0)) END);
  lines := jsonb_set(s.snapshot->'lines', ARRAY[_line::text], ln);
  snap := s.snapshot || jsonb_build_object('lines', lines,
    'totals', coalesce((SELECT jsonb_agg(jsonb_build_object('currency', cur, 'cents', cents)) FROM (
        SELECT l->>'currency' cur, sum((l->>'lineTotalCents')::bigint) cents FROM jsonb_array_elements(lines) l
        WHERE nullif(l->>'lineTotalCents','') IS NOT NULL AND l->>'lineTotalCents'<>'null' GROUP BY 1) t), '[]'::jsonb),
    'unpricedCount', (SELECT count(*) FROM jsonb_array_elements(lines) l WHERE l->'lineTotalCents' IS NULL OR l->'lineTotalCents'='null'::jsonb));
  UPDATE public.quote_client_shares SET snapshot=snap WHERE id=s.id;

  IF q.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, message, link, metadata)
    VALUES (q.user_id, 'quote_client_finish_change', 'Client changed a finish',
      coalesce(ln->>'name','A piece') || ' — client chose ' || (ch->>'name') || ' on QU-' || upper(left(s.quote_id::text,6)),
      '/trade/quotes', jsonb_build_object('quote_id', s.quote_id, 'item_id', item.id, 'finish', ch->>'name'));
  END IF;
  RETURN snap || jsonb_build_object('shared_at', s.created_at, 'expires_at', s.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.client_change_quote_finish(text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_change_quote_finish(text, text, integer, text) TO service_role;