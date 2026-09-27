CREATE OR REPLACE FUNCTION public.get_shared_board_finishes(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.board_invites; _out jsonb;
BEGIN
  inv := public._board_invite_by_token(_token);
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_object_agg(x.product_id, x.data), '{}'::jsonb) INTO _out FROM (
    SELECT DISTINCT ON (tp.id) tp.id::text AS product_id, jsonb_build_object(
      'variants', coalesce((SELECT jsonb_agg(jsonb_build_object('top', v->>'top', 'base', v->>'base', 'label', v->>'label', 'price_cents', (v->>'price_cents')::numeric))
                   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.size_variants)='array' THEN p.size_variants ELSE '[]'::jsonb END) v
                   WHERE coalesce(v->>'top', v->>'base') IS NOT NULL), '[]'::jsonb),
      'variant_image_map', coalesce(p.variant_image_map, '{}'::jsonb),
      'gallery_images', coalesce(to_jsonb(p.gallery_images), '[]'::jsonb),
      'swatches', coalesce((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'image_url', s.image_url, 'category', s.category, 'price_tier_label', s.price_tier_label))
                   FROM public.product_fabric_swatches_public s WHERE s.pick_id = p.id AND s.is_active = true), '[]'::jsonb),
      'glbs', coalesce((SELECT jsonb_agg(jsonb_build_object('variant_label', g.variant_label, 'glb_url', g.glb_url, 'is_default', g.is_default, 'material_roles', g.material_roles))
                   FROM public.trade_product_glb_variants g WHERE g.product_id = tp.id), '[]'::jsonb),
      'currency', coalesce(tp.currency, 'EUR'),
      'lead', coalesce(tp.lead_time, CASE WHEN tp.lead_time_weeks_min IS NOT NULL THEN tp.lead_time_weeks_min || '–' || coalesce(tp.lead_time_weeks_max, tp.lead_time_weeks_min) || ' weeks' END)
    ) AS data
    FROM public.client_board_items bi
    JOIN public.trade_products tp ON tp.id = bi.product_id
    LEFT JOIN public.designer_curator_picks p ON p.id = tp.source_pick_id
    WHERE bi.board_id = inv.board_id
  ) x;
  RETURN _out;
END $$;
GRANT EXECUTE ON FUNCTION public.get_shared_board_finishes(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_board(_token text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
      'msrp_cents', nullif(tp.trade_price_cents, 0),
      'currency', coalesce(tp.currency, 'EUR'),
      'lead_time', coalesce(tp.lead_time,
         CASE WHEN tp.lead_time_weeks_min IS NOT NULL THEN tp.lead_time_weeks_min || '–' || coalesce(tp.lead_time_weeks_max, tp.lead_time_weeks_min) || ' weeks' END),
      'finish', nullif(concat_ws(' · ', bi.variant_label, bi.fabric_label, bi.wood_label), ''),
      'variant_label', bi.variant_label, 'fabric_label', bi.fabric_label, 'wood_label', bi.wood_label,
      'my_finish', (SELECT substring(f.comment from 18) FROM public.board_item_feedback f WHERE f.item_id = bi.id AND f.invite_id = inv.id AND f.comment LIKE 'Finish request: %' ORDER BY f.created_at DESC LIMIT 1),
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
    'role', inv.role, 'invite_email', inv.email,
    'claimed', inv.accepted_user_id IS NOT NULL,
    'items', _items);
END $function$;