ALTER TABLE public.viewing_room_proposal_requests
  ADD COLUMN IF NOT EXISTS share_token text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS axonometric_render_url text,
  ADD COLUMN IF NOT EXISTS walkthrough_url text,
  ADD COLUMN IF NOT EXISTS walkthrough_layout_id uuid REFERENCES public.ai_curated_layouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visualiser_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS visualiser_published_by uuid;

GRANT SELECT, UPDATE ON public.viewing_room_proposal_requests TO authenticated;
GRANT ALL ON public.viewing_room_proposal_requests TO service_role;

DROP POLICY IF EXISTS "admin_requests_update" ON public.viewing_room_proposal_requests;
CREATE POLICY "admin_requests_update"
  ON public.viewing_room_proposal_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.lock_viewing_room_proposal(_token text, _package_id uuid, _choices jsonb, _request_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  data jsonb;
  p public.furniture_packages;
  slot jsonb;
  choice jsonb;
  selected jsonb;
  finish jsonb;
  colourway jsonb;
  axis_pick record;
  lines jsonb := '[]';
  total numeric;
  result jsonb;
  existing_row public.viewing_room_proposal_requests;
BEGIN
  data := public.get_viewing_room_personalization(_token, _package_id);
  IF data IS NULL THEN RAISE EXCEPTION 'Viewing room unavailable'; END IF;
  SELECT * INTO p FROM public.furniture_packages WHERE id = _package_id;
  IF jsonb_typeof(_choices) IS DISTINCT FROM 'array' OR jsonb_array_length(_choices) <> jsonb_array_length(data->'items') THEN
    RAISE EXCEPTION 'Choose every slot';
  END IF;

  SELECT * INTO existing_row
  FROM public.viewing_room_proposal_requests
  WHERE request_key = _request_key AND package_id = p.id;
  IF FOUND THEN
    RETURN existing_row.snapshot || jsonb_build_object(
      'proposal_id', existing_row.id,
      'share_token', existing_row.share_token,
      'axonometric_render_url', existing_row.axonometric_render_url,
      'walkthrough_url', existing_row.walkthrough_url
    );
  END IF;

  total := p.package_price;
  FOR slot IN SELECT value FROM jsonb_array_elements(data->'items') LOOP
    IF (SELECT count(*) FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id' = slot->>'id') <> 1 THEN
      RAISE EXCEPTION 'Invalid slot';
    END IF;
    SELECT c INTO choice FROM jsonb_array_elements(_choices) c WHERE c->>'slot_id' = slot->>'id';
    selected := slot;
    IF choice->>'product_id' IS DISTINCT FROM slot->>'id' THEN
      IF NOT (slot->>'is_swappable')::boolean THEN RAISE EXCEPTION 'Selection fixed'; END IF;
      SELECT a INTO selected FROM jsonb_array_elements(slot->'alternatives') a WHERE a->>'id' = choice->>'product_id';
      IF selected IS NULL OR selected->>'retail_price' IS NULL OR slot->>'retail_price' IS NULL THEN
        RAISE EXCEPTION 'Unapproved choice';
      END IF;
    END IF;
    IF choice->>'finish_key' IS NOT NULL THEN
      IF NOT (slot->>'allow_finish_customization')::boolean THEN RAISE EXCEPTION 'Finish fixed'; END IF;
      SELECT f INTO finish FROM jsonb_array_elements(selected->'finish_options') f WHERE f->>'key' = choice->>'finish_key';
      IF finish IS NULL OR slot->>'retail_price' IS NULL THEN RAISE EXCEPTION 'Unapproved finish'; END IF;
      IF finish->>'size_key' IS DISTINCT FROM choice->>'size_key' THEN RAISE EXCEPTION 'Unapproved size'; END IF;
      IF choice->>'colourway_id' IS NOT NULL THEN
        SELECT w INTO colourway FROM jsonb_array_elements(coalesce(finish->'colourways', '[]'::jsonb)) w WHERE w->>'id' = choice->>'colourway_id';
        IF colourway IS NULL THEN RAISE EXCEPTION 'Unapproved colourway'; END IF;
        finish := finish || jsonb_build_object('materials', coalesce(finish->'materials', '{}'::jsonb) || CASE
          WHEN coalesce(colourway->>'category', '') !~* 'fabric|leather|upholster' AND NOT (coalesce(finish->'materials', '{}'::jsonb) ? 'upholstery') AND (coalesce(finish->'materials', '{}'::jsonb) ? 'top' OR coalesce(finish->'materials', '{}'::jsonb) ? 'base')
            THEN CASE WHEN (finish->'materials' ? 'top') AND (finish->'materials' ? 'base') THEN jsonb_build_object('top', colourway, 'base', colourway)
                      WHEN finish->'materials' ? 'top' THEN jsonb_build_object('top', colourway)
                      ELSE jsonb_build_object('base', colourway) END
          ELSE jsonb_build_object('upholstery', colourway)
        END);
      END IF;
      IF jsonb_typeof(choice->'axis_colours') = 'object' THEN
        FOR axis_pick IN SELECT key, value FROM jsonb_each_text(choice->'axis_colours') LOOP
          SELECT w INTO colourway FROM jsonb_array_elements(coalesce(finish->'axes', '[]'::jsonb)) a, jsonb_array_elements(a->'colours') w WHERE a->>'role' = axis_pick.key AND w->>'id' = axis_pick.value;
          IF colourway IS NULL THEN RAISE EXCEPTION 'Unapproved colourway'; END IF;
          finish := finish || jsonb_build_object('materials', coalesce(finish->'materials', '{}'::jsonb) || jsonb_build_object(CASE axis_pick.key WHEN 'seat' THEN 'upholstery' WHEN 'frame' THEN 'base' ELSE 'backrest' END, colourway));
        END LOOP;
      END IF;
      selected := selected || (finish - 'colourways' - 'axes') || jsonb_build_object('finish_key', finish->>'key', 'retail_price_from', false);
    ELSIF choice->>'size_key' IS NOT NULL OR choice->>'colourway_id' IS NOT NULL OR choice ? 'axis_colours' THEN
      RAISE EXCEPTION 'Choose size finish';
    END IF;
    total := total + coalesce((selected->>'retail_price')::numeric - (slot->>'retail_price')::numeric, 0);
    lines := lines || jsonb_build_array((selected - 'alternatives' - 'finish_options' - 'size_options') || jsonb_build_object('slot_id', slot->>'id'));
  END LOOP;

  result := jsonb_build_object('package', p.tier_name, 'currency', p.currency, 'total', total, 'items', lines, 'status', 'requested');
  INSERT INTO public.viewing_room_proposal_requests(package_id, request_key, snapshot)
  VALUES (p.id, _request_key, result)
  ON CONFLICT (request_key) DO NOTHING
  RETURNING * INTO existing_row;

  IF NOT FOUND THEN
    SELECT * INTO existing_row
    FROM public.viewing_room_proposal_requests
    WHERE request_key = _request_key AND package_id = p.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
  END IF;

  RETURN existing_row.snapshot || jsonb_build_object(
    'proposal_id', existing_row.id,
    'share_token', existing_row.share_token,
    'axonometric_render_url', existing_row.axonometric_render_url,
    'walkthrough_url', existing_row.walkthrough_url
  );
END $function$;

CREATE OR REPLACE FUNCTION public.get_shared_viewing_room_proposal(_share_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF _share_token IS NULL OR length(btrim(_share_token)) < 16 OR length(_share_token) > 128 THEN
    RETURN NULL;
  END IF;
  SELECT
    r.id AS proposal_id,
    r.created_at AS locked_at,
    r.share_token,
    r.snapshot,
    r.axonometric_render_url,
    r.walkthrough_url,
    r.visualiser_published_at,
    fp.tier_name,
    fp.currency,
    fp.lead_time_weeks,
    rl.name AS residence_name,
    rl.floorplan_url,
    rl.specs_label,
    d.developer_name,
    d.developer_logo_url,
    d.hero_image_url
  INTO rec
  FROM public.viewing_room_proposal_requests r
  JOIN public.furniture_packages fp ON fp.id = r.package_id
  JOIN public.residence_layouts rl ON rl.id = fp.residence_layout_id
  JOIN public.developer_projects d ON d.id = rl.developer_project_id
  WHERE r.share_token = btrim(_share_token);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'proposal_id', rec.proposal_id,
    'locked_at', rec.locked_at,
    'share_token', rec.share_token,
    'developer', jsonb_build_object(
      'name', rec.developer_name,
      'logo', rec.developer_logo_url,
      'hero', rec.hero_image_url
    ),
    'residence', jsonb_build_object(
      'name', rec.residence_name,
      'floorplan_url', rec.floorplan_url,
      'specs_label', rec.specs_label
    ),
    'package', jsonb_build_object(
      'tier_name', rec.tier_name,
      'currency', rec.currency,
      'lead_time_weeks', rec.lead_time_weeks
    ),
    'snapshot', rec.snapshot,
    'axonometric_render_url', rec.axonometric_render_url,
    'walkthrough_url', rec.walkthrough_url,
    'visualiser_published_at', rec.visualiser_published_at
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_shared_viewing_room_proposal(text) TO anon, authenticated;