CREATE OR REPLACE FUNCTION public.get_shared_board(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inv public.board_invites; b public.client_boards; _items jsonb; _project_name text;
BEGIN
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO b FROM public.client_boards WHERE id = inv.board_id;
  SELECT name INTO _project_name FROM public.projects WHERE id = b.project_id;
  UPDATE public.board_invites SET last_seen_at = now() WHERE id = inv.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', bi.id, 'product_id', bi.product_id,
      'product_name', coalesce(tp.product_name, 'Selected piece'),
      'image_url', tp.image_url,
      'msrp_cents', coalesce(nullif(tp.trade_price_cents, 0), (
        SELECT round(qi.unit_price_cents / greatest(0.05, 1 - coalesce(public.tier_discount_pct(pr.trade_tier), 0.08)))::bigint
        FROM public.trade_quote_items qi JOIN public.trade_quotes q ON q.id = qi.quote_id
        LEFT JOIN public.profiles pr ON pr.id = q.user_id
        WHERE qi.id = bi.source_quote_item_id AND qi.unit_price_cents > 0)),
      'currency', coalesce(tp.currency, 'EUR'),
      'lead_time', coalesce(tp.lead_time,
         CASE WHEN tp.lead_time_weeks_min IS NOT NULL THEN tp.lead_time_weeks_min || '–' || coalesce(tp.lead_time_weeks_max, tp.lead_time_weeks_min) || ' weeks' END),
      'finish', nullif(concat_ws(' · ', bi.variant_label, bi.fabric_label, bi.wood_label), ''),
      'variant_label', bi.variant_label, 'fabric_label', bi.fabric_label, 'wood_label', bi.wood_label,
      'my_finish', (SELECT substring(f.comment from 17) FROM public.board_item_feedback f WHERE f.item_id = bi.id AND f.invite_id = inv.id AND f.comment LIKE 'Finish request: %' ORDER BY f.created_at DESC LIMIT 1),
      'my_comments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'comment', f.comment, 'created_at', f.created_at) ORDER BY f.created_at, f.id), '[]'::jsonb)
        FROM public.board_item_feedback f JOIN public.board_invites previous ON previous.id = f.invite_id
        WHERE f.item_id = bi.id AND f.board_id = inv.board_id AND previous.board_id = inv.board_id
          AND previous.role = inv.role AND lower(trim(previous.email)) = lower(trim(inv.email))
          AND f.comment IS NOT NULL),
      'approval_status', bi.approval_status,
      'my_reaction', (SELECT f.reaction FROM public.board_item_feedback f WHERE f.item_id = bi.id AND f.invite_id = inv.id AND f.reaction IS NOT NULL ORDER BY f.created_at DESC LIMIT 1)
    ) ORDER BY bi.sort_order), '[]'::jsonb)
  INTO _items
  FROM public.client_board_items bi LEFT JOIN public.trade_products tp ON tp.id = bi.product_id
  WHERE bi.board_id = b.id;
  RETURN jsonb_build_object(
    'board_title', b.title, 'project_name', _project_name, 'client_name', b.client_name,
    'studio_name', coalesce(b.studio_name, (SELECT name FROM public.studios WHERE id = b.studio_id), 'Your designer'),
    'studio_logo_url', coalesce(b.studio_logo_url, (SELECT logo_url FROM public.studios WHERE id = b.studio_id)),
    'hide_maison_branding', b.hide_maison_branding,
    'view_only', inv.view_only, 'role', inv.role, 'invite_email', inv.email,
    'claimed', inv.accepted_user_id IS NOT NULL,
    'items', _items);
END $function$;