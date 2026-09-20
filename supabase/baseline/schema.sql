-- =====================================================================
-- Maison Affluency — definitive baseline schema (public schema)
--
-- Generated with: scripts/db-baseline.sh   (pg_dump --schema-only)
-- This file is a SNAPSHOT of the live database structure: tables,
-- columns, constraints, indexes, enums, views, functions, triggers,
-- RLS state, policies and grants.
--
-- It is NOT applied by the migration runner. It exists so a fresh
-- environment (local test database, CI, staging clone) can be created
-- in one shot instead of replaying the whole migration history:
--
--   psql "$TARGET_DB_URL" -f supabase/baseline/schema.sql
--
-- Not included (Supabase-managed, recreate separately):
--   auth/storage/realtime schemas, storage buckets, cron jobs,
--   edge-function secrets, data rows.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

--
-- PostgreSQL database dump
--

\restrict vifwVNYbdjDJW6cfDZyaKe32jlKoxtb856oeYYQat0BOULbUxq2hILvju9Wxyke

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'trade_user',
    'super_admin',
    'collector',
    'affluency_member'
);


--
-- Name: axonometric_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.axonometric_request_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: billing_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_mode AS ENUM (
    'agent_commission',
    'net_buy',
    'msrp_only'
);


--
-- Name: client_document_storage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_document_storage AS ENUM (
    'link',
    'upload'
);


--
-- Name: client_document_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_document_type AS ENUM (
    'nda',
    'terms',
    'counterparty',
    'kyc',
    'contract',
    'other'
);


--
-- Name: client_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.client_type AS ENUM (
    'company',
    'studio',
    'individual'
);


--
-- Name: journal_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_category AS ENUM (
    'designer_interview',
    'collection_story',
    'design_trend',
    'project_showcase',
    'international_editorial'
);


--
-- Name: payer_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payer_type AS ENUM (
    'end_client',
    'designer_firm'
);


--
-- Name: pipeline_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_status AS ENUM (
    'idea',
    'planning',
    'drafting',
    'review',
    'ready',
    'published',
    'killed'
);


--
-- Name: region_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.region_tier AS ENUM (
    'ASEAN',
    'GCC',
    'ROW'
);


--
-- Name: sample_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sample_request_status AS ENUM (
    'requested',
    'approved',
    'shipped',
    'delivered',
    'returned',
    'cancelled'
);


--
-- Name: studio_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.studio_role AS ENUM (
    'owner',
    'admin',
    'editor',
    'viewer'
);


--
-- Name: trade_application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trade_application_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'flagged',
    'flagged_for_review',
    'system_retry'
);


--
-- Name: trade_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trade_tier AS ENUM (
    'standard',
    'silver',
    'gold',
    'platinum'
);


--
-- Name: _hotspot_designer_public(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._hotspot_designer_public(_designer_id uuid, _designer_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    (
      _designer_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.designers d
        WHERE d.id = _designer_id
          AND COALESCE(d.is_published, false) = true
          AND COALESCE(d.trade_only, false) = false
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.designers d
      WHERE _designer_name IS NOT NULL
        AND (
          public._norm_designer_name(d.name) = public._norm_designer_name(_designer_name)
          OR public._norm_designer_name(d.display_name) = public._norm_designer_name(_designer_name)
        )
        AND (COALESCE(d.trade_only, false) = true OR COALESCE(d.is_published, false) = false)
    );
$$;


--
-- Name: _hotspot_mapped_pick_public(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._hotspot_mapped_pick_public(_pick_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _pick_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.designer_curator_picks p
    JOIN public.designers d ON d.id = p.designer_id
    WHERE p.id = _pick_id
      AND COALESCE(p.is_hidden, false) = false
      AND COALESCE(d.is_published, false) = true
      AND COALESCE(d.trade_only, false) = false
  );
$$;


--
-- Name: _norm_designer_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._norm_designer_name(txt text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;


--
-- Name: accept_studio_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_studio_invite(_invite_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invite public.studio_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite FROM public.studio_invites WHERE id = _invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation is addressed to a different email' USING ERRCODE = '42501';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted' USING ERRCODE = '22023';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  -- Defense in depth: for role='owner', re-verify the inviter still holds owner
  -- of the target studio at redemption time. Mirrors the INSERT policy on
  -- studio_invites which only lets owners create owner-role invites.
  IF v_invite.role = 'owner'::public.studio_role THEN
    IF v_invite.invited_by IS NULL
       OR NOT public.has_studio_role(v_invite.invited_by, v_invite.studio_id, 'owner'::public.studio_role) THEN
      RAISE EXCEPTION 'Owner-role invitation is no longer valid' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.studio_members (studio_id, user_id, role)
  VALUES (v_invite.studio_id, v_user_id, v_invite.role)
  ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.studio_invites
     SET accepted_at = now(), accepted_by = v_user_id
   WHERE id = _invite_id;

  RETURN jsonb_build_object(
    'studio_id', v_invite.studio_id,
    'role', v_invite.role
  );
END;
$$;


--
-- Name: acquire_ingestion_lease(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_ingestion_lease(_owner text, _minutes integer DEFAULT 5) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE public.ingestion_job_state
     SET lease_until = now() + make_interval(mins => _minutes),
         lease_owner = _owner,
         last_run_at = now()
   WHERE id
     AND (lease_until IS NULL OR lease_until < now());
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;


--
-- Name: add_board_comment_by_token(text, uuid, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_board_comment_by_token(_token text, _board_id uuid, _content text, _author_name text DEFAULT 'Client'::text, _is_client boolean DEFAULT true, _item_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _comment_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM client_boards
    WHERE id = _board_id AND share_token = _token AND status = 'shared'
      AND (token_expires_at IS NULL OR token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid or expired board token';
  END IF;

  INSERT INTO client_board_comments (board_id, item_id, content, author_name, is_client)
  VALUES (_board_id, _item_id, _content, _author_name, _is_client)
  RETURNING id INTO _comment_id;
  RETURN _comment_id;
END;
$$;


--
-- Name: add_gallery_product_to_quote(uuid, uuid, text, text, text, text, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_gallery_product_to_quote(_user_id uuid, _quote_id uuid, _product_name text, _brand_name text, _category text DEFAULT ''::text, _image_url text DEFAULT NULL::text, _dimensions text DEFAULT NULL::text, _materials text DEFAULT NULL::text, _quantity integer DEFAULT 1, _variant_label text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _product_id uuid;
  _priced_id uuid;
  _item_id uuid;
  _target_words text[];
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trade_quotes WHERE id = _quote_id AND user_id = _user_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Quote not found or not in draft status';
  END IF;

  _target_words := string_to_array(
    lower(regexp_replace(regexp_replace(_product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')),
    ' '
  );

  SELECT id INTO _product_id
  FROM trade_products
  WHERE product_name = _product_name AND brand_name = _brand_name
  LIMIT 1;

  SELECT tp2.id INTO _priced_id
  FROM trade_products tp2
  WHERE tp2.brand_name = _brand_name
    AND (tp2.trade_price_cents IS NOT NULL OR tp2.rrp_price_cents IS NOT NULL)
    AND (_product_id IS NULL OR tp2.id != _product_id)
    AND _target_words @> string_to_array(
          lower(regexp_replace(regexp_replace(tp2.product_name, '[^a-zA-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')),
          ' '
        )
  ORDER BY tp2.trade_price_cents IS NOT NULL DESC
  LIMIT 1;

  IF _priced_id IS NOT NULL THEN
    UPDATE trade_products
    SET image_url = COALESCE(trade_products.image_url, _image_url),
        dimensions = COALESCE(trade_products.dimensions, _dimensions),
        materials = COALESCE(trade_products.materials, _materials)
    WHERE id = _priced_id;
    _product_id := _priced_id;
  ELSIF _product_id IS NOT NULL THEN
    UPDATE trade_products
    SET image_url = COALESCE(trade_products.image_url, _image_url),
        dimensions = COALESCE(trade_products.dimensions, _dimensions),
        materials = COALESCE(trade_products.materials, _materials)
    WHERE id = _product_id;
  ELSE
    INSERT INTO trade_products (product_name, brand_name, category, image_url, dimensions, materials, is_active)
    VALUES (_product_name, _brand_name, _category, _image_url, _dimensions, _materials, false)
    RETURNING id INTO _product_id;
  END IF;

  -- Merge lines only when BOTH product_id AND variant_label match.
  -- Different variants (e.g. 10-Lights vs 20-Lights chandelier) must remain
  -- distinct quote lines so each carries its own dimensions and price.
  -- NULL variant_label is treated as its own bucket ("no variant chosen").
  SELECT id INTO _item_id
  FROM trade_quote_items
  WHERE quote_id = _quote_id
    AND product_id = _product_id
    AND COALESCE(variant_label, '') = COALESCE(_variant_label, '');

  IF _item_id IS NOT NULL THEN
    UPDATE trade_quote_items
    SET quantity = quantity + _quantity,
        image_url = COALESCE(NULLIF(_image_url, ''), trade_quote_items.image_url)
    WHERE id = _item_id;
    RETURN _item_id;
  ELSE
    INSERT INTO trade_quote_items (quote_id, product_id, quantity, image_url, variant_label)
    VALUES (_quote_id, _product_id, _quantity, NULLIF(_image_url, ''), _variant_label)
    RETURNING id INTO _item_id;
    RETURN _item_id;
  END IF;
END;
$$;


--
-- Name: add_studio_creator_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_studio_creator_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.studio_members (studio_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner'::public.studio_role, NEW.created_by)
  ON CONFLICT (studio_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: admin_ai_usage_summary(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _daily jsonb;
  _by_feature jsonb;
  _totals jsonb;
  _by_tier jsonb;
  _daily_tier jsonb;
  _tier_feature_day jsonb;
  _pricing jsonb;
  _pricing_meta jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _ai_ev_tmp ON COMMIT DROP AS SELECT 1 WHERE false;

  WITH ev AS (
    SELECT
      e.*,
      CASE
        WHEN e.tier = 'strong' THEN 'Frontier'
        WHEN e.tier = 'balanced' THEN 'Flash'
        WHEN e.tier = 'cheap' THEN 'Classifier'
        WHEN e.tier = 'image' THEN 'Image'
        ELSE 'Untagged'
      END AS tier_label,
      CASE
        WHEN COALESCE(e.cached, false) THEN 0
        WHEN p.model IS NULL THEN COALESCE(e.estimated_cost_usd, 0)
        WHEN p.flat_per_call_usd IS NOT NULL THEN p.flat_per_call_usd
        ELSE (COALESCE(e.prompt_tokens, 0) * COALESCE(p.input_usd_per_mtok, 0)
            + COALESCE(e.completion_tokens, 0) * COALESCE(p.output_usd_per_mtok, 0)) / 1000000.0
      END AS cost_calc,
      (p.model IS NOT NULL) AS priced
    FROM public.ai_usage_events e
    LEFT JOIN public.ai_model_pricing p ON p.model = e.model
    WHERE e.created_at >= _from AND e.created_at < _to
  )
  SELECT
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, feature, COUNT(*) AS requests,
             SUM(total_tokens) AS tokens, SUM(cost_calc) AS cost_usd
      FROM ev GROUP BY 1,2 ORDER BY 1,2) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT feature, COUNT(*) AS requests, SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens, SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd, ROUND(AVG(total_tokens))::int AS avg_tokens,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors,
             MAX(created_at) AS last_call
      FROM ev GROUP BY feature ORDER BY SUM(cost_calc) DESC NULLS LAST) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT tier_label AS tier, COUNT(*) AS requests, SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens, SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd, ROUND(AVG(total_tokens))::int AS avg_tokens,
             ROUND(AVG(latency_ms))::int AS avg_latency_ms,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors
      FROM ev GROUP BY 1 ORDER BY SUM(total_tokens) DESC NULLS LAST) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, tier_label AS tier, COUNT(*) AS requests,
             SUM(total_tokens) AS tokens, SUM(cost_calc) AS cost_usd
      FROM ev GROUP BY 1,2 ORDER BY 1,2) r),
    (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT date_trunc('day', created_at) AS day, tier_label AS tier, feature,
             COUNT(*) AS requests,
             SUM(prompt_tokens) AS prompt_tokens,
             SUM(completion_tokens) AS completion_tokens,
             SUM(total_tokens) AS tokens,
             SUM(cost_calc) AS cost_usd,
             SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors,
             SUM(CASE WHEN priced THEN 0 ELSE 1 END) AS unpriced_events,
             string_agg(DISTINCT model, ', ') AS models
      FROM ev GROUP BY 1,2,3 ORDER BY 1 DESC, 5 DESC) r),
    jsonb_build_object(
      'requests', COUNT(*),
      'tokens', COALESCE(SUM(total_tokens), 0),
      'cost_usd', COALESCE(SUM(cost_calc), 0),
      'errors', SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END)
    ),
    jsonb_build_object(
      'priced_events', COUNT(*) FILTER (WHERE priced),
      'unpriced_events', COUNT(*) FILTER (WHERE NOT priced),
      'unpriced_models', COALESCE((SELECT jsonb_agg(DISTINCT model) FROM ev WHERE NOT priced), '[]'::jsonb),
      'cached_events', COUNT(*) FILTER (WHERE COALESCE(cached, false))
    )
  INTO _daily, _by_feature, _by_tier, _daily_tier, _tier_feature_day, _totals, _pricing_meta
  FROM ev;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.model), '[]'::jsonb) INTO _pricing
  FROM (
    SELECT model, input_usd_per_mtok, output_usd_per_mtok, flat_per_call_usd,
           currency, source, source_url, effective_from, updated_at
    FROM public.ai_model_pricing
  ) r;

  RETURN jsonb_build_object(
    'totals', _totals,
    'daily', _daily,
    'by_feature', _by_feature,
    'by_tier', _by_tier,
    'daily_tier', _daily_tier,
    'tier_feature_day', _tier_feature_day,
    'pricing', _pricing,
    'pricing_meta', _pricing_meta
  );
END;
$$;


--
-- Name: admin_onboarding_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_onboarding_stats() RETURNS TABLE(total_users bigint, completed bigint, pending bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    COUNT(*)::bigint                                              AS total_users,
    COUNT(*) FILTER (WHERE has_seen_trade_intro IS TRUE)::bigint  AS completed,
    COUNT(*) FILTER (WHERE has_seen_trade_intro IS FALSE OR has_seen_trade_intro IS NULL)::bigint AS pending
  FROM public.profiles
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;


--
-- Name: admin_reset_onboarding_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reset_onboarding_for_user(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reset onboarding';
  END IF;
  UPDATE public.profiles SET has_seen_trade_intro = false WHERE id = _user_id;
END;
$$;


--
-- Name: apply_available_credit_to_quote(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_available_credit_to_quote(_quote_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user uuid;
  _credit RECORD;
BEGIN
  SELECT user_id INTO _user FROM public.trade_quotes WHERE id = _quote_id;
  IF _user IS NULL OR _user <> auth.uid() THEN
    RETURN 0;
  END IF;

  SELECT id, amount_cents INTO _credit
  FROM public.trade_credits
  WHERE user_id = _user AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE public.trade_credits
  SET status = 'applied',
      applied_to_quote_id = _quote_id,
      applied_at = now()
  WHERE id = _credit.id;

  UPDATE public.trade_quotes
  SET credit_applied_cents = COALESCE(credit_applied_cents, 0) + _credit.amount_cents
  WHERE id = _quote_id;

  RETURN _credit.amount_cents;
END;
$$;


--
-- Name: apply_regional_trade_multipliers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_regional_trade_multipliers() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  found_multiplier NUMERIC;
BEGIN
  IF NEW.location_city IS NOT NULL AND NEW.location_neighborhood IS NOT NULL THEN
    SELECT multiplier INTO found_multiplier
    FROM public.regional_logistics_rules
    WHERE LOWER(city)         = LOWER(NEW.location_city)
      AND LOWER(neighborhood) = LOWER(NEW.location_neighborhood)
    LIMIT 1;
  END IF;

  IF found_multiplier IS NULL AND NEW.location_city IS NOT NULL THEN
    SELECT multiplier INTO found_multiplier
    FROM public.regional_logistics_rules
    WHERE LOWER(city) = LOWER(NEW.location_city)
      AND neighborhood IS NULL
    LIMIT 1;
  END IF;

  NEW.trade_multiplier := COALESCE(found_multiplier, 1.00);
  RETURN NEW;
END;
$$;


--
-- Name: auto_accept_studio_invites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_accept_studio_invites() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT * FROM public.studio_invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  LOOP
    INSERT INTO public.studio_members (studio_id, user_id, role, invited_by)
    VALUES (inv.studio_id, NEW.id, inv.role, inv.invited_by)
    ON CONFLICT (studio_id, user_id) DO NOTHING;

    UPDATE public.studio_invites
    SET accepted_at = now(), accepted_by = NEW.id
    WHERE id = inv.id;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: auto_assign_admin_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_admin_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.email = 'cyrille@maisonaffluency.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NEW.email IN ('gregoire@maisonaffluency.com', 'gregoire@myaffluency.com', 'gregoire@affluency.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: bridge_concierge_lead_to_inquiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bridge_concierge_lead_to_inquiry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_company TEXT;
  v_product_name TEXT;
  v_designer_name TEXT;
BEGIN
  -- Only bridge qualified leads
  IF NEW.qualified_score < 40 THEN
    RETURN NEW;
  END IF;

  -- Try to extract email from signals JSON — accept common shapes
  BEGIN
    v_email := COALESCE(
      NEW.signals->>'email',
      (NEW.signals->'contact'->>'email'),
      (NEW.signals->'lead'->>'email')
    );
    v_phone := COALESCE(
      NEW.signals->>'phone',
      (NEW.signals->'contact'->>'phone')
    );
    v_company := COALESCE(
      NEW.signals->>'company',
      NEW.signals->>'firm',
      NEW.signals->>'studio'
    );
    v_product_name := COALESCE(
      NEW.signals->>'product',
      NEW.signals->>'product_name',
      (NEW.signals->'product'->>'name')
    );
    v_designer_name := COALESCE(
      NEW.signals->>'designer',
      NEW.signals->>'designer_name',
      (NEW.signals->'designer'->>'name')
    );
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inquiries (
    name, company, email, phone, message,
    source, concierge_lead_id,
    product_name, designer_name,
    status, user_agent
  ) VALUES (
    COALESCE(NEW.name, 'Concierge visitor'),
    v_company,
    v_email,
    v_phone,
    COALESCE(NEW.first_message, ''),
    'concierge_lead',
    NEW.id,
    v_product_name,
    v_designer_name,
    'new',
    NEW.user_agent
  )
  ON CONFLICT (concierge_lead_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: can_edit_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.effective_project_role(_user_id, _project_id) IN ('editor','admin','owner')
      OR public.has_role(_user_id, 'admin'::app_role);
$$;


--
-- Name: can_edit_studio(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members
    WHERE studio_id = _studio_id AND user_id = _user_id
      AND role IN ('editor','admin','owner')
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;


--
-- Name: can_view_client_board(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_client_board(_user_id uuid, _board_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_boards b
    WHERE b.id = _board_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR (b.project_id IS NOT NULL AND public.can_edit_project(_user_id, b.project_id))
        OR (b.project_id IS NULL AND b.studio_id IS NOT NULL AND public.has_studio_role(_user_id, b.studio_id, 'editor'::studio_role))
        OR (b.project_id IS NULL AND b.studio_id IS NULL AND b.user_id = _user_id)
      )
  )
$$;


--
-- Name: can_view_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.effective_project_role(_user_id, _project_id) IS NOT NULL
      OR public.has_role(_user_id, 'admin'::app_role);
$$;


--
-- Name: can_view_studio(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members WHERE studio_id = _studio_id AND user_id = _user_id
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'stripe'::text NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: claim_webhook_events(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_webhook_events(batch_size integer DEFAULT 5) RETURNS SETOF public.webhook_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
    FROM public.webhook_events e
    WHERE e.status IN ('pending', 'processing')
      AND e.next_attempt_at <= now()
      AND e.attempts < e.max_attempts
      -- a row stuck in 'processing' for 5 minutes is considered abandoned
      AND (e.status = 'pending' OR e.locked_at < now() - interval '5 minutes')
    ORDER BY e.created_at
    LIMIT GREATEST(1, LEAST(batch_size, 20))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.webhook_events w
  SET status = 'processing',
      attempts = w.attempts + 1,
      locked_at = now(),
      updated_at = now()
  FROM claimed
  WHERE w.id = claimed.id
  RETURNING w.*;
END;
$$;


--
-- Name: cn_director_briefs_validate_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cn_director_briefs_validate_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status NOT IN ('new', 'contacted', 'booked', 'closed') THEN
    RAISE EXCEPTION 'Invalid cn_director_briefs.status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: compute_curator_pick_slug(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_curator_pick_slug(_title text, _subtitle text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
  SELECT public.slugify_text(regexp_replace(coalesce(_title, ''), '\s+by\s+.+$', '', 'i'))
$_$;


--
-- Name: concierge_check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer) RETURNS TABLE(allowed boolean, retry_in integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _row public.concierge_rate_limits%ROWTYPE;
BEGIN
  INSERT INTO public.concierge_rate_limits(key, count, reset_at)
  VALUES (_key, 1, _now + make_interval(secs => _window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
                  WHEN public.concierge_rate_limits.reset_at <= _now THEN 1
                  ELSE public.concierge_rate_limits.count + 1
                END,
        reset_at = CASE
                     WHEN public.concierge_rate_limits.reset_at <= _now
                       THEN _now + make_interval(secs => _window_seconds)
                     ELSE public.concierge_rate_limits.reset_at
                   END,
        updated_at = _now
  RETURNING * INTO _row;

  IF _row.count > _limit THEN
    RETURN QUERY SELECT FALSE, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_row.reset_at - _now)))::INTEGER);
  ELSE
    RETURN QUERY SELECT TRUE, 0;
  END IF;
END;
$$;


--
-- Name: current_trade_discount_pct(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_trade_discount_pct() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    public.tier_discount_pct((SELECT trade_tier FROM public.profiles WHERE id = auth.uid())),
    0.08
  );
$$;


--
-- Name: deactivate_orphaned_trade_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deactivate_orphaned_trade_product() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.trade_products
  SET is_active = false,
      updated_at = now()
  WHERE source_pick_id = OLD.id;
  RETURN OLD;
END;
$$;


--
-- Name: delete_email(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_email(queue_name text, message_id bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT pgmq.delete(queue_name, message_id); $$;


--
-- Name: effective_product_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.effective_product_availability(_product_id uuid) RETURNS TABLE(lead_weeks_min smallint, lead_weeks_max smallint, stock_status text, source text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    COALESCE(tp.lead_weeks_min_override, blt.default_lead_weeks_min),
    COALESCE(tp.lead_weeks_max_override, blt.default_lead_weeks_max),
    COALESCE(tp.stock_status_override, blt.default_stock_status, 'made_to_order'),
    CASE
      WHEN tp.lead_weeks_min_override IS NOT NULL OR tp.stock_status_override IS NOT NULL THEN 'product'
      WHEN blt.brand_name IS NOT NULL THEN 'brand'
      ELSE 'default'
    END
  FROM public.trade_products tp
  LEFT JOIN public.brand_lead_times blt ON blt.brand_name = tp.brand_name
  WHERE tp.id = _product_id;
$$;


--
-- Name: effective_project_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.effective_project_role(_user_id uuid, _project_id uuid) RETURNS public.studio_role
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _project_studio uuid;
  _override_exists boolean;
  _override_role public.studio_role;
  _studio_role public.studio_role;
BEGIN
  SELECT studio_id INTO _project_studio FROM public.projects WHERE id = _project_id;
  IF _project_studio IS NULL THEN
    RETURN NULL;
  END IF;

  -- Override check
  SELECT true, role INTO _override_exists, _override_role
  FROM public.studio_project_overrides
  WHERE project_id = _project_id AND user_id = _user_id;

  IF _override_exists THEN
    -- NULL role = explicitly hidden
    RETURN _override_role;
  END IF;

  -- Fall back to studio role
  SELECT role INTO _studio_role
  FROM public.studio_members
  WHERE studio_id = _project_studio AND user_id = _user_id;

  RETURN _studio_role;
END;
$$;


--
-- Name: email_queue_dispatch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_dispatch() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$$;


--
-- Name: email_queue_wake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_queue_wake() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  -- Runs inside the enqueue transaction; the outer handler guarantees nothing
  -- below can roll back the customer's email. Shared advisory lock serializes
  -- arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$_$;


--
-- Name: enforce_analytics_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_analytics_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  actor text;
  limit_per_min integer := COALESCE(NULLIF(TG_ARGV[0], '')::integer, 120);
  key text;
  current_hits integer;
BEGIN
  actor := COALESCE(
    auth.uid()::text,
    NULLIF(j->>'session_id', ''),
    NULLIF(j->>'visitor_hash', ''),
    NULLIF(j->>'ip_hash', ''),
    'global'
  );

  IF actor = 'global' THEN
    limit_per_min := limit_per_min * 20;
  END IF;

  key := TG_TABLE_NAME || ':' || actor;

  INSERT INTO public.analytics_rate_limits (bucket_key, window_start, hits)
  VALUES (key, date_trunc('minute', now()), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hits = CASE
                 WHEN public.analytics_rate_limits.window_start < date_trunc('minute', now())
                 THEN 1
                 ELSE public.analytics_rate_limits.hits + 1
               END,
        window_start = CASE
                 WHEN public.analytics_rate_limits.window_start < date_trunc('minute', now())
                 THEN date_trunc('minute', now())
                 ELSE public.analytics_rate_limits.window_start
               END
  RETURNING hits INTO current_hits;

  IF current_hits > limit_per_min THEN
    RAISE EXCEPTION 'Rate limit exceeded for % events', TG_TABLE_NAME
      USING ERRCODE = '53400';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_concierge_lead_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_concierge_lead_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _key text;
  _count_1m int;
  _count_1h int;
BEGIN
  _key := COALESCE(NEW.user_id::text, NEW.session_id, NEW.referrer, 'anon');

  SELECT count(*) INTO _count_1m
  FROM public.concierge_leads
  WHERE COALESCE(user_id::text, session_id, referrer, 'anon') = _key
    AND created_at > now() - interval '1 minute';

  IF _count_1m >= 3 THEN
    RAISE EXCEPTION 'Rate limit: too many concierge leads (per minute)';
  END IF;

  SELECT count(*) INTO _count_1h
  FROM public.concierge_leads
  WHERE COALESCE(user_id::text, session_id, referrer, 'anon') = _key
    AND created_at > now() - interval '1 hour';

  IF _count_1h >= 20 THEN
    RAISE EXCEPTION 'Rate limit: too many concierge leads (per hour)';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enqueue_email(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT pgmq.send(queue_name, payload); $$;


--
-- Name: fanout_supply_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fanout_supply_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  msg text;
  rec record;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.lead_time,'') IS DISTINCT FROM COALESCE(OLD.lead_time,''))
     OR (COALESCE(NEW.stock_status_override,'') IS DISTINCT FROM COALESCE(OLD.stock_status_override,''))
     OR (COALESCE(NEW.lead_weeks_max_override, -1) IS DISTINCT FROM COALESCE(OLD.lead_weeks_max_override, -1)) THEN

    msg := COALESCE(NEW.brand_name, 'The atelier') || ' reports updated availability for '
           || COALESCE(NEW.product_name, 'a saved piece')
           || CASE WHEN COALESCE(NEW.lead_time,'') <> '' THEN ' — lead time now ' || NEW.lead_time ELSE '' END
           || '. Review updated project lead times on your desktop dashboard.';

    FOR rec IN
      SELECT DISTINCT b.user_id, b.id AS board_id, COALESCE(b.title, 'your project') AS project_name
      FROM public.client_board_items i
      JOIN public.client_boards b ON b.id = i.board_id
      WHERE i.product_id = NEW.id AND b.user_id IS NOT NULL
    LOOP
      INSERT INTO public.studio_alerts (user_id, kind, title, body, product_id, board_id, project_name, url)
      VALUES (
        rec.user_id,
        'supply_update',
        'Update for ' || rec.project_name,
        msg,
        NEW.id,
        rec.board_id,
        rec.project_name,
        '/trade/boards'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: flag_unexpected_storage_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flag_unexpected_storage_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _allowed_buckets text[] := ARRAY['assets','avatars','designer-images','spec-sheets','floor-plans','client-documents','backups'];
  _suspicious boolean := false;
  _reason text := '';
BEGIN
  IF NEW.bucket_id IS NULL OR NOT (NEW.bucket_id = ANY(_allowed_buckets)) THEN
    _suspicious := true;
    _reason := 'unknown_bucket';
  ELSIF NEW.bucket_id = 'avatars' AND NEW.owner IS NOT NULL
        AND (storage.foldername(NEW.name))[1] IS DISTINCT FROM NEW.owner::text THEN
    _suspicious := true;
    _reason := 'avatar_path_mismatch';
  ELSIF NEW.name ~* '\.(php|sh|exe|bat|cmd|ps1|jsp)$' THEN
    _suspicious := true;
    _reason := 'executable_extension';
  END IF;

  IF _suspicious THEN
    INSERT INTO public.security_audit_events (event_type, source, user_id, details)
    VALUES (
      'storage_unexpected_write',
      COALESCE(NEW.bucket_id, 'unknown'),
      NEW.owner,
      jsonb_build_object('reason', _reason, 'object_name', NEW.name, 'size', NEW.metadata->'size')
    );
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: gallery_hotspots_resolve_designer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gallery_hotspots_resolve_designer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  resolved uuid;
BEGIN
  IF NEW.designer_name IS NULL OR btrim(NEW.designer_name) = '' THEN
    NEW.designer_id := NULL;
    RETURN NEW;
  END IF;

  SELECT d.id INTO resolved
  FROM public.designers d
  WHERE public._norm_designer_name(d.name) = public._norm_designer_name(NEW.designer_name)
     OR public._norm_designer_name(d.display_name) = public._norm_designer_name(NEW.designer_name)
  ORDER BY d.is_published DESC NULLS LAST, d.created_at ASC
  LIMIT 1;

  NEW.designer_id := resolved;
  RETURN NEW;
END;
$$;


--
-- Name: get_admin_user_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_ids() RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
    AND public.has_role(auth.uid(), 'admin'::app_role);
$$;


--
-- Name: get_board_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_board_by_token(_token text) RETURNS TABLE(id uuid, title text, client_name text, status text, studio_logo_url text, studio_name text, hide_maison_branding boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT b.id, b.title, b.client_name, b.status::text,
         b.studio_logo_url, b.studio_name, b.hide_maison_branding
  FROM public.client_boards b
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  LIMIT 1;
$$;


--
-- Name: get_board_client_email(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_board_client_email(_board_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _email text;
  _owner uuid;
BEGIN
  SELECT user_id, client_email INTO _owner, _email
  FROM public.client_boards WHERE id = _board_id;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  IF _owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _email;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: get_board_comments_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_board_comments_by_token(_token text) RETURNS TABLE(id uuid, board_id uuid, item_id uuid, author_name text, is_client boolean, content text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT bc.id, bc.board_id, bc.item_id, bc.author_name, bc.is_client, bc.content, bc.created_at
  FROM public.client_board_comments bc
  INNER JOIN public.client_boards b ON b.id = bc.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bc.created_at;
$$;


--
-- Name: get_board_items_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_board_items_by_token(_token text) RETURNS TABLE(id uuid, board_id uuid, product_id uuid, sort_order integer, notes text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT bi.id, bi.board_id, bi.product_id, bi.sort_order, bi.notes, bi.created_at
  FROM public.client_board_items bi
  INNER JOIN public.client_boards b ON b.id = bi.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bi.sort_order;
$$;


--
-- Name: get_brand_engagement_users(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_brand_engagement_users(_brand_name text, _since timestamp with time zone) RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, company text, quote_lines bigint, board_items bigint, source text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH admin_ids AS (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  ),
  q AS (
    SELECT tq.user_id, COUNT(qi.id) AS quote_lines
    FROM public.trade_quote_items qi
    JOIN public.trade_quotes tq ON tq.id = qi.quote_id
    JOIN public.trade_products tp ON tp.id = qi.product_id
    WHERE qi.created_at >= _since
      AND tp.brand_name = _brand_name
      AND tq.user_id NOT IN (SELECT user_id FROM admin_ids)
    GROUP BY tq.user_id
  ),
  b AS (
    SELECT cb.user_id, COUNT(bi.id) AS board_items
    FROM public.client_board_items bi
    JOIN public.client_boards cb ON cb.id = bi.board_id
    JOIN public.trade_products tp ON tp.id = bi.product_id
    WHERE bi.created_at >= _since
      AND tp.brand_name = _brand_name
      AND cb.user_id NOT IN (SELECT user_id FROM admin_ids)
    GROUP BY cb.user_id
  ),
  combined AS (
    SELECT COALESCE(q.user_id, b.user_id) AS user_id,
           COALESCE(q.quote_lines, 0) AS quote_lines,
           COALESCE(b.board_items, 0) AS board_items,
           CASE
             WHEN q.user_id IS NOT NULL AND b.user_id IS NOT NULL THEN 'both'
             WHEN q.user_id IS NOT NULL THEN 'quote'
             ELSE 'board'
           END AS source
    FROM q FULL OUTER JOIN b USING (user_id)
  )
  SELECT c.user_id,
         p.email,
         p.first_name,
         p.last_name,
         p.company,
         c.quote_lines,
         c.board_items,
         c.source
  FROM combined c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY (c.quote_lines + c.board_items) DESC;
$$;


--
-- Name: get_client_contacts_safe(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_client_contacts_safe(_client_id uuid) RETURNS TABLE(id uuid, client_id uuid, first_name text, last_name text, role_title text, email text, phone text, is_primary boolean, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, can_edit boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _studio_id uuid;
  _can_edit boolean;
  _can_view boolean;
BEGIN
  SELECT c.studio_id INTO _studio_id FROM public.clients c WHERE c.id = _client_id;
  IF _studio_id IS NULL THEN RETURN; END IF;

  _can_edit := public.can_edit_studio(auth.uid(), _studio_id);
  _can_view := _can_edit OR public.can_view_studio(auth.uid(), _studio_id);
  IF NOT _can_view THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    cc.id,
    cc.client_id,
    cc.first_name,
    cc.last_name,
    cc.role_title,
    CASE
      WHEN _can_edit THEN cc.email
      WHEN cc.email IS NULL OR cc.email = '' THEN cc.email
      ELSE regexp_replace(cc.email, '(^.).*(@.*$)', '\1•••\2')
    END AS email,
    CASE
      WHEN _can_edit THEN cc.phone
      WHEN cc.phone IS NULL OR cc.phone = '' THEN cc.phone
      ELSE regexp_replace(cc.phone, '.(?=.{2})', '•', 'g')
    END AS phone,
    cc.is_primary,
    CASE WHEN _can_edit THEN cc.notes ELSE NULL END AS notes,
    cc.created_at,
    cc.updated_at,
    _can_edit AS can_edit
  FROM public.client_contacts cc
  WHERE cc.client_id = _client_id
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at ASC;
END;
$_$;


--
-- Name: get_cron_jobs_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_jobs_summary() RETURNS TABLE(jobname text, schedule text, last_run_at timestamp with time zone, last_status text, last_duration_ms integer, rows_7d bigint, rows_30d bigint, rows_label text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'cron'
    AS $$
  WITH admin_check AS MATERIALIZED (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin
  )
  SELECT
    j.jobname,
    j.schedule,
    NULL::timestamptz AS last_run_at,
    NULL::text AS last_status,
    NULL::integer AS last_duration_ms,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '7 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '7 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '7 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '7 days')
      ELSE NULL
    END AS rows_7d,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN
        (SELECT count(*) FROM public.competitor_designers WHERE created_at >= now() - interval '30 days')
        + (SELECT count(*) FROM public.auction_benchmarks WHERE created_at >= now() - interval '30 days')
      WHEN 'monthly-similarweb-scrape' THEN
        (SELECT count(*) FROM public.competitor_traffic WHERE month >= (now() - interval '30 days')::date)
      WHEN 'scrape-products-daily' THEN
        (SELECT count(*) FROM public.trade_products WHERE updated_at >= now() - interval '30 days')
      ELSE NULL
    END AS rows_30d,
    CASE j.jobname
      WHEN 'weekly-competitor-scrape' THEN 'competitor designers + auction lots'
      WHEN 'monthly-similarweb-scrape' THEN 'traffic rows'
      WHEN 'scrape-products-daily' THEN 'products updated'
      ELSE NULL
    END AS rows_label
  FROM cron.job j
  CROSS JOIN admin_check a
  WHERE a.is_admin
  ORDER BY j.jobname;
$$;


--
-- Name: get_cron_run_history(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cron_run_history(_limit integer DEFAULT 50) RETURNS TABLE(jobname text, schedule text, start_time timestamp with time zone, end_time timestamp with time zone, duration_ms integer, status text, return_message text, http_status_code integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'cron', 'net'
    AS $$
  WITH admin_check AS MATERIALIZED (
    SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin
  ), recent_runs AS (
    SELECT
      j.jobname,
      j.schedule,
      jrd.start_time,
      jrd.end_time,
      jrd.status,
      jrd.return_message
    FROM cron.job_run_details jrd
    JOIN cron.job j USING (jobid)
    CROSS JOIN admin_check a
    WHERE a.is_admin
    ORDER BY jrd.runid DESC
    LIMIT GREATEST(1, LEAST(_limit, 100))
  )
  SELECT
    r.jobname,
    r.schedule,
    r.start_time,
    r.end_time,
    GREATEST(0, EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::int AS duration_ms,
    r.status,
    LEFT(COALESCE(r.return_message, ''), 240) AS return_message,
    (
      SELECT resp.status_code
      FROM public.cron_http_call_log l
      JOIN net._http_response resp ON resp.id = l.request_id
      WHERE l.jobname = r.jobname
        AND resp.created BETWEEN r.start_time - interval '5 seconds' AND r.end_time + interval '10 minutes'
      ORDER BY resp.created DESC
      LIMIT 1
    ) AS http_status_code
  FROM recent_runs r
  ORDER BY r.start_time DESC NULLS LAST;
$$;


--
-- Name: get_currency_rate(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_currency_rate(_base text, _target text) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN upper(_base) = upper(_target) THEN 1::numeric
    ELSE (
      SELECT cr.rate FROM public.currency_rates cr
      WHERE cr.base_currency = upper(_base)
        AND cr.target_currency = upper(_target)
      LIMIT 1
    )
  END
$$;


--
-- Name: get_designer_engagement(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_designer_engagement(_since timestamp with time zone) RETURNS TABLE(brand_name text, quote_users bigint, quote_lines bigint, board_users bigint, board_items bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH admin_ids AS (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  ),
  q AS (
    SELECT tp.brand_name,
           tq.user_id,
           qi.id AS line_id
    FROM public.trade_quote_items qi
    JOIN public.trade_quotes tq ON tq.id = qi.quote_id
    JOIN public.trade_products tp ON tp.id = qi.product_id
    WHERE qi.created_at >= _since
      AND tq.user_id NOT IN (SELECT user_id FROM admin_ids)
      AND COALESCE(tp.brand_name, '') <> ''
  ),
  b AS (
    SELECT tp.brand_name,
           cb.user_id,
           bi.id AS item_id
    FROM public.client_board_items bi
    JOIN public.client_boards cb ON cb.id = bi.board_id
    JOIN public.trade_products tp ON tp.id = bi.product_id
    WHERE bi.created_at >= _since
      AND cb.user_id NOT IN (SELECT user_id FROM admin_ids)
      AND COALESCE(tp.brand_name, '') <> ''
  ),
  agg_q AS (
    SELECT brand_name,
           COUNT(DISTINCT user_id) AS quote_users,
           COUNT(line_id) AS quote_lines
    FROM q GROUP BY brand_name
  ),
  agg_b AS (
    SELECT brand_name,
           COUNT(DISTINCT user_id) AS board_users,
           COUNT(item_id) AS board_items
    FROM b GROUP BY brand_name
  )
  SELECT COALESCE(agg_q.brand_name, agg_b.brand_name) AS brand_name,
         COALESCE(agg_q.quote_users, 0) AS quote_users,
         COALESCE(agg_q.quote_lines, 0) AS quote_lines,
         COALESCE(agg_b.board_users, 0) AS board_users,
         COALESCE(agg_b.board_items, 0) AS board_items
  FROM agg_q
  FULL OUTER JOIN agg_b USING (brand_name)
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;


--
-- Name: get_designer_for_upload(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_designer_for_upload(_slug text) RETURNS TABLE(id uuid, name text, slug text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT d.id, d.name, d.slug
  FROM public.designers d
  WHERE d.slug = _slug
  LIMIT 1;
$$;


--
-- Name: get_my_board_share_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_board_share_token(_board_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _token text;
  _owner uuid;
BEGIN
  SELECT user_id, share_token INTO _owner, _token
  FROM public.client_boards
  WHERE id = _board_id;
  IF _owner IS NULL THEN RETURN NULL; END IF;
  IF _owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN _token;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: get_my_pending_invites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_pending_invites() RETURNS TABLE(id uuid, studio_id uuid, studio_name text, role public.studio_role, invited_by_name text, expires_at timestamp with time zone, created_at timestamp with time zone, is_expired boolean, is_accepted boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    i.id,
    i.studio_id,
    s.name AS studio_name,
    i.role,
    COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), p.first_name, p.last_name) AS invited_by_name,
    i.expires_at,
    i.created_at,
    (i.expires_at IS NOT NULL AND i.expires_at < now()) AS is_expired,
    (i.accepted_at IS NOT NULL) AS is_accepted
  FROM public.studio_invites i
  LEFT JOIN public.studios s ON s.id = i.studio_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE lower(i.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC;
$$;


--
-- Name: get_my_phone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_phone() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT phone FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: get_recent_scrape_failures(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_scrape_failures(since_minutes integer DEFAULT 60) RETURNS TABLE(id bigint, status_code integer, body text, created timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'net'
    AS $$
  SELECT r.id, r.status_code, left(r.content::text, 500) AS body, r.created
  FROM net._http_response r
  JOIN public.cron_http_call_log l ON l.request_id = r.id
  WHERE l.jobname = 'scrape-products-daily'
    AND r.created >= now() - make_interval(mins => since_minutes)
    AND (r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300)
  ORDER BY r.created DESC
$$;


--
-- Name: get_studio_contact_email(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_studio_contact_email(_studio_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT contact_email INTO _email
    FROM public.featured_studios
   WHERE id = _studio_id
     AND (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  RETURN _email;
END;
$$;


--
-- Name: get_studio_payout_accounts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_studio_payout_accounts(_studio_id uuid) RETURNS TABLE(id uuid, studio_id uuid, label text, account_holder_name text, country_code text, currency text, is_default boolean, iban text, ach_routing_number text, ach_account_number text, swift_bic text, bank_name text, stripe_connect_account_id text, stripe_connect_status text, tax_form_kind text, tax_form_reference text, tax_form_document_path text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), _studio_id, 'admin'::studio_role)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.studio_id, p.label, p.account_holder_name, p.country_code, p.currency, p.is_default,
    CASE WHEN p.iban IS NULL OR length(p.iban) < 4 THEN p.iban
         ELSE '••••' || right(p.iban, 4) END AS iban,
    CASE WHEN p.ach_routing_number IS NULL OR length(p.ach_routing_number) < 4 THEN p.ach_routing_number
         ELSE '••••' || right(p.ach_routing_number, 4) END AS ach_routing_number,
    CASE WHEN p.ach_account_number IS NULL OR length(p.ach_account_number) < 4 THEN p.ach_account_number
         ELSE '••••' || right(p.ach_account_number, 4) END AS ach_account_number,
    CASE WHEN p.swift_bic IS NULL OR length(p.swift_bic) < 3 THEN p.swift_bic
         ELSE '••••' || right(p.swift_bic, 3) END AS swift_bic,
    p.bank_name, p.stripe_connect_account_id, p.stripe_connect_status,
    p.tax_form_kind, p.tax_form_reference, p.tax_form_document_path,
    p.created_at, p.updated_at
  FROM public.studio_payout_accounts p
  WHERE p.studio_id = _studio_id
  ORDER BY p.is_default DESC, p.created_at;
END;
$$;


--
-- Name: get_trade_only_collectible_slugs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trade_only_collectible_slugs() RETURNS SETOF text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT slug FROM public.collectible_overrides WHERE trade_only = true;
$$;


--
-- Name: get_user_studio_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_studio_ids(_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT studio_id FROM public.studio_members WHERE user_id = _user_id;
$$;


--
-- Name: grant_collector_role_on_approve(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_collector_role_on_approve() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'collector'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: guard_shop_order_buyer_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_shop_order_buyer_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
     OR NEW.subtotal_cents IS DISTINCT FROM OLD.subtotal_cents
     OR NEW.shipping_cents IS DISTINCT FROM OLD.shipping_cents
     OR NEW.tax_cents IS DISTINCT FROM OLD.tax_cents
     OR NEW.discount_cents IS DISTINCT FROM OLD.discount_cents
     OR NEW.discount_pct IS DISTINCT FROM OLD.discount_pct
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_ref IS DISTINCT FROM OLD.order_ref
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.marked_paid_by IS DISTINCT FROM OLD.marked_paid_by THEN
    RAISE EXCEPTION 'Only the payment receipt may be updated on your order';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_trade_signup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_trade_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    user_email TEXT;
    assigned_status TEXT;
BEGIN
    user_email := LOWER(NEW.email);

    -- Auto-approval is only ever possible for a CONFIRMED corporate mailbox.
    -- Personal / free mailbox providers always require admin approval.
    IF NEW.email_confirmed_at IS NULL
       OR user_email IS NULL
       OR position('@' in user_email) = 0
       OR public.is_personal_email_domain(user_email) THEN
        assigned_status := 'pending_review';
    ELSE
        assigned_status := 'approved';
    END IF;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);

    INSERT INTO public.profiles (id, email, trade_status)
    VALUES (NEW.id, user_email, assigned_status)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          trade_status = CASE
            WHEN public.profiles.trade_status = 'approved' THEN 'approved'
            ELSE EXCLUDED.trade_status
          END;

    PERFORM set_config('app.bypass_profile_guard', 'off', true);

    RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (
      role = _role
      OR (role::text = 'super_admin' AND _role::text = 'admin')
    )
  );
$$;


--
-- Name: has_studio_role(uuid, uuid, public.studio_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members sm
    WHERE sm.user_id = _user_id
      AND sm.studio_id = _studio_id
      AND CASE _min_role
            WHEN 'viewer' THEN sm.role IN ('viewer','editor','admin','owner')
            WHEN 'editor' THEN sm.role IN ('editor','admin','owner')
            WHEN 'admin'  THEN sm.role IN ('admin','owner')
            WHEN 'owner'  THEN sm.role = 'owner'
          END
  );
$$;


--
-- Name: has_valid_studio_invite(uuid, uuid, public.studio_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.studio_invites si
    JOIN auth.users u ON u.id = _user_id
    WHERE si.studio_id = _studio_id
      AND si.role = _role
      AND si.accepted_at IS NULL
      AND si.expires_at > now()
      AND lower(si.email) = lower(u.email::text)
  )
$$;


--
-- Name: has_verified_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_verified_access(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('trade_user'::app_role, 'collector'::app_role, 'admin'::app_role, 'super_admin'::app_role)
  );
$$;


--
-- Name: invoke_scrape_products_with_retry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invoke_scrape_products_with_retry() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'net'
    AS $$
DECLARE
  v_url text := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/scrape-products';
  v_headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', '8088bc97578c85e956cd0bab1f1912ba2459519cb7a3d9d0c640c8570c83f334'
  );
  v_body jsonb := '{"scheduled": true}'::jsonb;
  v_max_attempts int := 3;
  v_backoff int[] := ARRAY[30, 90]; -- seconds before attempts 2 and 3
  v_attempt int;
  v_req_id bigint;
  v_resp record;
  v_jobname text;
  v_is_final boolean;
  v_success boolean := false;
BEGIN
  FOR v_attempt IN 1..v_max_attempts LOOP
    v_is_final := (v_attempt = v_max_attempts);
    -- Final attempt is logged under monitored jobname; earlier attempts are silent.
    v_jobname := CASE WHEN v_is_final THEN 'scrape-products-daily'
                      ELSE 'scrape-products-daily-retry' END;

    SELECT net.http_post(
      url := v_url,
      headers := v_headers,
      body := v_body,
      timeout_milliseconds := 15000
    ) INTO v_req_id;

    INSERT INTO public.cron_http_call_log (request_id, jobname, url)
    VALUES (v_req_id, v_jobname, v_url);

    -- Block until response (or pg_net timeout) is recorded.
    SELECT * INTO v_resp FROM net.http_collect_response(v_req_id, async := false);

    IF v_resp.status = 'SUCCESS' THEN
      -- net.http_collect_response returns the response row; inspect status_code
      DECLARE
        v_code int;
      BEGIN
        SELECT status_code INTO v_code FROM net._http_response WHERE id = v_req_id;
        IF v_code IS NOT NULL AND v_code >= 200 AND v_code < 300 THEN
          v_success := true;
          EXIT;
        END IF;
      END;
    END IF;

    -- Not successful. Backoff before next attempt unless this was the final one.
    IF NOT v_is_final THEN
      PERFORM pg_sleep(v_backoff[v_attempt]);
    END IF;
  END LOOP;
END;
$$;


--
-- Name: is_approved_trade_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved_trade_user(_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role)
    OR (
      public.has_role(_user_id, 'trade_user'::app_role)
      AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.trade_status = 'approved')
        OR EXISTS (SELECT 1 FROM public.trade_applications ta WHERE ta.user_id = _user_id AND ta.status = 'approved'::trade_application_status)
      )
    )
  )
$$;


--
-- Name: is_client_trade_approved(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_client_trade_approved(_client_id uuid) RETURNS TABLE(approved boolean, contact_email text, application_status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _email text;
  _status text;
BEGIN
  -- Caller must be able to see the client (studio member) OR be admin
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND (public.can_view_studio(auth.uid(), c.studio_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RETURN;
  END IF;

  -- Pick primary contact email, fallback to any contact email
  SELECT cc.email INTO _email
  FROM public.client_contacts cc
  WHERE cc.client_id = _client_id
    AND cc.email IS NOT NULL AND btrim(cc.email) <> ''
  ORDER BY cc.is_primary DESC NULLS LAST, cc.created_at ASC
  LIMIT 1;

  IF _email IS NULL THEN
    approved := false; contact_email := NULL; application_status := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Latest application for the auth user matching that email
  SELECT ta.status::text INTO _status
  FROM public.trade_applications ta
  JOIN public.profiles p ON p.id = ta.user_id
  WHERE lower(p.email) = lower(_email)
  ORDER BY ta.created_at DESC
  LIMIT 1;

  approved := (_status = 'approved');
  contact_email := _email;
  application_status := _status;
  RETURN NEXT;
END;
$$;


--
-- Name: is_personal_email_domain(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_personal_email_domain(_email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personal_email_domains d
    WHERE lower(split_part(_email, '@', 2)) = d.domain
       OR lower(split_part(_email, '@', 2)) LIKE '%.' || d.domain
  );
$$;


--
-- Name: is_public_sitemap_product(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_public_sitemap_product(_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_products tp
    WHERE tp.id = _id
      AND tp.is_active IS TRUE
      AND COALESCE(tp.is_hidden, false) IS FALSE
  )
$$;


--
-- Name: is_studio_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members sm
    JOIN public.studios s ON s.id = sm.studio_id
    WHERE sm.studio_id = _studio_id
      AND sm.user_id   = _user_id
      AND sm.role      = 'owner'::public.studio_role
  );
$$;


--
-- Name: items_recalc_financials(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.items_recalc_financials() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.client_price IS NULL OR NEW.client_price = 0 THEN
    NEW.client_price := ROUND(COALESCE(NEW.supplier_cost,0) * (1 + COALESCE(NEW.markup_percentage,0)/100), 2);
  END IF;
  NEW.balance_due := CASE
    WHEN NEW.deposit_paid THEN ROUND(NEW.client_price * (1 - COALESCE(NEW.deposit_required_percent,0)/100), 2)
    ELSE NEW.client_price
  END;
  RETURN NEW;
END;
$$;


--
-- Name: log_curator_picks_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_curator_picks_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _old jsonb;
  _new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('designer_curator_picks', 'DELETE', OLD.id, auth.uid(), _old);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    _new := to_jsonb(NEW) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('designer_curator_picks', 'UPDATE', NEW.id, auth.uid(), _old, _new);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW) - 'embedding' - 'embedding_source_hash' - 'embedded_at';
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('designer_curator_picks', 'INSERT', NEW.id, auth.uid(), _new);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: log_custom_request_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_custom_request_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  arole text := 'trade_user';
  changed jsonb := '{}'::jsonb;
  act text;
BEGIN
  IF uid IS NOT NULL AND has_role(uid, 'admin'::app_role) THEN
    arole := 'admin';
  ELSIF uid IS NULL THEN
    arole := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    act := 'created';
    changed := jsonb_build_object(
      'product_name', NEW.product_name,
      'brand_name', NEW.brand_name,
      'status', NEW.status,
      'quantity', NEW.quantity
    );
  ELSIF TG_OP = 'UPDATE' THEN
    act := 'updated';
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      changed := changed || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      changed := changed || jsonb_build_object('admin_notes', jsonb_build_object('from', OLD.admin_notes, 'to', NEW.admin_notes));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      changed := changed || jsonb_build_object('notes', jsonb_build_object('from', OLD.notes, 'to', NEW.notes));
    END IF;
    IF NEW.dimension_changes IS DISTINCT FROM OLD.dimension_changes THEN
      changed := changed || jsonb_build_object('dimension_changes', jsonb_build_object('from', OLD.dimension_changes, 'to', NEW.dimension_changes));
    END IF;
    IF NEW.finish_notes IS DISTINCT FROM OLD.finish_notes THEN
      changed := changed || jsonb_build_object('finish_notes', jsonb_build_object('from', OLD.finish_notes, 'to', NEW.finish_notes));
    END IF;
    IF NEW.com_col_fabric IS DISTINCT FROM OLD.com_col_fabric THEN
      changed := changed || jsonb_build_object('com_col_fabric', jsonb_build_object('from', OLD.com_col_fabric, 'to', NEW.com_col_fabric));
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      changed := changed || jsonb_build_object('quantity', jsonb_build_object('from', OLD.quantity, 'to', NEW.quantity));
    END IF;
    IF NEW.target_lead_weeks IS DISTINCT FROM OLD.target_lead_weeks THEN
      changed := changed || jsonb_build_object('target_lead_weeks', jsonb_build_object('from', OLD.target_lead_weeks, 'to', NEW.target_lead_weeks));
    END IF;
    IF NEW.budget_notes IS DISTINCT FROM OLD.budget_notes THEN
      changed := changed || jsonb_build_object('budget_notes', jsonb_build_object('from', OLD.budget_notes, 'to', NEW.budget_notes));
    END IF;
    -- No tracked fields changed → skip
    IF changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.trade_custom_request_activity (request_id, actor_id, actor_role, action, changes)
  VALUES (NEW.id, uid, arole, act, changed);

  RETURN NEW;
END;
$$;


--
-- Name: log_designers_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_designers_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('designers', 'DELETE', OLD.id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('designers', 'UPDATE', NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('designers', 'INSERT', NEW.id, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: log_public_download_event(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_public_download_event(_document_id uuid DEFAULT NULL::uuid, _document_label text DEFAULT ''::text, _country text DEFAULT ''::text, _source text DEFAULT 'public'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _event_id uuid;
BEGIN
  INSERT INTO public.public_download_events (document_id, document_label, country, source)
  VALUES (_document_id, COALESCE(_document_label, ''), COALESCE(_country, ''), COALESCE(_source, 'public'))
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;


--
-- Name: log_sample_request_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_sample_request_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO sample_request_audit_log (request_id, changed_by, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: log_trade_documents_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_trade_documents_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data)
    VALUES ('trade_documents', 'DELETE', OLD.id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, old_data, new_data)
    VALUES ('trade_documents', 'UPDATE', NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO content_audit_log (table_name, operation, record_id, changed_by, new_data)
    VALUES ('trade_documents', 'INSERT', NEW.id, auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: log_unauthorized_access(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_unauthorized_access(_route text, _details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.security_audit_events (event_type, source, user_id, details)
  VALUES (
    'unauthorized_access',
    'client',
    auth.uid(),
    jsonb_build_object('route', _route) || COALESCE(_details, '{}'::jsonb)
  );
END;
$$;


--
-- Name: map_country_to_region_tier(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.map_country_to_region_tier(_country text) RETURNS public.region_tier
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(_country,''))) IN (
      'singapore','sg','malaysia','my','indonesia','id','thailand','th','vietnam','viet nam','vn',
      'philippines','ph','brunei','bn','cambodia','kh','laos','lao pdr','la','myanmar','burma','mm'
    ) THEN 'ASEAN'::public.region_tier
    WHEN lower(trim(coalesce(_country,''))) IN (
      'united arab emirates','uae','u.a.e.','ae','saudi arabia','ksa','sa','kingdom of saudi arabia',
      'qatar','qa','kuwait','kw','bahrain','bh','oman','om'
    ) THEN 'GCC'::public.region_tier
    ELSE 'ROW'::public.region_tier
  END
$$;


--
-- Name: match_catalog(public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_catalog(query_embedding public.vector, match_count integer DEFAULT 40) RETURNS TABLE(id uuid, source text, title text, designer text, materials text, category text, subcategory text, lead_time text, origin text, default_ship_mode text, currency text, trade_price_cents integer, price_prefix text, stock_status text, dimensions text, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH picks AS (
    SELECT
      p.id,
      'curator'::text AS source,
      p.title,
      COALESCE(d.display_name, d.name, 'Unknown') AS designer,
      p.materials,
      p.category,
      p.subcategory,
      p.lead_time,
      p.origin,
      p.default_ship_mode,
      p.currency,
      p.trade_price_cents,
      p.price_prefix,
      NULL::text AS stock_status,
      p.dimensions,
      1 - (p.embedding <=> query_embedding) AS similarity
    FROM public.designer_curator_picks p
    LEFT JOIN public.designers d ON d.id = p.designer_id
    WHERE p.embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count
  ),
  trades AS (
    SELECT
      t.id,
      'trade'::text AS source,
      t.product_name AS title,
      COALESCE(NULLIF(split_part(t.brand_name, ' - ', 1), ''), t.brand_name, 'Unknown') AS designer,
      t.materials,
      t.category,
      t.subcategory,
      t.lead_time,
      t.origin,
      t.default_ship_mode,
      t.currency,
      t.trade_price_cents,
      t.price_prefix,
      t.stock_status_override AS stock_status,
      t.dimensions,
      1 - (t.embedding <=> query_embedding) AS similarity
    FROM public.trade_products t
    WHERE t.embedding IS NOT NULL AND t.is_active = true
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT * FROM picks
  UNION ALL
  SELECT * FROM trades
  ORDER BY similarity DESC
  LIMIT match_count;
$$;


--
-- Name: match_catalog_filtered(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_catalog_filtered(query_embedding public.vector, match_count integer DEFAULT 40, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, source text, title text, designer text, materials text, category text, subcategory text, lead_time text, origin text, default_ship_mode text, currency text, trade_price_cents integer, price_prefix text, stock_status text, dimensions text, width_mm integer, depth_mm integer, height_mm integer, is_contract_grade boolean, similarity double precision, structural_fit double precision)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  f_category           text := nullif(filter->>'category','');
  f_subcategory        text := nullif(filter->>'subcategory','');
  f_designer           text := nullif(filter->>'designer','');
  f_max_lead_wks       int  := nullif(filter->>'max_lead_weeks','')::int;
  f_max_width_mm       int  := nullif(filter->>'max_width_mm','')::int;
  f_max_depth_mm       int  := nullif(filter->>'max_depth_mm','')::int;
  f_max_height_mm      int  := nullif(filter->>'max_height_mm','')::int;
  f_contract_only      boolean := coalesce((filter->>'contract_grade_only')::boolean, false);
  active_count         int  := (case when f_category is null then 0 else 1 end)
                             + (case when f_subcategory is null then 0 else 1 end)
                             + (case when f_designer is null then 0 else 1 end)
                             + (case when f_max_lead_wks is null then 0 else 1 end)
                             + (case when f_max_width_mm is null then 0 else 1 end)
                             + (case when f_max_depth_mm is null then 0 else 1 end)
                             + (case when f_max_height_mm is null then 0 else 1 end)
                             + (case when f_contract_only then 1 else 0 end);
  pool int := greatest(match_count * 4, 80);
begin
  return query
  with picks as (
    select
      p.id,
      'curator'::text as source,
      p.title,
      coalesce(d.display_name, d.name, 'Unknown') as designer,
      p.materials,
      p.category,
      p.subcategory,
      p.lead_time,
      NULL::smallint as lead_time_weeks_max,
      p.origin,
      p.default_ship_mode,
      p.currency,
      p.trade_price_cents,
      p.price_prefix,
      null::text as stock_status,
      p.dimensions,
      null::int as width_mm,
      null::int as depth_mm,
      null::int as height_mm,
      false as is_contract_grade,
      1 - (p.embedding <=> query_embedding) as similarity
    from public.designer_curator_picks p
    left join public.designers d on d.id = p.designer_id
    where p.embedding is not null
    order by p.embedding <=> query_embedding
    limit pool
  ),
  trades as (
    select
      t.id,
      'trade'::text as source,
      t.product_name as title,
      t.brand_name as designer,
      t.materials,
      t.category,
      t.subcategory,
      t.lead_time,
      t.lead_time_weeks_max,
      t.origin,
      t.default_ship_mode,
      t.currency,
      t.trade_price_cents,
      t.price_prefix,
      t.stock_status_override as stock_status,
      t.dimensions,
      t.width_mm,
      t.depth_mm,
      t.height_mm,
      coalesce(t.is_contract_grade, false) as is_contract_grade,
      1 - (t.embedding <=> query_embedding) as similarity
    from public.trade_products t
    where t.embedding is not null
      and t.is_active is true
      and coalesce(t.is_hidden, false) = false
    order by t.embedding <=> query_embedding
    limit pool
  ),
  unioned as (
    select * from picks
    union all
    select * from trades
  ),
  scored as (
    select
      u.*,
      case when active_count = 0 then 1.0::double precision else
        (
          (case when f_category    is not null and u.category    ilike '%'||f_category||'%'    then 1 else 0 end)
        + (case when f_subcategory is not null and u.subcategory ilike '%'||f_subcategory||'%' then 1 else 0 end)
        + (case when f_designer    is not null and u.designer    ilike '%'||f_designer||'%'    then 1 else 0 end)
        + (case
             when f_max_lead_wks is null then 0
             when u.lead_time_weeks_max is not null then
               case when u.lead_time_weeks_max <= f_max_lead_wks then 1 else 0 end
             when u.lead_time is null then 0
             else case
               when (regexp_match(u.lead_time,'(\d+)\s*(?:-|–|to)\s*(\d+)'))[2]::int <= f_max_lead_wks then 1
               when (regexp_match(u.lead_time,'(\d+)'))[1]::int <= f_max_lead_wks then 1
               else 0
             end
           end)
        + (case when f_max_width_mm  is not null and u.width_mm  is not null and u.width_mm  <= f_max_width_mm  then 1 else 0 end)
        + (case when f_max_depth_mm  is not null and u.depth_mm  is not null and u.depth_mm  <= f_max_depth_mm  then 1 else 0 end)
        + (case when f_max_height_mm is not null and u.height_mm is not null and u.height_mm <= f_max_height_mm then 1 else 0 end)
        + (case when f_contract_only and u.is_contract_grade then 1 else 0 end)
        )::double precision / active_count
      end as structural_fit_raw
    from unioned u
  )
  select
    s.id, s.source, s.title, s.designer, s.materials, s.category, s.subcategory,
    s.lead_time, s.origin, s.default_ship_mode, s.currency, s.trade_price_cents,
    s.price_prefix, s.stock_status, s.dimensions,
    s.width_mm, s.depth_mm, s.height_mm, s.is_contract_grade,
    s.similarity,
    s.structural_fit_raw as structural_fit
  from scored s
  where
    (f_category    is null or s.category    ilike '%'||f_category||'%')
    and (f_subcategory is null or s.subcategory ilike '%'||f_subcategory||'%')
    and (f_designer    is null or s.designer    ilike '%'||f_designer||'%')
    and (f_max_width_mm  is null or s.width_mm  is null or s.width_mm  <= f_max_width_mm)
    and (f_max_depth_mm  is null or s.depth_mm  is null or s.depth_mm  <= f_max_depth_mm)
    and (f_max_height_mm is null or s.height_mm is null or s.height_mm <= f_max_height_mm)
    and (not f_contract_only or s.is_contract_grade)
  order by (0.7 * s.similarity + 0.3 * s.structural_fit_raw) desc
  limit match_count;
end;
$$;


--
-- Name: match_roster_public(public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_roster_public(query_embedding public.vector, match_count integer DEFAULT 6) RETURNS TABLE(name text, specialty text, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    r.name,
    r.specialty,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.concierge_roster_embeddings r
  ORDER BY r.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;


--
-- Name: match_semantic_cache(text, text, public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_semantic_cache(_feature text, _model text, _query_embedding public.vector, _threshold double precision DEFAULT 0.92, _limit integer DEFAULT 1) RETURNS TABLE(id uuid, prompt text, response_json jsonb, prompt_tokens integer, completion_tokens integer, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    c.id,
    c.prompt,
    c.response_json,
    c.prompt_tokens,
    c.completion_tokens,
    1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.ai_semantic_cache c
  WHERE c.feature = _feature
    AND c.model = _model
    AND c.embedding IS NOT NULL
    AND c.expires_at > now()
    AND 1 - (c.embedding <=> _query_embedding) >= _threshold
  ORDER BY c.embedding <=> _query_embedding
  LIMIT GREATEST(_limit, 1);
$$;


--
-- Name: match_trade_products(public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_trade_products(query_embedding public.vector, match_threshold double precision, match_count integer) RETURNS TABLE(id uuid, product_name text, brand_name text, category text, subcategory text, description text, materials text, dimensions text, trade_price_cents integer, currency text, image_url text, designer_id uuid, designer_name text, designer_slug text, designer_country text, similarity double precision)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT
    t.id,
    t.product_name,
    t.brand_name,
    t.category,
    t.subcategory,
    t.description,
    t.materials,
    t.dimensions,
    t.trade_price_cents,
    t.currency,
    t.image_url,
    d.id AS designer_id,
    COALESCE(d.display_name, d.name) AS designer_name,
    d.slug AS designer_slug,
    d.country AS designer_country,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.trade_products t
  LEFT JOIN public.designer_curator_picks p ON p.id = t.source_pick_id
  LEFT JOIN public.designers d ON d.id = p.designer_id
  WHERE t.embedding IS NOT NULL
    AND t.is_active = true
    AND t.is_hidden = false
    AND 1 - (t.embedding <=> query_embedding) >= match_threshold
  ORDER BY t.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;


--
-- Name: move_to_dlq(text, text, bigint, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;


--
-- Name: next_designer_po_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_designer_po_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  seq INTEGER;
  today TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MMDD');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('designer_po_sequence'));
  SELECT COUNT(*) + 1 INTO seq
  FROM public.designer_purchase_orders
  WHERE po_number LIKE 'PO-' || today || '-%';
  RETURN 'PO-' || today || '-' || lpad(seq::TEXT, 3, '0');
END;
$$;


--
-- Name: notify_admins_custom_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_custom_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_id uuid;
  notif_title text;
  notif_message text;
  notif_type text;
  actor uuid := auth.uid();
  link_url text := '/trade/custom-requests?focus=' || NEW.id::text;
  product_label text := COALESCE(NEW.product_name, 'a product');
  requester_name text;
  requester_company text;
  project_name text;
  project_location text;
  meta jsonb;
BEGIN
  IF actor IS NOT NULL AND has_role(actor, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    notif_title := 'New custom request';
    notif_type := 'custom_request_new';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.dimension_changes IS DISTINCT FROM OLD.dimension_changes
       OR NEW.finish_notes IS DISTINCT FROM OLD.finish_notes
       OR NEW.com_col_fabric IS DISTINCT FROM OLD.com_col_fabric
       OR NEW.com_yardage_meters IS DISTINCT FROM OLD.com_yardage_meters
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.target_lead_weeks IS DISTINCT FROM OLD.target_lead_weeks
       OR NEW.budget_notes IS DISTINCT FROM OLD.budget_notes THEN
      notif_title := 'Custom request updated';
      notif_type := 'custom_request_updated';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  SELECT TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), p.company
    INTO requester_name, requester_company
    FROM public.profiles p WHERE p.id = NEW.user_id;

  IF NEW.project_id IS NOT NULL THEN
    SELECT pr.name, pr.location
      INTO project_name, project_location
      FROM public.projects pr WHERE pr.id = NEW.project_id;
  END IF;

  notif_message :=
    COALESCE(NULLIF(requester_name, ''), 'A trade user')
    || ' • ' || product_label
    || COALESCE(' (' || NULLIF(NEW.brand_name, '') || ')', '')
    || COALESCE(' — ' || NULLIF(project_name, ''), '')
    || ' — status: ' || NEW.status;

  meta := jsonb_build_object(
    'request_id', NEW.id,
    'requester_name', COALESCE(requester_name, ''),
    'requester_company', COALESCE(requester_company, ''),
    'product_name', product_label,
    'brand_name', COALESCE(NEW.brand_name, ''),
    'project_name', COALESCE(project_name, ''),
    'project_location', COALESCE(project_location, ''),
    'status', NEW.status,
    'quantity', NEW.quantity,
    'action_label', 'Open request',
    'action_link', link_url
  );

  FOR admin_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, title, message, link, type, metadata)
    VALUES (admin_id, notif_title, notif_message, link_url, notif_type, meta);
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: notify_admins_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/notify-new-order',
      body := jsonb_build_object(
        'product_name', NEW.product_name,
        'selected_finish', NEW.selected_finish,
        'amount_total', NEW.amount_total,
        'currency', NEW.currency,
        'customer_email', NEW.customer_email,
        'transaction_id', NEW.transaction_id,
        'status', NEW.status,
        'created_at', NEW.created_at
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_admins_new_registration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_new_registration() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_record RECORD;
  supabase_url text;
  service_key text;
BEGIN
  -- Insert a bell notification for every admin/super_admin
  FOR admin_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
      AND ur.user_id != NEW.id
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_record.user_id,
      'New User Registration',
      'A new user has registered: ' || COALESCE(NEW.email, 'unknown'),
      'registration',
      '/trade/admin'
    );
  END LOOP;

  -- Send email notification via edge function
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/notify-new-registration',
      body := jsonb_build_object(
        'email', NEW.email,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'company', NEW.company
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_admins_production_render(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_production_render(_render_title text, _engine text, _requester_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_record.user_id,
      'Production Render Requested',
      _requester_name || ' requested a ' || _engine || ' render: ' || _render_title,
      'production_render',
      '/trade/quotes'
    );
  END LOOP;
END;
$$;


--
-- Name: owns_client_board(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_client_board(_user_id uuid, _board_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_boards b
    WHERE b.id = _board_id AND b.user_id = _user_id
  )
$$;


--
-- Name: owns_trade_quote(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_trade_quote(_user_id uuid, _quote_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_quotes q
    WHERE q.id = _quote_id AND q.user_id = _user_id
  )
$$;


--
-- Name: parse_dimensions_to_mm(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parse_dimensions_to_mm(dim_text text) RETURNS TABLE(width_mm integer, depth_mm integer, height_mm integer, seat_height_mm integer)
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  t text := coalesce(dim_text,'');
  in_mm boolean;
  m_w text; m_d text; m_l text; m_h text; m_sh text;
  scale numeric;
begin
  in_mm := t ~* '\ymm\y';
  scale := case when in_mm then 1 else 10 end;

  m_w  := (regexp_match(t, '(?:^|[^A-Za-z])W[\.\s:]*([0-9]+(?:\.[0-9]+)?)', 'i'))[1];
  m_d  := (regexp_match(t, '(?:^|[^A-Za-z])D[\.\s:]*([0-9]+(?:\.[0-9]+)?)', 'i'))[1];
  m_l  := (regexp_match(t, '(?:^|[^A-Za-z])L[\.\s:]*([0-9]+(?:\.[0-9]+)?)', 'i'))[1];
  m_h  := (regexp_match(t, '(?:^|[^A-Za-z])H[\.\s:]*([0-9]+(?:\.[0-9]+)?)', 'i'))[1];
  m_sh := (regexp_match(t, 'seat\s*height[^0-9]*([0-9]+(?:\.[0-9]+)?)', 'i'))[1];

  width_mm  := case when m_w  is not null then round(m_w::numeric  * scale) else null end;
  depth_mm  := case
                 when m_d is not null then round(m_d::numeric * scale)
                 when m_l is not null then round(m_l::numeric * scale)
                 else null
               end;
  height_mm := case when m_h  is not null then round(m_h::numeric  * scale) else null end;
  seat_height_mm := case when m_sh is not null then round(m_sh::numeric * scale) else null end;

  return next;
end;
$$;


--
-- Name: parse_lead_weeks(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.parse_lead_weeks(p_text text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
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


--
-- Name: pick_is_publicly_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pick_is_publicly_visible(_pick_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.designer_curator_picks p
    JOIN public.designers d ON d.id = p.designer_id
    WHERE p.id = _pick_id
      AND COALESCE(p.is_hidden, false) = false
      AND COALESCE(d.trade_only, false) = false
  )
$$;


--
-- Name: prevent_profile_tier_self_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_tier_self_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier
     OR NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested
     OR NEW.trade_tier_12mo_spend_cents IS DISTINCT FROM OLD.trade_tier_12mo_spend_cents
     OR NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    RAISE EXCEPTION 'Only admins can modify trade_tier fields';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_profile_tier_self_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_tier_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF COALESCE(current_setting('app.bypass_profile_guard', true), '') = 'on'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ignore any client-supplied values for protected tier fields.
    NEW.trade_tier := 'standard'::trade_tier;
    NEW.trade_tier_locked_by_admin := FALSE;
    NEW.trade_tier_suggested := NULL;
    NEW.trade_tier_computed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier
     OR NEW.trade_tier_locked_by_admin IS DISTINCT FROM OLD.trade_tier_locked_by_admin
     OR NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested
     OR NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    RAISE EXCEPTION 'Only admins can modify trade tier fields';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_quote_item_price_self_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_quote_item_price_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.unit_price_cents := NULL;
    NEW.unit_price_currency := NULL;
    NEW.fabric_upcharge_cents := NULL;
    NEW.fabric_currency := NULL;
    RETURN NEW;
  END IF;

  IF NEW.unit_price_cents IS DISTINCT FROM OLD.unit_price_cents
     OR NEW.unit_price_currency IS DISTINCT FROM OLD.unit_price_currency
     OR NEW.fabric_upcharge_cents IS DISTINCT FROM OLD.fabric_upcharge_cents
     OR NEW.fabric_currency IS DISTINCT FROM OLD.fabric_currency THEN
    RAISE EXCEPTION 'Only admins can modify quote item pricing fields';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_quote_pricing_self_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_quote_pricing_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.net_discount_pct := 0;
    NEW.commission_pct := 0;
    NEW.credit_applied_cents := 0;
    NEW.insurance_rate_bps := 0;
    RETURN NEW;
  END IF;

  IF NEW.net_discount_pct IS DISTINCT FROM OLD.net_discount_pct
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.credit_applied_cents IS DISTINCT FROM OLD.credit_applied_cents
     OR NEW.insurance_rate_bps IS DISTINCT FROM OLD.insurance_rate_bps
     OR NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'Only admins can modify quote pricing/discount/commission fields';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: profile_privileged_fields_unchanged(uuid, public.trade_tier, public.trade_tier, boolean, bigint, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_privileged_fields_unchanged(_id uuid, _trade_tier public.trade_tier, _trade_tier_suggested public.trade_tier, _trade_tier_locked_by_admin boolean, _trade_tier_12mo_spend_cents bigint, _trade_tier_computed_at timestamp with time zone, _trade_status text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND p.trade_tier IS NOT DISTINCT FROM _trade_tier
      AND p.trade_tier_suggested IS NOT DISTINCT FROM _trade_tier_suggested
      AND p.trade_tier_locked_by_admin IS NOT DISTINCT FROM _trade_tier_locked_by_admin
      AND p.trade_tier_12mo_spend_cents IS NOT DISTINCT FROM _trade_tier_12mo_spend_cents
      AND p.trade_tier_computed_at IS NOT DISTINCT FROM _trade_tier_computed_at
      AND p.trade_status IS NOT DISTINCT FROM _trade_status
  );
$$;


--
-- Name: protect_trade_application_privileged_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_trade_application_privileged_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.tax_exempt_status := OLD.tax_exempt_status;
  RETURN NEW;
END;
$$;


--
-- Name: purge_stale_concierge_streams(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_stale_concierge_streams() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from public.concierge_stream_sessions
   where created_at < now() - interval '1 hour';
$$;


--
-- Name: read_email_batch(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;


--
-- Name: realtime_topic_allowed(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    _uid IS NOT NULL
    AND (
      _topic = 'user:' || _uid::text
      OR _topic LIKE ('user:' || _uid::text || '-%')
      OR _topic = 'notifications-' || _uid::text
      OR _topic = 'pending-invites-' || _uid::text
      OR _topic = 'studio-memberships-' || _uid::text
      OR _topic = 'sample-requests-' || _uid::text
      OR (
        _topic LIKE 'concierge:%'
        AND EXISTS (
          SELECT 1 FROM public.concierge_stream_sessions s
          WHERE s.stream_id::text = substring(_topic from 11)
            AND s.user_id = _uid
        )
      )
      OR (
        _topic LIKE 'studio-%'
        AND EXISTS (
          SELECT 1 FROM public.studio_members m
          WHERE m.user_id = _uid
            AND _topic = 'studio-' || m.studio_id::text
        )
      )
      OR (
        _topic LIKE 'quote-%'
        AND EXISTS (
          SELECT 1 FROM public.trade_quotes q
          WHERE _topic = 'quote-' || q.id::text
            AND (
              q.user_id = _uid
              OR (
                q.studio_id IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM public.studio_members m
                  WHERE m.studio_id = q.studio_id AND m.user_id = _uid
                )
              )
            )
        )
      )
    )
$$;


--
-- Name: recompute_client_tier_eligibility(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_client_tier_eligibility(_client_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  gold_min bigint;
  plat_min bigint;
BEGIN
  SELECT coalesce(min_spend_cents, 5000000)::bigint INTO gold_min FROM public.trade_tier_config WHERE tier = 'gold';
  SELECT coalesce(min_spend_cents, 20000000)::bigint INTO plat_min FROM public.trade_tier_config WHERE tier = 'platinum';
  gold_min := coalesce(gold_min, 5000000);
  plat_min := coalesce(plat_min, 20000000);

  WITH spend AS (
    SELECT q.client_id,
           coalesce(sum(i.quantity * i.unit_price_cents), 0)::bigint AS cents
    FROM public.trade_quotes q
    JOIN public.trade_quote_items i ON i.quote_id = q.id
    WHERE q.client_id IS NOT NULL
      AND (q.status IN ('confirmed', 'accepted', 'ordered') OR q.confirmed_at IS NOT NULL)
      AND coalesce(q.confirmed_at, q.updated_at, q.created_at) >= now() - interval '12 months'
    GROUP BY q.client_id
  )
  UPDATE public.clients c
  SET rolling_12m_spend_cents = coalesce(s.cents, 0),
      eligible_tier = CASE
        WHEN coalesce(s.cents, 0) >= plat_min THEN 'platinum'
        WHEN coalesce(s.cents, 0) >= gold_min THEN 'gold'
        ELSE NULL
      END,
      eligible_for_upgrade = CASE
        WHEN coalesce(s.cents, 0) >= plat_min THEN public.tier_rank('platinum') > public.tier_rank(c.assigned_tier)
        WHEN coalesce(s.cents, 0) >= gold_min THEN public.tier_rank('gold') > public.tier_rank(c.assigned_tier)
        ELSE false
      END,
      tier_computed_at = now()
  FROM (SELECT id FROM public.clients WHERE _client_id IS NULL OR id = _client_id) t
  LEFT JOIN spend s ON s.client_id = t.id
  WHERE c.id = t.id;
END;
$$;


--
-- Name: recompute_trade_tier_suggestions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_trade_tier_suggestions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _updated integer := 0;
  _gold_min bigint;
  _plat_min bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can recompute tier suggestions';
  END IF;

  SELECT min_spend_cents INTO _gold_min FROM public.trade_tier_config WHERE tier = 'gold';
  SELECT min_spend_cents INTO _plat_min FROM public.trade_tier_config WHERE tier = 'platinum';
  _gold_min := COALESCE(_gold_min, 5000000);
  _plat_min := COALESCE(_plat_min, 20000000);

  WITH spend AS (
    SELECT tq.user_id,
           COALESCE(SUM(qi.quantity * COALESCE(qi.unit_price_cents, 0)), 0)::bigint AS cents
    FROM public.trade_quotes tq
    LEFT JOIN public.trade_quote_items qi ON qi.quote_id = tq.id
    WHERE tq.status = 'paid'
      AND tq.updated_at >= now() - interval '365 days'
    GROUP BY tq.user_id
  )
  UPDATE public.profiles p
     SET trade_tier_12mo_spend_cents = COALESCE(s.cents, 0),
         trade_tier_suggested = CASE
           WHEN COALESCE(s.cents,0) >= _plat_min THEN 'platinum'::public.trade_tier
           WHEN COALESCE(s.cents,0) >= _gold_min THEN 'gold'::public.trade_tier
           ELSE 'silver'::public.trade_tier
         END,
         trade_tier_computed_at = now()
    FROM (SELECT id FROM public.profiles) ids
    LEFT JOIN spend s ON s.user_id = ids.id
   WHERE p.id = ids.id;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;


--
-- Name: record_security_event(text, text, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_security_event(_event_type text, _source text, _user_id uuid DEFAULT NULL::uuid, _ip text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO public.security_audit_events (event_type, source, user_id, ip, details)
  VALUES (_event_type, _source, _user_id, _ip, COALESCE(_details, '{}'::jsonb))
  RETURNING id;
$$;


--
-- Name: redeem_portal_invite(text, text, inet, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invite public.portal_invites;
  v_session_id uuid;
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;
  IF _corporate_id IS NULL OR length(trim(_corporate_id)) < 2 THEN
    RAISE EXCEPTION 'invalid_corporate_id' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invite
  FROM public.portal_invites
  WHERE code = trim(_code) AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  v_expires := now() + interval '30 days';

  INSERT INTO public.portal_sessions (invite_id, corporate_id, ip_address, user_agent, expires_at)
  VALUES (v_invite.id, trim(_corporate_id), _ip, _user_agent, v_expires)
  RETURNING id, token INTO v_session_id, v_token;

  UPDATE public.portal_invites
  SET uses_count = uses_count + 1,
      is_active = CASE WHEN uses_count + 1 >= max_uses THEN false ELSE is_active END
  WHERE id = v_invite.id;

  INSERT INTO public.portal_redemptions (invite_id, session_id, corporate_id, ip_address, user_agent)
  VALUES (v_invite.id, v_session_id, trim(_corporate_id), _ip, _user_agent);

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires,
    'invited_name', v_invite.invited_name,
    'invited_company', v_invite.invited_company
  );
END;
$$;


--
-- Name: refresh_product_fabric_swatches_public(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_product_fabric_swatches_public() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  TRUNCATE TABLE public.product_fabric_swatches_public;

  INSERT INTO public.product_fabric_swatches_public (
    pick_id, fabric_id, sort_order, price_tier_label, image_indices,
    name, image_url, category, supplier, is_active, updated_at
  )
  SELECT
    pf.pick_id, pf.fabric_id, pf.sort_order, pf.price_tier_label, pf.image_indices,
    f.name, f.image_url, f.category, f.supplier, f.is_active, now()
  FROM public.product_fabrics pf
  JOIN public.fabrics f ON f.id = pf.fabric_id
  WHERE f.is_active = true
    AND pf.pick_id IS NOT NULL;

  RETURN NULL;
END;
$$;


--
-- Name: release_ingestion_lease(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_ingestion_lease(_owner text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.ingestion_job_state
     SET lease_until = NULL, lease_owner = NULL
   WHERE id AND lease_owner = _owner;
$$;


--
-- Name: remap_product_descriptors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remap_product_descriptors() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.product_descriptor_links;

  WITH src AS (
    SELECT id AS pid, NULL::uuid AS kid, materials FROM public.trade_products
    WHERE materials IS NOT NULL AND materials <> ''
    UNION ALL
    SELECT NULL, id, materials FROM public.designer_curator_picks
    WHERE materials IS NOT NULL AND materials <> ''
  ),
  tokens AS (
    SELECT pid, kid, lower(trim(regexp_replace(t, '\s+', ' ', 'g'))) AS token
    FROM src, LATERAL regexp_split_to_table(materials, '[·•,&/():\]\n]| and | with | or ') AS t
    WHERE length(trim(t)) > 1
  ),
  descriptors AS (
    SELECT id, lower(unnest(synonyms)) AS syn
    FROM public.descriptor_taxonomy WHERE is_active
  ),
  matches AS (
    SELECT DISTINCT t.pid, t.kid, d.id AS descriptor_id
    FROM tokens t JOIN descriptors d
      ON t.token ~ ('\m'||regexp_replace(d.syn,'([.+*?()\[\]{}|\\^$])','\\\1','g')||'\M')
  )
  INSERT INTO public.product_descriptor_links (product_id, pick_id, descriptor_id)
  SELECT pid, kid, descriptor_id FROM matches
  ON CONFLICT DO NOTHING;

  SELECT count(*)::int INTO n FROM public.product_descriptor_links;
  RETURN n;
END;
$_$;


--
-- Name: rotate_board_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rotate_board_token(_board_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _new_token text;
BEGIN
  -- Only the board owner can rotate
  IF NOT EXISTS (
    SELECT 1 FROM client_boards WHERE id = _board_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to rotate this token';
  END IF;

  _new_token := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE client_boards
  SET share_token = _new_token,
      token_expires_at = now() + interval '30 days',
      token_rotated_at = now(),
      updated_at = now()
  WHERE id = _board_id;

  RETURN _new_token;
END;
$$;


--
-- Name: route_cc_tapis_pick_to_collab(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.route_cc_tapis_pick_to_collab() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_slug text;
  target_id uuid;
BEGIN
  SELECT slug INTO current_slug FROM public.designers WHERE id = NEW.designer_id;
  IF current_slug IS NULL OR current_slug = 'cc-tapis' OR current_slug LIKE '%-cc-tapis' THEN
    RETURN NEW;
  END IF;

  IF NOT (
    COALESCE(NEW.title, '')    ILIKE '%cc-tapis%' OR
    COALESCE(NEW.title, '')    ILIKE '%cc tapis%' OR
    COALESCE(NEW.subtitle, '') ILIKE '%cc-tapis%' OR
    COALESCE(NEW.subtitle, '') ILIKE '%cc tapis%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO target_id
  FROM public.designers
  WHERE slug = current_slug || '-cc-tapis';

  IF target_id IS NOT NULL THEN
    NEW.designer_id := target_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sanitize_biography_citations(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_biography_citations(input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
DECLARE
  result text := input;
  media_host_re text := '(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|res\.cloudinary\.com|supabase\.co|supabase\.in)';
BEGIN
  IF result IS NULL OR result = '' THEN
    RETURN result;
  END IF;

  result := regexp_replace(result, '\[([^\]]+)\]\(https?://[^)]+\)', '\1', 'g');
  result := regexp_replace(result, '\s*\[Sources?:[^\]]*\]', '', 'gi');
  result := regexp_replace(
    result,
    '(^|\n)[ \t]*https?://(?!([^\s/]+\.)?' || media_host_re || ')[^\s\n]+(\s*\|[^\n]*)?(?=\n|$)',
    '\1',
    'g'
  );
  result := regexp_replace(result, '\n{3,}', E'\n\n', 'g');

  RETURN result;
END;
$_$;


--
-- Name: FUNCTION sanitize_biography_citations(input text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sanitize_biography_citations(input text) IS 'Removes [text](url) markdown links and bare non-media URL lines from biography text. Preserves standalone YouTube/Vimeo/Cloudinary URLs so the editorial renderer can embed them.';


--
-- Name: scan_sec_query(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.scan_sec_query(_sql text) RETURNS SETOF json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog', 'information_schema'
    AS $$
BEGIN
  -- Hard guards: only allow read-only catalog queries.
  IF _sql ~* '\\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|comment|copy|do|call|vacuum|analyze|reindex|cluster|reset|set\\s+role|set\\s+session)\\b' THEN
    RAISE EXCEPTION 'scan_sec_query: write/DDL statements rejected';
  END IF;
  IF _sql !~* '^\\s*(with|select)\\b' THEN
    RAISE EXCEPTION 'scan_sec_query: only WITH/SELECT allowed';
  END IF;
  RETURN QUERY EXECUTE 'select row_to_json(t) from (' || _sql || ') t';
END;
$$;


--
-- Name: set_curator_pick_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_curator_pick_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  base_slug text;
  candidate text;
  n int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.compute_curator_pick_slug(NEW.title, NEW.subtitle);
    IF base_slug = '' THEN
      base_slug := public.slugify_text(NEW.title);
    END IF;
    candidate := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.designer_curator_picks
      WHERE designer_id = NEW.designer_id
        AND slug = candidate
        AND id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base_slug || '-' || n::text;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_region_tier_from_country(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_region_tier_from_country() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.region_tier := public.map_country_to_region_tier(NEW.country);
  RETURN NEW;
END;
$$;


--
-- Name: slugify_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify_text(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(input, '')), '['']', '', 'g'),
             '[^a-z0-9]+', '-', 'g'))
$$;


--
-- Name: strip_public_variant_prices(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.strip_public_variant_prices(_variants jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN _variants IS NULL THEN NULL
    WHEN jsonb_typeof(_variants) = 'array' THEN (
      SELECT COALESCE(
        jsonb_agg(elem - 'price_cents' - 'trade_price_cents' - 'price_per_sqm_cents' - 'price' - 'currency'),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(_variants) AS elem
    )
    WHEN jsonb_typeof(_variants) = 'object' THEN
      _variants - 'price_cents' - 'trade_price_cents' - 'price_per_sqm_cents' - 'price' - 'currency'
    ELSE _variants
  END;
$$;


--
-- Name: studio_has_resale_cert_for_state(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.studio_has_resale_cert_for_state(_studio_id uuid, _state text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.studio_resale_certificates
    WHERE studio_id = _studio_id
      AND upper(state_code) = upper(_state)
      AND verification_status = 'verified'
      AND (expires_on IS NULL OR expires_on >= current_date)
  );
$$;


--
-- Name: sync_curator_pick_to_trade_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_curator_pick_to_trade_product() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _brand_name text;
  _existing_id uuid;
  _rrp_cents integer;
  _pick_age_sec numeric;
BEGIN
  SELECT name INTO _brand_name FROM public.designers WHERE id = NEW.designer_id;
  IF _brand_name IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  _rrp_cents := NEW.trade_price_cents;

  SELECT id INTO _existing_id
  FROM public.trade_products
  WHERE source_pick_id = NEW.id
  LIMIT 1;

  IF _existing_id IS NULL THEN
    SELECT id INTO _existing_id
    FROM public.trade_products
    WHERE brand_name = _brand_name AND product_name = NEW.title
    LIMIT 1;
  END IF;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.trade_products tp
    SET
      product_name          = NEW.title,
      source_pick_id        = NEW.id,
      trade_price_cents     = COALESCE(NEW.trade_price_cents,     tp.trade_price_cents),
      rrp_price_cents       = COALESCE(_rrp_cents,                tp.rrp_price_cents),
      price_per_sqm_cents   = COALESCE(NEW.price_per_sqm_cents,   tp.price_per_sqm_cents),
      currency              = COALESCE(NULLIF(NEW.currency, ''),  tp.currency),
      category              = COALESCE(NULLIF(NEW.category, ''),  tp.category),
      lead_time             = NULLIF(NEW.lead_time, ''),
      dimensions            = NULLIF(NEW.dimensions, ''),
      materials             = NULLIF(NEW.materials, ''),
      description           = NULLIF(NEW.description, ''),
      meta_description      = NULLIF(NEW.meta_description, ''),
      image_url             = NULLIF(NEW.image_url, ''),
      subcategory           = NULLIF(NEW.subcategory, ''),
      origin                = NULLIF(NEW.origin, ''),
      price_prefix          = NULLIF(NEW.price_prefix, ''),
      gallery_images        = NEW.gallery_images,
      spec_sheet_url        = NULLIF(NEW.pdf_url, ''),
      pdf_urls              = NEW.pdf_urls,
      pack_cbm              = NEW.pack_cbm,
      pack_weight_kg        = NEW.pack_weight_kg,
      pack_carton_count     = NEW.pack_carton_count,
      default_ship_mode     = NULLIF(NEW.default_ship_mode, ''),
      pickup_country        = NULLIF(NEW.pickup_country, ''),
      pickup_postcode       = NULLIF(NEW.pickup_postcode, ''),
      pickup_address        = NULLIF(NEW.pickup_address, ''),
      hs_code               = NULLIF(NEW.hs_code, ''),
      is_upholstered        = NEW.is_upholstered,
      size_variants         = NEW.size_variants,
      variant_image_map     = NEW.variant_image_map,
      base_axis_label       = NULLIF(NEW.base_axis_label, ''),
      top_axis_label        = NULLIF(NEW.top_axis_label, ''),
      variant_placeholder   = NULLIF(NEW.variant_placeholder, ''),
      wood_label_override   = NULLIF(NEW.wood_label_override, ''),
      width_mm              = COALESCE(NEW.width_mm,          tp.width_mm),
      depth_mm              = COALESCE(NEW.depth_mm,          tp.depth_mm),
      height_mm             = COALESCE(NEW.height_mm,         tp.height_mm),
      seat_height_mm        = COALESCE(NEW.seat_height_mm,    tp.seat_height_mm),
      is_contract_grade     = NEW.is_contract_grade,
      is_active             = true,
      updated_at            = now()
    WHERE tp.id = _existing_id;
    RETURN NEW;
  END IF;

  _pick_age_sec := EXTRACT(EPOCH FROM (now() - NEW.created_at));
  IF char_length(btrim(NEW.title)) < 6
     OR NULLIF(btrim(COALESCE(NEW.image_url, '')), '') IS NULL
     OR _pick_age_sec < 5 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.trade_products (
    brand_name, product_name, category, subcategory,
    trade_price_cents, rrp_price_cents, price_per_sqm_cents, currency,
    dimensions, materials, description, meta_description,
    lead_time, image_url, gallery_images,
    spec_sheet_url, pdf_urls, origin, price_prefix,
    pack_cbm, pack_weight_kg, pack_carton_count,
    default_ship_mode, pickup_country, pickup_postcode, pickup_address,
    hs_code, is_upholstered,
    size_variants, variant_image_map,
    base_axis_label, top_axis_label, variant_placeholder, wood_label_override,
    width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade,
    is_active, source_pick_id
  )
  VALUES (
    _brand_name, NEW.title,
    COALESCE(NULLIF(NEW.category,''), 'Other'),
    NULLIF(NEW.subcategory,''),
    NEW.trade_price_cents, _rrp_cents, NEW.price_per_sqm_cents,
    COALESCE(NULLIF(NEW.currency,''), 'EUR'),
    NULLIF(NEW.dimensions,''), NULLIF(NEW.materials,''), NULLIF(NEW.description,''), NULLIF(NEW.meta_description,''),
    NULLIF(NEW.lead_time,''), NULLIF(NEW.image_url,''), NEW.gallery_images,
    NULLIF(NEW.pdf_url,''), NEW.pdf_urls, NULLIF(NEW.origin,''), NULLIF(NEW.price_prefix,''),
    NEW.pack_cbm, NEW.pack_weight_kg, NEW.pack_carton_count,
    NULLIF(NEW.default_ship_mode,''), NULLIF(NEW.pickup_country,''),
    NULLIF(NEW.pickup_postcode,''), NULLIF(NEW.pickup_address,''),
    NULLIF(NEW.hs_code,''), NEW.is_upholstered,
    NEW.size_variants, NEW.variant_image_map,
    NULLIF(NEW.base_axis_label,''), NULLIF(NEW.top_axis_label,''),
    NULLIF(NEW.variant_placeholder,''), NULLIF(NEW.wood_label_override,''),
    NEW.width_mm, NEW.depth_mm, NEW.height_mm, NEW.seat_height_mm, NEW.is_contract_grade,
    true, NEW.id
  );
  RETURN NEW;
END;
$$;


--
-- Name: sync_designer_curator_picks_public(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_designer_curator_picks_public() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.designer_curator_picks_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF COALESCE(NEW.is_hidden, false) = false THEN
    INSERT INTO public.designer_curator_picks_public (
      id, designer_id, image_url, hover_image_url, title, subtitle, category,
      subcategory, tags, materials, dimensions, description, edition,
      photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, created_at,
      currency, lead_time, price_prefix, gallery_images, origin, size_variants,
      variant_placeholder, base_axis_label, top_axis_label, variant_image_map,
      is_hidden, edition_number, edition_signing, default_ship_mode,
      materials_description, gallery_captions, is_upholstered,
      wood_label_override, allow_com_col, slug
    ) VALUES (
      NEW.id, NEW.designer_id, NEW.image_url, NEW.hover_image_url, NEW.title,
      NEW.subtitle, NEW.category, NEW.subcategory, NEW.tags, NEW.materials,
      NEW.dimensions, NEW.description, NEW.edition, NEW.photo_credit,
      NEW.pdf_url, NEW.pdf_filename, NEW.pdf_urls, NEW.sort_order,
      NEW.created_at, NEW.currency, NEW.lead_time, NEW.price_prefix,
      NEW.gallery_images, NEW.origin, public.strip_public_variant_prices(NEW.size_variants), NEW.variant_placeholder,
      NEW.base_axis_label, NEW.top_axis_label, NEW.variant_image_map,
      NEW.is_hidden, NEW.edition_number, NEW.edition_signing, NEW.default_ship_mode,
      NEW.materials_description, NEW.gallery_captions, NEW.is_upholstered,
      NEW.wood_label_override, NEW.allow_com_col, NEW.slug
    )
    ON CONFLICT (id) DO UPDATE SET
      designer_id = EXCLUDED.designer_id,
      image_url = EXCLUDED.image_url,
      hover_image_url = EXCLUDED.hover_image_url,
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      tags = EXCLUDED.tags,
      materials = EXCLUDED.materials,
      dimensions = EXCLUDED.dimensions,
      description = EXCLUDED.description,
      edition = EXCLUDED.edition,
      photo_credit = EXCLUDED.photo_credit,
      pdf_url = EXCLUDED.pdf_url,
      pdf_filename = EXCLUDED.pdf_filename,
      pdf_urls = EXCLUDED.pdf_urls,
      sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at,
      currency = EXCLUDED.currency,
      lead_time = EXCLUDED.lead_time,
      price_prefix = EXCLUDED.price_prefix,
      gallery_images = EXCLUDED.gallery_images,
      origin = EXCLUDED.origin,
      size_variants = EXCLUDED.size_variants,
      variant_placeholder = EXCLUDED.variant_placeholder,
      base_axis_label = EXCLUDED.base_axis_label,
      top_axis_label = EXCLUDED.top_axis_label,
      variant_image_map = EXCLUDED.variant_image_map,
      is_hidden = EXCLUDED.is_hidden,
      edition_number = EXCLUDED.edition_number,
      edition_signing = EXCLUDED.edition_signing,
      default_ship_mode = EXCLUDED.default_ship_mode,
      materials_description = EXCLUDED.materials_description,
      gallery_captions = EXCLUDED.gallery_captions,
      is_upholstered = EXCLUDED.is_upholstered,
      wood_label_override = EXCLUDED.wood_label_override,
      allow_com_col = EXCLUDED.allow_com_col,
      slug = EXCLUDED.slug;
  ELSE
    DELETE FROM public.designer_curator_picks_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_featured_studios_public(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_featured_studios_public() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.featured_studios_public WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_published THEN
    INSERT INTO public.featured_studios_public (
      id, slug, name, tagline, bio, founded_year, team_size, location, country,
      website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
      disciplines, project_types, notable_projects, is_featured, is_published,
      sort_order, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.slug, NEW.name, NEW.tagline, NEW.bio, NEW.founded_year,
      NEW.team_size, NEW.location, NEW.country, NEW.website_url,
      NEW.instagram_handle, NEW.logo_url, NEW.hero_image_url, NEW.gallery_images,
      NEW.disciplines, NEW.project_types, NEW.notable_projects, NEW.is_featured,
      NEW.is_published, NEW.sort_order, NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      tagline = EXCLUDED.tagline,
      bio = EXCLUDED.bio,
      founded_year = EXCLUDED.founded_year,
      team_size = EXCLUDED.team_size,
      location = EXCLUDED.location,
      country = EXCLUDED.country,
      website_url = EXCLUDED.website_url,
      instagram_handle = EXCLUDED.instagram_handle,
      logo_url = EXCLUDED.logo_url,
      hero_image_url = EXCLUDED.hero_image_url,
      gallery_images = EXCLUDED.gallery_images,
      disciplines = EXCLUDED.disciplines,
      project_types = EXCLUDED.project_types,
      notable_projects = EXCLUDED.notable_projects,
      is_featured = EXCLUDED.is_featured,
      is_published = EXCLUDED.is_published,
      sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.featured_studios_public WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_inquiry_to_admin_directory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_inquiry_to_admin_directory() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_studio RECORD;
  v_first text; v_last text; v_parts text[];
BEGIN
  v_parts := regexp_split_to_array(btrim(COALESCE(NEW.name, '')), '\s+');
  v_first := COALESCE(v_parts[1], '');
  IF array_length(v_parts, 1) > 1 THEN
    v_last := array_to_string(v_parts[2:array_length(v_parts,1)], ' ');
  ELSE v_last := ''; END IF;

  FOR v_studio IN
    SELECT s.id, s.created_by FROM public.studios s
    JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
  LOOP
    PERFORM public.upsert_admin_directory_client(
      v_studio.id, v_studio.created_by,
      NULLIF(NEW.company, ''), v_first, v_last, NEW.email, NEW.phone, NULL,
      'Auto-added from ' || COALESCE(NEW.source, 'inquiry') || ' on ' || to_char(now(), 'YYYY-MM-DD')
    );
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: sync_pick_crate_specs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_pick_crate_specs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.trade_products tp
  SET crate_specs   = NEW.crate_specs,
      hs_code_rules = NEW.hs_code_rules,
      updated_at    = now()
  WHERE tp.source_pick_id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: sync_sitemap_product(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_sitemap_product() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.sitemap_products WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_active IS TRUE AND COALESCE(NEW.is_hidden, false) IS FALSE THEN
    INSERT INTO public.sitemap_products (id, updated_at)
    VALUES (NEW.id, NEW.updated_at)
    ON CONFLICT (id) DO UPDATE
    SET updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.sitemap_products WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_trade_access_on_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_trade_access_on_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'trade_user'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
       SET trade_status = 'approved'
     WHERE id = NEW.user_id;

    NEW.tax_exempt_status := TRUE;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'approved'
        AND NEW.status IN ('rejected', 'flagged', 'flagged_for_review', 'pending') THEN
    DELETE FROM public.user_roles
     WHERE user_id = NEW.user_id
       AND role = 'trade_user'::public.app_role;

    UPDATE public.profiles
       SET trade_status = CASE WHEN NEW.status = 'rejected' THEN 'rejected' ELSE 'pending_review' END
     WHERE id = NEW.user_id;

    NEW.tax_exempt_status := FALSE;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_trade_application_to_admin_directory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_trade_application_to_admin_directory() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_profile RECORD;
  v_studio RECORD;
BEGIN
  IF NEW.status <> 'approved'::trade_application_status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved'::trade_application_status THEN RETURN NEW; END IF;

  SELECT first_name, last_name, email, phone INTO v_profile
  FROM public.profiles WHERE id = NEW.user_id;

  FOR v_studio IN
    SELECT s.id, s.created_by FROM public.studios s
    JOIN public.user_roles ur ON ur.user_id = s.created_by AND ur.role = 'admin'::app_role
  LOOP
    PERFORM public.upsert_admin_directory_client(
      v_studio.id,
      COALESCE(NEW.reviewed_by, v_studio.created_by),
      NEW.company_name,
      v_profile.first_name, v_profile.last_name, v_profile.email, v_profile.phone,
      NULLIF(NEW.job_title, ''),
      'Auto-added from approved trade application on ' || to_char(now(), 'YYYY-MM-DD')
    );
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: sync_trade_product_default_glb(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_trade_product_default_glb() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  target_product UUID;
  new_default TEXT;
BEGIN
  target_product := COALESCE(NEW.product_id, OLD.product_id);

  SELECT glb_url INTO new_default
  FROM public.trade_product_glb_variants
  WHERE product_id = target_product AND is_default = true
  LIMIT 1;

  IF new_default IS NULL THEN
    SELECT glb_url INTO new_default
    FROM public.trade_product_glb_variants
    WHERE product_id = target_product
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.trade_products
  SET glb_url = new_default
  WHERE id = target_product;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: tg_guard_axonometric_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_axonometric_request_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::axonometric_request_status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'pending'::axonometric_request_status;
    END IF;
    NEW.result_image_url := NULL;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.result_image_url IS DISTINCT FROM OLD.result_image_url THEN
      _changed := _changed || jsonb_build_object('column','result_image_url','attempted',NEW.result_image_url);
      NEW.result_image_url := OLD.result_image_url;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'axonometric_requests', _uid, NULL,
      jsonb_build_object('table_name','axonometric_requests','request_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_custom_request_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_custom_request_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text[] := ARRAY['new','cancelled'];
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'new') <> 'new' THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'new';
    END IF;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = ANY(_allowed)) THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_custom_requests', _uid, NULL,
      jsonb_build_object('table_name','trade_custom_requests','request_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_profile_tier_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_profile_tier_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR COALESCE(current_setting('app.bypass_profile_guard', true), '') = 'on'
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.trade_tier := 'standard'::trade_tier;
    NEW.trade_tier_suggested := NULL;
    NEW.trade_tier_locked_by_admin := FALSE;
    NEW.trade_tier_12mo_spend_cents := 0;
    NEW.trade_tier_computed_at := NULL;
    IF COALESCE(NEW.trade_status, 'pending_review') <> 'pending_review' THEN
      PERFORM public.record_security_event(
        'pricing_tamper_attempt', 'profiles', _uid, NULL,
        jsonb_build_object('table_name','profiles','columns',
          jsonb_build_array(jsonb_build_object('column','trade_status','attempted',NEW.trade_status)))
      );
      NEW.trade_status := 'pending_review';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier THEN
    _changed := _changed || jsonb_build_object('column','trade_tier','attempted',NEW.trade_tier,'previous',OLD.trade_tier);
  END IF;
  IF NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_suggested','attempted',NEW.trade_tier_suggested,'previous',OLD.trade_tier_suggested);
  END IF;
  IF NEW.trade_tier_locked_by_admin IS DISTINCT FROM OLD.trade_tier_locked_by_admin THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_locked_by_admin','attempted',NEW.trade_tier_locked_by_admin,'previous',OLD.trade_tier_locked_by_admin);
  END IF;
  IF NEW.trade_tier_12mo_spend_cents IS DISTINCT FROM OLD.trade_tier_12mo_spend_cents THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_12mo_spend_cents','attempted',NEW.trade_tier_12mo_spend_cents,'previous',OLD.trade_tier_12mo_spend_cents);
  END IF;
  IF NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    _changed := _changed || jsonb_build_object('column','trade_tier_computed_at','attempted',NEW.trade_tier_computed_at,'previous',OLD.trade_tier_computed_at);
  END IF;
  IF NEW.trade_status IS DISTINCT FROM OLD.trade_status THEN
    _changed := _changed || jsonb_build_object('column','trade_status','attempted',NEW.trade_status,'previous',OLD.trade_status);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'profiles', _uid, NULL,
      jsonb_build_object('table_name','profiles','columns',_changed)
    );
    RAISE EXCEPTION 'Trade tier and trade approval fields can only be modified by an administrator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_quote_item_pricing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_quote_item_pricing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _catalog bigint;
  _catalog_ccy text;
  _fabric_price bigint;
  _expected_upcharge bigint;
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Manual unit price may be raised but never dropped below the catalogue price
  -- (comparison only when the line currency matches the catalogue currency).
  IF NEW.unit_price_cents IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(tp.trade_price_cents, tp.rrp_price_cents), tp.currency
      INTO _catalog, _catalog_ccy
    FROM public.trade_products tp WHERE tp.id = NEW.product_id;

    IF _catalog IS NOT NULL
       AND COALESCE(NEW.unit_price_currency, _catalog_ccy) = COALESCE(_catalog_ccy, NEW.unit_price_currency)
       AND NEW.unit_price_cents < _catalog THEN
      _changed := _changed || jsonb_build_object('column','unit_price_cents','attempted',NEW.unit_price_cents,'reverted_to',_catalog);
      NEW.unit_price_cents := _catalog;
    END IF;
  END IF;

  -- Fabric upcharge must equal fabric price/lm x metres.
  IF NEW.fabric_id IS NULL OR NEW.fabric_meters IS NULL OR NEW.fabric_meters <= 0 THEN
    _expected_upcharge := NULL;
  ELSE
    SELECT f.price_per_lm_cents INTO _fabric_price FROM public.fabrics f WHERE f.id = NEW.fabric_id;
    _expected_upcharge := NULLIF(ROUND(COALESCE(_fabric_price, 0) * NEW.fabric_meters), 0);
  END IF;

  IF COALESCE(NEW.fabric_upcharge_cents, -1) IS DISTINCT FROM COALESCE(_expected_upcharge, -1) THEN
    _changed := _changed || jsonb_build_object('column','fabric_upcharge_cents','attempted',NEW.fabric_upcharge_cents,'reverted_to',_expected_upcharge);
    NEW.fabric_upcharge_cents := _expected_upcharge;
  END IF;

  -- Deposit percentage cannot be pushed below the standard 60%.
  IF NEW.deposit_pct_override IS NOT NULL
     AND (NEW.deposit_pct_override < 0.6 OR NEW.deposit_pct_override > 1) THEN
    _changed := _changed || jsonb_build_object('column','deposit_pct_override','attempted',NEW.deposit_pct_override,'reverted_to',LEAST(GREATEST(NEW.deposit_pct_override, 0.6), 1));
    NEW.deposit_pct_override := LEAST(GREATEST(NEW.deposit_pct_override, 0.6), 1);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'trade_quote_items', _uid, NULL,
      jsonb_build_object('table_name','trade_quote_items','item_id',NEW.id,'columns',_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_quote_pricing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_quote_pricing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _tier text;
  _tier_pct numeric;
  _credits bigint;
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL
     OR public.has_role(_uid, 'admin'::app_role)
     OR public.has_role(_uid, 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.trade_tier, 'silver') INTO _tier
  FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT c.discount_pct INTO _tier_pct
  FROM public.trade_tier_config c WHERE c.tier = COALESCE(_tier, 'silver');
  _tier_pct := COALESCE(_tier_pct, 0.08);

  -- Commission / net discount may only ever equal the account's own tier rate.
  IF NEW.commission_pct IS NOT NULL AND NEW.commission_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','commission_pct','attempted',NEW.commission_pct,'reverted_to',_tier_pct);
    NEW.commission_pct := _tier_pct;
  END IF;
  IF NEW.net_discount_pct IS NOT NULL AND NEW.net_discount_pct::numeric <> _tier_pct THEN
    _changed := _changed || jsonb_build_object('column','net_discount_pct','attempted',NEW.net_discount_pct,'reverted_to',_tier_pct);
    NEW.net_discount_pct := _tier_pct;
  END IF;

  -- Applied credit must match credits actually issued & applied to this quote.
  SELECT COALESCE(SUM(tc.amount_cents), 0) INTO _credits
  FROM public.trade_credits tc
  WHERE tc.applied_to_quote_id = NEW.id AND tc.status = 'applied';

  IF COALESCE(NEW.credit_applied_cents, 0) <> _credits THEN
    _changed := _changed || jsonb_build_object('column','credit_applied_cents','attempted',NEW.credit_applied_cents,'reverted_to',_credits);
    NEW.credit_applied_cents := NULLIF(_credits, 0);
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'pricing_tamper_attempt', 'trade_quotes', _uid, NULL,
      jsonb_build_object('table_name','trade_quotes','quote_id',NEW.id,'columns',_changed)
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_quote_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_quote_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text[] := ARRAY['draft','submitted','cancelled'];
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status,'draft') <> 'draft' THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'draft';
    END IF;
    NEW.confirmed_at := NULL;
    NEW.responded_at := NULL;
    NEW.admin_notes := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = ANY(_allowed)) THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
      _changed := _changed || jsonb_build_object('column','confirmed_at','attempted',NEW.confirmed_at);
      NEW.confirmed_at := OLD.confirmed_at;
    END IF;
    IF NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
      NEW.responded_at := OLD.responded_at;
    END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      _changed := _changed || jsonb_build_object('column','admin_notes','attempted',NEW.admin_notes);
      NEW.admin_notes := OLD.admin_notes;
    END IF;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_quotes', _uid, NULL,
      jsonb_build_object('table_name','trade_quotes','quote_id',NEW.id,'columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_guard_trade_application_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_trade_application_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _changed jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL OR public.has_role(_uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::trade_application_status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := 'pending'::trade_application_status;
    END IF;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _changed := _changed || jsonb_build_object('column','status','attempted',NEW.status);
      NEW.status := OLD.status;
    END IF;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
  END IF;

  IF jsonb_array_length(_changed) > 0 THEN
    PERFORM public.record_security_event(
      'privilege_escalation_attempt', 'trade_applications', _uid, NULL,
      jsonb_build_object('table_name','trade_applications','columns',_changed)
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_mirror_pricing_to_pick(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_mirror_pricing_to_pick() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.designer_curator_picks
     SET trade_price_cents   = NEW.trade_price_cents,
         price_per_sqm_cents = NEW.price_per_sqm_cents
   WHERE id = NEW.pick_id;
  RETURN NEW;
END;
$$;


--
-- Name: tg_order_timeline_guard_ship_to_pii(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_order_timeline_guard_ship_to_pii() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Owner of the timeline and platform admins may freely modify PII.
  IF NEW.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- For all other writers (studio editors), reject any change to ship-to PII columns.
  IF NEW.ship_to_name        IS DISTINCT FROM OLD.ship_to_name
  OR NEW.ship_to_attention   IS DISTINCT FROM OLD.ship_to_attention
  OR NEW.ship_to_email       IS DISTINCT FROM OLD.ship_to_email
  OR NEW.ship_to_phone       IS DISTINCT FROM OLD.ship_to_phone
  OR NEW.ship_to_address1    IS DISTINCT FROM OLD.ship_to_address1
  OR NEW.ship_to_address2    IS DISTINCT FROM OLD.ship_to_address2
  OR NEW.ship_to_city        IS DISTINCT FROM OLD.ship_to_city
  OR NEW.ship_to_state       IS DISTINCT FROM OLD.ship_to_state
  OR NEW.ship_to_postal_code IS DISTINCT FROM OLD.ship_to_postal_code
  OR NEW.ship_to_country     IS DISTINCT FROM OLD.ship_to_country
  OR NEW.ship_to_notes       IS DISTINCT FROM OLD.ship_to_notes
  THEN
    RAISE EXCEPTION 'Only the timeline owner or a platform admin may modify ship-to PII';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: tg_studio_submissions_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_studio_submissions_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _recent int;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO _recent
  FROM public.studio_submissions
  WHERE lower(email) = lower(NEW.email)
    AND created_at > now() - interval '24 hours';
  IF _recent >= 3 THEN
    RAISE EXCEPTION 'Rate limit: too many submissions for this email in the last 24 hours';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: tg_validate_trade_quote_billing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_trade_quote_billing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _state text;
BEGIN
  -- In agent_commission mode: payer must be end_client AND end_client_billing must be present at submit time.
  IF NEW.billing_mode = 'agent_commission' THEN
    IF NEW.payer_type <> 'end_client' THEN
      RAISE EXCEPTION 'agent_commission billing_mode requires payer_type=end_client';
    END IF;
    IF NEW.status NOT IN ('draft') AND (NEW.end_client_billing IS NULL
        OR NULLIF(NEW.end_client_billing->>'email', '') IS NULL) THEN
      RAISE EXCEPTION 'agent_commission quotes must capture end-client billing (name + email) before submission';
    END IF;
  END IF;

  -- In net_buy mode: payer must be designer_firm, and US ship-to requires a verified resale cert for that state.
  IF NEW.billing_mode = 'net_buy' THEN
    IF NEW.payer_type <> 'designer_firm' THEN
      RAISE EXCEPTION 'net_buy billing_mode requires payer_type=designer_firm';
    END IF;
    IF NEW.status NOT IN ('draft') AND upper(COALESCE(NEW.ship_to_country, '')) = 'US' THEN
      _state := NULLIF(upper(NEW.ship_to_state), '');
      IF _state IS NULL THEN
        RAISE EXCEPTION 'net_buy US quotes require ship_to_state';
      END IF;
      IF NEW.studio_id IS NULL THEN
        RAISE EXCEPTION 'net_buy quotes must be attached to a studio so we can verify resale certificate';
      END IF;
      IF NOT public.studio_has_resale_cert_for_state(NEW.studio_id, _state) THEN
        RAISE EXCEPTION 'net_buy to % requires a verified resale certificate for that state', _state;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tier_discount_pct(public.trade_tier); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tier_discount_pct(_tier public.trade_tier) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT discount_pct FROM public.trade_tier_config WHERE tier = _tier),
    0.08
  );
$$;


--
-- Name: tier_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tier_rank(_tier text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE lower(coalesce(_tier, 'standard'))
    WHEN 'platinum' THEN 3
    WHEN 'gold' THEN 2
    WHEN 'silver' THEN 1
    ELSE 0
  END
$$;


--
-- Name: tms_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tms_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: trade_emit_delivery_escalation(uuid, integer, integer, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trade_emit_delivery_escalation(p_item_id uuid, p_old_slack integer, p_new_slack integer, p_old_expected timestamp with time zone, p_new_expected timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: trade_expected_ready(timestamp with time zone, timestamp with time zone, timestamp with time zone, integer, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trade_expected_ready(p_actual timestamp with time zone, p_estimated timestamp with time zone, p_deposit timestamp with time zone, p_shipping_weeks integer, p_quote_created timestamp with time zone, p_lead_weeks integer) RETURNS timestamp with time zone
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
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


--
-- Name: trade_item_delivery_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trade_item_delivery_status(p_item_id uuid) RETURNS TABLE(expected timestamp with time zone, slack integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: trade_product_is_publicly_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trade_product_is_publicly_visible(_product_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_products t
    WHERE t.id = _product_id
      AND COALESCE(t.is_hidden, false) = false
      AND COALESCE(t.is_active, true) = true
  )
$$;


--
-- Name: trade_slack_days(date, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trade_slack_days(p_required_by date, p_expected timestamp with time zone) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN p_required_by IS NULL OR p_expected IS NULL THEN NULL
    ELSE ROUND(EXTRACT(EPOCH FROM (p_required_by::timestamptz - p_expected)) / 86400.0)::int
  END
$$;


--
-- Name: trg_order_timeline_delivery_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_order_timeline_delivery_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: trg_quote_item_delivery_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_quote_item_delivery_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: trg_recompute_client_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recompute_client_tier() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM public.recompute_client_tier_eligibility(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.recompute_client_tier_eligibility(NEW.client_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.client_id IS NOT NULL AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.recompute_client_tier_eligibility(OLD.client_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: trg_recompute_client_tier_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recompute_client_tier_items() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT client_id INTO cid FROM public.trade_quotes WHERE id = coalesce(NEW.quote_id, OLD.quote_id);
  IF cid IS NOT NULL THEN
    PERFORM public.recompute_client_tier_eligibility(cid);
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;


--
-- Name: trim_meta_description(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trim_meta_description() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  clean text;
  windowed text;
  sent_end int;
  word_end int;
BEGIN
  IF NEW.meta_description IS NULL THEN
    RETURN NEW;
  END IF;
  clean := btrim(regexp_replace(NEW.meta_description, '\s+', ' ', 'g'));
  IF length(clean) <= 160 THEN
    NEW.meta_description := clean;
    RETURN NEW;
  END IF;
  windowed := left(clean, 160);
  -- Last sentence-ending punctuation followed by a space inside the window
  sent_end := greatest(
    length(windowed) - length(regexp_replace(windowed, '^.*\.\s', '')) ,
    length(windowed) - length(regexp_replace(windowed, '^.*!\s', '')),
    length(windowed) - length(regexp_replace(windowed, '^.*\?\s', ''))
  );
  -- positions computed above are 0 when no match; only accept a clean cut >= 40
  IF sent_end >= 40 THEN
    NEW.meta_description := btrim(left(windowed, sent_end));
    RETURN NEW;
  END IF;
  IF right(windowed, 1) = '.' THEN
    NEW.meta_description := windowed;
    RETURN NEW;
  END IF;
  word_end := length(windowed) - length(regexp_replace(windowed, '^.*\s', ''));
  IF word_end >= 40 THEN
    NEW.meta_description := rtrim(left(windowed, word_end), '.,;:!?—–-') || '…';
  ELSE
    NEW.meta_description := rtrim(windowed, '.,;:!?—–-') || '…';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_item_approval_by_token(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_item_approval_by_token(_token text, _item_id uuid, _approval_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM client_board_items bi
    INNER JOIN client_boards b ON b.id = bi.board_id
    WHERE bi.id = _item_id AND b.share_token = _token AND b.status = 'shared'
      AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid or expired board token';
  END IF;

  UPDATE client_board_items SET approval_status = _approval_status
  WHERE id = _item_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: upsert_admin_directory_client(uuid, uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_admin_directory_client(p_studio_id uuid, p_created_by uuid, p_company text, p_first_name text, p_last_name text, p_email text, p_phone text, p_role_title text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_client_id uuid;
  v_name text;
  v_contact_id uuid;
BEGIN
  v_name := NULLIF(btrim(COALESCE(p_company, '')), '');
  IF v_name IS NULL THEN
    v_name := NULLIF(btrim(concat_ws(' ', p_first_name, p_last_name)), '');
  END IF;
  IF v_name IS NULL THEN
    v_name := COALESCE(p_email, 'Unknown');
  END IF;

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE studio_id = p_studio_id AND lower(name) = lower(v_name)
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (studio_id, created_by, name, type, notes)
    VALUES (p_studio_id, p_created_by, v_name, 'company'::client_type, p_notes)
    RETURNING id INTO v_client_id;
  END IF;

  IF NULLIF(btrim(COALESCE(p_email, '')), '') IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.client_contacts
    WHERE client_id = v_client_id AND lower(coalesce(email, '')) = lower(p_email)
    LIMIT 1;
  ELSE
    SELECT id INTO v_contact_id
    FROM public.client_contacts
    WHERE client_id = v_client_id
      AND lower(coalesce(first_name, '')) = lower(coalesce(p_first_name, ''))
      AND lower(coalesce(last_name, '')) = lower(coalesce(p_last_name, ''))
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.client_contacts (
      client_id, first_name, last_name, role_title, email, phone, is_primary
    ) VALUES (
      v_client_id,
      COALESCE(p_first_name, ''),
      COALESCE(p_last_name, ''),
      p_role_title,
      NULLIF(btrim(COALESCE(p_email, '')), ''),
      NULLIF(btrim(COALESCE(p_phone, '')), ''),
      NOT EXISTS (SELECT 1 FROM public.client_contacts WHERE client_id = v_client_id AND is_primary = true)
    );
  ELSE
    UPDATE public.client_contacts SET
      first_name = COALESCE(NULLIF(btrim(p_first_name), ''), first_name),
      last_name  = COALESCE(NULLIF(btrim(p_last_name), ''), last_name),
      role_title = COALESCE(p_role_title, role_title),
      email      = COALESCE(NULLIF(btrim(p_email), ''), email),
      phone      = COALESCE(NULLIF(btrim(p_phone), ''), phone)
    WHERE id = v_contact_id;
  END IF;

  RETURN v_client_id;
END;
$$;


--
-- Name: validate_portal_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_portal_session(_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.portal_sessions;
BEGIN
  IF _token IS NULL THEN RETURN jsonb_build_object('valid', false); END IF;

  SELECT * INTO v_row FROM public.portal_sessions WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false); END IF;
  IF v_row.revoked_at IS NOT NULL OR v_row.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  UPDATE public.portal_sessions SET last_seen_at = now() WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_row.expires_at,
    'corporate_id', v_row.corporate_id
  );
END;
$$;


--
-- Name: webhook_events_has_work(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.webhook_events_has_work() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.webhook_events
    WHERE status IN ('pending', 'processing')
      AND attempts < max_attempts
  );
$$;


--
-- Name: webhook_queue_dispatch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.webhook_queue_dispatch() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);

  IF NOT public.webhook_events_has_work() THEN
    BEGIN
      PERFORM cron.unschedule('process-webhook-events');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/process-webhook-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;


--
-- Name: webhook_queue_wake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.webhook_queue_wake() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000002);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-webhook-events') THEN
    BEGIN
      PERFORM cron.schedule('process-webhook-events', '15 seconds', $cron$ SELECT public.webhook_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'webhook_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/process-webhook-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'webhook_queue_wake failed (event preserved): %', SQLERRM;
  RETURN NULL;
END;
$_$;


--
-- Name: abandoned_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abandoned_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    user_id uuid,
    email text,
    name text,
    currency text,
    item_count integer DEFAULT 0 NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    reminder_count integer DEFAULT 0 NOT NULL,
    last_reminder_at timestamp with time zone,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    recovered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_alert_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_alert_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel text NOT NULL,
    event text NOT NULL,
    application_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    provider_message_id text
);


--
-- Name: ai_model_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_model_pricing (
    model text NOT NULL,
    input_usd_per_mtok numeric,
    output_usd_per_mtok numeric,
    flat_per_call_usd numeric,
    currency text DEFAULT 'USD'::text NOT NULL,
    source text DEFAULT 'Lovable AI Gateway pricing'::text NOT NULL,
    source_url text,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_response_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_response_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    prompt_hash text NOT NULL,
    response_json jsonb NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    hits integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_hit_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: ai_semantic_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_semantic_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    prompt text NOT NULL,
    prompt_hash text NOT NULL,
    embedding public.vector(1536),
    response_json jsonb NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    hits integer DEFAULT 0 NOT NULL,
    last_hit_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    estimated_cost_usd numeric(12,6) DEFAULT 0 NOT NULL,
    user_id uuid,
    status text DEFAULT 'ok'::text NOT NULL,
    error_code text,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cached boolean DEFAULT false NOT NULL,
    prompt_hash text,
    tier text
);


--
-- Name: analytics_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_rate_limits (
    bucket_key text NOT NULL,
    window_start timestamp with time zone DEFAULT date_trunc('minute'::text, now()) NOT NULL,
    hits integer DEFAULT 0 NOT NULL
);


--
-- Name: auction_benchmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_benchmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auction_house text NOT NULL,
    designer_name text NOT NULL,
    piece_title text NOT NULL,
    sale_date text,
    estimate_low_usd integer,
    estimate_high_usd integer,
    sold_price_usd integer,
    lot_url text,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: axonometric_cad_qa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.axonometric_cad_qa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    mode text NOT NULL,
    product_id text NOT NULL,
    product_name text,
    brand_name text,
    expected_bbox_mm jsonb,
    expected_dim_text text,
    applied_dim_text text,
    original_dim_text text,
    status text NOT NULL,
    delta_cm jsonb,
    tolerance_cm integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT axonometric_cad_qa_status_check CHECK ((status = ANY (ARRAY['match'::text, 'mismatch'::text, 'no_cad'::text, 'cad_unparsed'::text])))
);


--
-- Name: axonometric_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.axonometric_gallery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    description text,
    image_url text NOT NULL,
    style_preset text,
    project_name text,
    request_id uuid,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: axonometric_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.axonometric_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.axonometric_request_status DEFAULT 'pending'::public.axonometric_request_status NOT NULL,
    request_type text DEFAULT 'elevation'::text NOT NULL,
    image_url text NOT NULL,
    notes text,
    admin_notes text,
    result_image_url text,
    project_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_favorite_product_ids jsonb DEFAULT '[]'::jsonb,
    room_type text DEFAULT ''::text,
    style_direction text DEFAULT ''::text,
    lighting_mood text DEFAULT ''::text,
    render_engine text DEFAULT 'no_preference'::text,
    resolution text DEFAULT '4k'::text,
    camera_angles text DEFAULT ''::text,
    file_formats text DEFAULT ''::text
);


--
-- Name: board_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    product_id uuid NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brand_lead_times; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_lead_times (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    default_lead_weeks_min smallint,
    default_lead_weeks_max smallint,
    default_stock_status text DEFAULT 'made_to_order'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brand_thumbnails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_thumbnails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    thumbnail_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brief_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brief_drafts (
    user_id uuid NOT NULL,
    payload jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cad_asset_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cad_asset_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cad_asset_id uuid NOT NULL,
    product_id uuid NOT NULL,
    file_format text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cad_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cad_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid,
    uploaded_by uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    format text NOT NULL,
    file_size_bytes bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    parsed_geometry jsonb,
    error text,
    parsed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cad_documents_format_check CHECK ((format = ANY (ARRAY['dxf'::text, 'dwg'::text, 'obj'::text, 'fbx'::text, 'skp'::text, 'step'::text, 'iges'::text, '3ds'::text, 'rfa'::text]))),
    CONSTRAINT cad_documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'parsing'::text, 'ready'::text, 'failed'::text, 'unsupported'::text])))
);


--
-- Name: cad_fit_edit_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cad_fit_edit_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id text,
    field text NOT NULL,
    requested_value text,
    resolved_value text,
    outcome text NOT NULL,
    reason text,
    cad_document_id uuid,
    room_label text,
    product_id uuid,
    clearance_mm integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    failed_validation text,
    verdict text,
    turns_since_confirm integer,
    batch_id uuid,
    CONSTRAINT cad_fit_edit_audit_failed_validation_check CHECK (((failed_validation IS NULL) OR (failed_validation = ANY (ARRAY['plan_not_found'::text, 'plan_not_ready'::text, 'plan_ambiguous'::text, 'room_not_detected'::text, 'room_ambiguous'::text, 'piece_not_found'::text, 'piece_ambiguous'::text, 'missing_dimensions'::text, 'clearance_out_of_range'::text, 'clearance_unparseable'::text, 'missing_field'::text, 'service_unreachable'::text, 'no_verdict'::text, 'rate_limited'::text, 'other'::text])))),
    CONSTRAINT cad_fit_edit_audit_field_check CHECK ((field = ANY (ARRAY['cad_document_id'::text, 'room_label'::text, 'product_id'::text, 'clearance_mm'::text, 'initial'::text, 'confirm'::text, 'cancel'::text, 'result'::text]))),
    CONSTRAINT cad_fit_edit_audit_outcome_check CHECK ((outcome = ANY (ARRAY['accepted'::text, 'rejected'::text]))),
    CONSTRAINT cad_fit_edit_audit_rejected_requires_reason CHECK (((outcome <> 'rejected'::text) OR ((reason IS NOT NULL) AND (btrim(reason) <> ''::text) AND (failed_validation IS NOT NULL) AND (btrim(failed_validation) <> ''::text))))
);


--
-- Name: cad_fit_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cad_fit_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cad_document_id uuid NOT NULL,
    room_label text,
    product_id uuid NOT NULL,
    variant_label text,
    verdict text NOT NULL,
    reasons jsonb,
    product_bbox_mm jsonb,
    room_bbox_mm jsonb,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cad_fit_reports_verdict_check CHECK ((verdict = ANY (ARRAY['pass'::text, 'warn'::text, 'fail'::text, 'unknown'::text])))
);


--
-- Name: client_board_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_board_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    item_id uuid,
    author_name text DEFAULT 'Client'::text NOT NULL,
    content text NOT NULL,
    is_client boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE client_board_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_board_comments IS 'Comments on shared client boards. Only authenticated board owners can insert/select/update/delete. Anonymous/token-bearing clients cannot post comments by design — the is_client/author_name fields exist for owners to record comments attributed to a client during in-person review sessions.';


--
-- Name: client_board_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_board_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    product_id uuid NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    notes text,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subfolder text,
    variant_label text,
    fabric_label text,
    wood_label text,
    saved_via text DEFAULT 'desktop'::text NOT NULL,
    added_by uuid,
    seen_on_desktop_at timestamp with time zone,
    digest_sent_at timestamp with time zone
);

ALTER TABLE ONLY public.client_board_items REPLICA IDENTITY FULL;


--
-- Name: client_boards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Untitled Board'::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    client_email text,
    share_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    token_expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    token_rotated_at timestamp with time zone,
    project_id uuid,
    studio_logo_url text,
    studio_name text,
    hide_maison_branding boolean DEFAULT false NOT NULL,
    studio_id uuid,
    source text DEFAULT 'manual'::text NOT NULL,
    client_id uuid,
    CONSTRAINT client_boards_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'concierge'::text])))
);

ALTER TABLE ONLY public.client_boards REPLICA IDENTITY FULL;


--
-- Name: client_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    role_title text,
    email text,
    phone text,
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    studio_id uuid NOT NULL,
    created_by uuid,
    doc_type public.client_document_type DEFAULT 'other'::public.client_document_type NOT NULL,
    label text NOT NULL,
    storage_kind public.client_document_storage DEFAULT 'link'::public.client_document_storage NOT NULL,
    external_url text,
    storage_path text,
    file_name text,
    file_size_bytes bigint,
    mime_type text,
    signed_at date,
    expires_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_documents_payload_chk CHECK ((((storage_kind = 'link'::public.client_document_storage) AND (external_url IS NOT NULL) AND (length(external_url) > 0)) OR ((storage_kind = 'upload'::public.client_document_storage) AND (storage_path IS NOT NULL) AND (length(storage_path) > 0))))
);


--
-- Name: client_taste_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_taste_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cluster_label text DEFAULT ''::text NOT NULL,
    cluster_description text DEFAULT ''::text,
    top_designers text[] DEFAULT '{}'::text[],
    top_brands text[] DEFAULT '{}'::text[],
    top_categories text[] DEFAULT '{}'::text[],
    top_materials text[] DEFAULT '{}'::text[],
    style_keywords text[] DEFAULT '{}'::text[],
    engagement_score numeric DEFAULT 0,
    total_favorites integer DEFAULT 0,
    total_quotes integer DEFAULT 0,
    total_samples integer DEFAULT 0,
    raw_signals jsonb DEFAULT '{}'::jsonb,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name text NOT NULL,
    type public.client_type DEFAULT 'company'::public.client_type NOT NULL,
    website text,
    tax_id text,
    default_currency text,
    billing_address_line1 text,
    billing_address_line2 text,
    billing_city text,
    billing_region text,
    billing_postal_code text,
    billing_country text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_tier text DEFAULT 'standard'::text NOT NULL,
    rolling_12m_spend_cents bigint DEFAULT 0 NOT NULL,
    eligible_tier text,
    eligible_for_upgrade boolean DEFAULT false NOT NULL,
    tier_computed_at timestamp with time zone
);

ALTER TABLE ONLY public.clients REPLICA IDENTITY FULL;


--
-- Name: cn_director_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cn_director_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    user_id uuid,
    invited_name text,
    contact_email text,
    contact_phone text,
    project_summary text,
    aesthetic text,
    budget_band text,
    sentiment text,
    pieces_of_interest jsonb DEFAULT '[]'::jsonb NOT NULL,
    viewing_requested_at timestamp with time zone,
    status text DEFAULT 'new'::text NOT NULL,
    admin_notes text,
    last_email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collectible_atelier_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collectible_atelier_gallery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    image_url text NOT NULL,
    caption text,
    "position" integer DEFAULT 0 NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collectible_atelier_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collectible_atelier_overrides (
    slug text NOT NULL,
    name text,
    founder text,
    specialty text,
    hero_image_url text,
    website_url text,
    instagram_url text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collectible_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collectible_overrides (
    slug text NOT NULL,
    trade_only boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: collector_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collector_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    occupation text,
    collecting_interests text,
    reference_notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collector_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

ALTER TABLE ONLY public.collector_applications FORCE ROW LEVEL SECURITY;


--
-- Name: competitor_designers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_designers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gallery_id uuid NOT NULL,
    designer_name text NOT NULL,
    is_overlap boolean DEFAULT false NOT NULL,
    profile_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_galleries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_galleries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    website_url text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    region text DEFAULT 'asia'::text NOT NULL,
    logo_url text,
    description text,
    last_scraped_at timestamp with time zone,
    scrape_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_traffic; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_traffic (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gallery_id uuid NOT NULL,
    month date NOT NULL,
    monthly_visits integer,
    bounce_rate numeric(5,2),
    avg_duration_seconds integer,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    surface text NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    name text,
    city text,
    country text,
    first_message text,
    intent text,
    signals jsonb DEFAULT '[]'::jsonb NOT NULL,
    qualified_score integer DEFAULT 0 NOT NULL,
    path text,
    user_agent text,
    referrer text,
    notified_at timestamp with time zone,
    CONSTRAINT concierge_leads_surface_check CHECK ((surface = ANY (ARRAY['public'::text, 'trade'::text])))
);


--
-- Name: concierge_rag_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_rag_traces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    query text NOT NULL,
    matches jsonb DEFAULT '[]'::jsonb NOT NULL,
    context_text text,
    match_count integer DEFAULT 0 NOT NULL,
    top_similarity double precision,
    used_in_answer boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_roster_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_roster_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    specialty text,
    embedding public.vector(1536) NOT NULL,
    model_version text DEFAULT 'openai/text-embedding-3-small'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_sessions (
    user_id uuid NOT NULL,
    timeline jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_stream_frames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_stream_frames (
    stream_id uuid NOT NULL,
    seq integer NOT NULL,
    chunk text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: concierge_stream_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_stream_sessions (
    stream_id uuid NOT NULL,
    user_id uuid NOT NULL,
    request_id text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    surface text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT concierge_stream_sessions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'complete'::text, 'error'::text])))
);


--
-- Name: concierge_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concierge_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'New conversation'::text NOT NULL,
    timeline jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    operation text NOT NULL,
    record_id uuid NOT NULL,
    changed_by uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cpd_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cpd_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    attended boolean DEFAULT false NOT NULL,
    attended_at timestamp with time zone
);


--
-- Name: cpd_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cpd_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    event_type text DEFAULT 'webinar'::text NOT NULL,
    presenter text DEFAULT ''::text,
    brand_name text DEFAULT ''::text,
    date timestamp with time zone,
    duration_minutes integer DEFAULT 60,
    location text DEFAULT ''::text,
    video_url text DEFAULT ''::text,
    thumbnail_url text DEFAULT ''::text,
    is_published boolean DEFAULT false NOT NULL,
    max_attendees integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cron_http_call_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_http_call_log (
    request_id bigint NOT NULL,
    jobname text NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: curated_drops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curated_drops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    featured_products uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    target_region text DEFAULT 'GLOBAL'::text NOT NULL,
    hero_image_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT curated_drops_target_region_check CHECK ((target_region = ANY (ARRAY['ASEAN'::text, 'GCC'::text, 'ROW'::text, 'GLOBAL'::text])))
);


--
-- Name: currency_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currency_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_currency text NOT NULL,
    target_currency text NOT NULL,
    rate numeric(20,10) NOT NULL,
    source text DEFAULT 'unknown'::text NOT NULL,
    rate_date date,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT currency_rates_rate_check CHECK ((rate > (0)::numeric))
);


--
-- Name: custom_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    company text,
    requirements text NOT NULL,
    product_id text,
    product_title text,
    designer_name text,
    page_url text,
    status text DEFAULT 'new'::text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: descriptor_taxonomy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descriptor_taxonomy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    synonyms text[] DEFAULT '{}'::text[] NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT descriptor_taxonomy_category_check CHECK ((category = ANY (ARRAY['construction'::text, 'treatment'::text, 'finish'::text, 'feature'::text, 'attribute'::text, 'hardware'::text])))
);


--
-- Name: designer_curator_picks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_curator_picks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designer_id uuid NOT NULL,
    image_url text DEFAULT ''::text NOT NULL,
    hover_image_url text,
    title text DEFAULT ''::text NOT NULL,
    subtitle text,
    category text,
    subcategory text,
    tags text[],
    materials text,
    dimensions text,
    description text,
    edition text,
    photo_credit text,
    pdf_url text,
    pdf_filename text,
    pdf_urls jsonb,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trade_price_cents integer,
    currency text DEFAULT 'EUR'::text NOT NULL,
    lead_time text,
    price_prefix text,
    gallery_images text[] DEFAULT '{}'::text[],
    origin text,
    size_variants jsonb DEFAULT '[]'::jsonb,
    variant_placeholder text,
    base_axis_label text,
    top_axis_label text,
    variant_image_map jsonb DEFAULT '{}'::jsonb,
    is_hidden boolean DEFAULT false NOT NULL,
    edition_number text,
    edition_signing text,
    price_per_sqm_cents integer,
    pack_cbm numeric(8,3),
    pack_weight_kg numeric(10,2),
    pack_carton_count integer,
    default_ship_mode text,
    pickup_country text,
    pickup_postcode text,
    pickup_address text,
    embedding public.vector(1536),
    embedding_source_hash text,
    embedded_at timestamp with time zone,
    materials_description text,
    hs_code text,
    gallery_captions jsonb,
    is_upholstered boolean,
    com_meters numeric(6,2),
    fabric_size_label_a text,
    fabric_size_label_b text,
    wood_label_override text,
    allow_com_col boolean DEFAULT true NOT NULL,
    width_mm integer,
    depth_mm integer,
    height_mm integer,
    seat_height_mm integer,
    is_contract_grade boolean DEFAULT false NOT NULL,
    meta_description text,
    slug text,
    style_tags text[] DEFAULT '{}'::text[] NOT NULL,
    crate_specs jsonb DEFAULT '[]'::jsonb NOT NULL,
    hs_code_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT designer_curator_picks_default_ship_mode_check CHECK (((default_ship_mode IS NULL) OR (default_ship_mode = ANY (ARRAY['sea_lcl'::text, 'sea_fcl'::text, 'air'::text, 'road'::text, 'courier'::text])))),
    CONSTRAINT designer_curator_picks_depth_mm_check CHECK (((depth_mm IS NULL) OR ((depth_mm >= 1) AND (depth_mm <= 20000)))),
    CONSTRAINT designer_curator_picks_height_mm_check CHECK (((height_mm IS NULL) OR ((height_mm >= 1) AND (height_mm <= 20000)))),
    CONSTRAINT designer_curator_picks_pickup_country_iso2_check CHECK (((pickup_country IS NULL) OR (pickup_country ~ '^[A-Z]{2}$'::text))),
    CONSTRAINT designer_curator_picks_seat_height_mm_check CHECK (((seat_height_mm IS NULL) OR ((seat_height_mm >= 1) AND (seat_height_mm <= 5000)))),
    CONSTRAINT designer_curator_picks_width_mm_check CHECK (((width_mm IS NULL) OR ((width_mm >= 1) AND (width_mm <= 20000))))
);


--
-- Name: COLUMN designer_curator_picks.size_variants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designer_curator_picks.size_variants IS 'Array of {label: string, price_cents: number} entries. When non-empty, takes precedence over trade_price_cents for display.';


--
-- Name: COLUMN designer_curator_picks.variant_placeholder; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designer_curator_picks.variant_placeholder IS 'Custom placeholder text for the variant/material dropdown on this product (e.g. "Select your fabric choice"). When null, falls back to the default UI label.';


--
-- Name: COLUMN designer_curator_picks.price_per_sqm_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designer_curator_picks.price_per_sqm_cents IS 'Per-square-metre price in minor units (e.g. EUR cents). When set, rug variant prices and custom-size quotes are calculated from W × L parsed from the variant label.';


--
-- Name: designer_curator_picks_public; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_curator_picks_public (
    id uuid NOT NULL,
    designer_id uuid,
    image_url text,
    hover_image_url text,
    title text,
    subtitle text,
    category text,
    subcategory text,
    tags text[],
    materials text,
    dimensions text,
    description text,
    edition text,
    photo_credit text,
    pdf_url text,
    pdf_filename text,
    pdf_urls jsonb,
    sort_order smallint,
    created_at timestamp with time zone,
    currency text,
    lead_time text,
    price_prefix text,
    gallery_images text[],
    origin text,
    size_variants jsonb,
    variant_placeholder text,
    base_axis_label text,
    top_axis_label text,
    variant_image_map jsonb,
    is_hidden boolean,
    edition_number text,
    edition_signing text,
    default_ship_mode text,
    materials_description text,
    gallery_captions jsonb,
    is_upholstered boolean,
    wood_label_override text,
    allow_com_col boolean DEFAULT true NOT NULL,
    slug text
);


--
-- Name: designer_heritage_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_heritage_slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designer_id uuid NOT NULL,
    image_url text NOT NULL,
    caption text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: designer_instagram_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_instagram_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designer_id uuid NOT NULL,
    post_url text NOT NULL,
    caption text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    hidden boolean DEFAULT false NOT NULL,
    posted_at timestamp with time zone
);


--
-- Name: designer_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    line_item_id uuid,
    designer_id uuid,
    designer_name text,
    currency text DEFAULT 'usd'::text NOT NULL,
    gross_amount integer DEFAULT 0 NOT NULL,
    trade_discount_applied integer DEFAULT 0 NOT NULL,
    trade_program_id text,
    discount_absorbed_by text DEFAULT 'platform'::text NOT NULL,
    commission_rate_pct numeric(5,2) DEFAULT 70.00 NOT NULL,
    stripe_fee_cents integer DEFAULT 0 NOT NULL,
    platform_fee integer DEFAULT 0 NOT NULL,
    designer_net_payout integer DEFAULT 0 NOT NULL,
    payout_status text DEFAULT 'pending'::text NOT NULL,
    stripe_session_id text,
    stripe_payment_intent_id text,
    approved_at timestamp with time zone,
    approved_by uuid,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: designer_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designer_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text NOT NULL,
    order_id uuid,
    designer_id uuid,
    designer_name text,
    designer_email text,
    wholesale_contract_tier text,
    currency text DEFAULT 'usd'::text NOT NULL,
    line_count integer DEFAULT 0 NOT NULL,
    total_retail_rrp integer DEFAULT 0 NOT NULL,
    total_purchase_cost_cogs integer DEFAULT 0 NOT NULL,
    document_path text,
    email_status text DEFAULT 'pending'::text NOT NULL,
    email_error text,
    stripe_session_id text,
    dispatched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ack_token uuid DEFAULT gen_random_uuid() NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledgment_token uuid DEFAULT gen_random_uuid() NOT NULL,
    requires_manual_followup boolean DEFAULT false NOT NULL,
    escalation_count integer DEFAULT 0 NOT NULL,
    last_escalated_at timestamp with time zone
);


--
-- Name: designers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    founder text,
    display_name text,
    specialty text DEFAULT ''::text NOT NULL,
    biography text DEFAULT ''::text NOT NULL,
    notable_works text DEFAULT ''::text NOT NULL,
    philosophy text DEFAULT ''::text NOT NULL,
    image_url text DEFAULT ''::text NOT NULL,
    logo_url text,
    source text DEFAULT 'featured'::text NOT NULL,
    links jsonb DEFAULT '[]'::jsonb,
    is_published boolean DEFAULT false NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    biography_images text[] DEFAULT '{}'::text[],
    hero_image_url text,
    hero_photo_credit text,
    instagram_handle text,
    new_in_order smallint,
    instagram_handle_2 text,
    is_independent boolean DEFAULT false NOT NULL,
    trade_only boolean DEFAULT false NOT NULL,
    collab_brands text[] DEFAULT '{}'::text[] NOT NULL,
    parent_badge_label text,
    era text,
    country text,
    facets_updated_at timestamp with time zone,
    additional_founders text[] DEFAULT '{}'::text[] NOT NULL,
    subtitle_is_designer boolean DEFAULT false NOT NULL,
    wide_hero_image_url text,
    max_trade_discount numeric(5,2),
    commission_rate_pct numeric(5,2),
    trade_discount_absorption text DEFAULT 'platform'::text NOT NULL,
    wholesale_discount_pct numeric(5,2),
    fulfillment_email text,
    wholesale_contract_tier text,
    CONSTRAINT designers_era_check CHECK ((era = ANY (ARRAY['pre_1950'::text, 'mid_century'::text, 'contemporary'::text])))
);


--
-- Name: COLUMN designers.trade_only; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designers.trade_only IS 'When true, the designer card is shown only inside the Trade Program (Trade Designers directory) and is hidden from every public-facing surface.';


--
-- Name: COLUMN designers.max_trade_discount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designers.max_trade_discount IS 'Optional brand-level safety cap on trade discount, expressed in percent (e.g. 5.00 = 5%). NULL means no cap.';


--
-- Name: document_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    document_label text DEFAULT ''::text NOT NULL
);


--
-- Name: email_click_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_click_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text NOT NULL,
    link_id text NOT NULL,
    destination_url text NOT NULL,
    recipient_email text,
    user_agent text,
    referer text,
    ip_hash text,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    template_name text NOT NULL,
    recipient_email text NOT NULL,
    status text NOT NULL,
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'suppressed'::text, 'failed'::text, 'bounced'::text, 'complained'::text, 'dlq'::text])))
);


--
-- Name: email_send_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_state (
    id integer DEFAULT 1 NOT NULL,
    retry_after_until timestamp with time zone,
    batch_size integer DEFAULT 10 NOT NULL,
    send_delay_ms integer DEFAULT 200 NOT NULL,
    auth_email_ttl_minutes integer DEFAULT 15 NOT NULL,
    transactional_email_ttl_minutes integer DEFAULT 60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_send_state_id_check CHECK ((id = 1))
);


--
-- Name: email_unsubscribe_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_unsubscribe_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: TABLE email_unsubscribe_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_unsubscribe_tokens IS 'Tokens use 128-bit cryptographic randomness (gen_random_bytes(16)). Brute-force enumeration is computationally infeasible. Edge function handles rate limiting at the application layer.';


--
-- Name: fabrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fabrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    category text,
    supplier text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tier text,
    price_per_lm_cents integer,
    currency text DEFAULT 'EUR'::text NOT NULL,
    CONSTRAINT fabrics_tier_check CHECK (((tier IS NULL) OR (tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text]))))
);


--
-- Name: fabrics_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fabrics_public WITH (security_invoker='true') AS
 SELECT id,
    name,
    category,
    supplier,
    image_url,
    is_active,
    sort_order,
    created_at,
    updated_at
   FROM public.fabrics
  WHERE (is_active = true);


--
-- Name: favorite_folder_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_folder_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    folder_id uuid NOT NULL,
    favorite_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorite_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorite_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    cover_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: featured_studios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_studios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text DEFAULT ''::text,
    bio text DEFAULT ''::text,
    founded_year smallint,
    team_size text DEFAULT ''::text,
    location text DEFAULT ''::text,
    country text DEFAULT ''::text,
    website_url text DEFAULT ''::text,
    contact_email text DEFAULT ''::text,
    instagram_handle text DEFAULT ''::text,
    logo_url text DEFAULT ''::text,
    hero_image_url text DEFAULT ''::text,
    gallery_images text[] DEFAULT '{}'::text[],
    disciplines text[] DEFAULT '{}'::text[] NOT NULL,
    project_types text[] DEFAULT '{}'::text[] NOT NULL,
    notable_projects text DEFAULT ''::text,
    is_featured boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid
);


--
-- Name: COLUMN featured_studios.contact_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.featured_studios.contact_email IS 'PRIVATE. Readable only by service_role. Owners/admins read via server-side functions or trusted views.';


--
-- Name: featured_studios_public; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_studios_public (
    id uuid NOT NULL,
    slug text,
    name text,
    tagline text,
    bio text,
    founded_year smallint,
    team_size text,
    location text,
    country text,
    website_url text,
    instagram_handle text,
    logo_url text,
    hero_image_url text,
    gallery_images text[],
    disciplines text[],
    project_types text[],
    notable_projects text,
    is_featured boolean,
    is_published boolean,
    sort_order smallint,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: ffe_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ffe_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_session_id text,
    amount_cents integer DEFAULT 10000 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ffe_entitlements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'consumed'::text, 'refunded'::text])))
);


--
-- Name: funnel_card_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_card_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_id text NOT NULL,
    card_stage text,
    label text,
    amount_cents integer NOT NULL,
    expected_total_cents integer,
    currency text DEFAULT 'USD'::text NOT NULL,
    payment_kind text DEFAULT 'full'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    stripe_session_id text,
    stripe_payment_intent_id text,
    payer_email text,
    quote_id uuid,
    paid_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.funnel_card_payments REPLICA IDENTITY FULL;


--
-- Name: funnel_reminder_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_reminder_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    stage text NOT NULL,
    reminder_number integer DEFAULT 1 NOT NULL,
    recipient_email text,
    audience text DEFAULT 'client'::text NOT NULL,
    template_name text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_reason text
);


--
-- Name: funnel_reminder_pauses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_reminder_pauses (
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    paused boolean DEFAULT true NOT NULL,
    reason text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gallery_hotspots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_hotspots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_identifier text NOT NULL,
    x_percent numeric NOT NULL,
    y_percent numeric NOT NULL,
    product_name text NOT NULL,
    designer_name text,
    product_image_url text,
    link_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    materials text,
    dimensions text,
    mapped_pick_id uuid,
    designer_id uuid
);


--
-- Name: COLUMN gallery_hotspots.mapped_pick_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gallery_hotspots.mapped_pick_id IS 'Optional manual override: when set, View Product opens this curator pick directly instead of fuzzy-matching by product/designer name.';


--
-- Name: guardrail_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guardrail_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    feature text DEFAULT 'curatorial-query'::text NOT NULL,
    model text,
    tier text,
    query text,
    invalid_names text[] DEFAULT '{}'::text[] NOT NULL,
    valid_names text[] DEFAULT '{}'::text[] NOT NULL,
    action text DEFAULT 'stripped'::text NOT NULL,
    raw_answer text,
    final_answer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: guide_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ingestion_job_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingestion_job_state (
    id boolean DEFAULT true NOT NULL,
    lease_until timestamp with time zone,
    lease_owner text,
    is_paused boolean DEFAULT false NOT NULL,
    pause_reason text,
    last_run_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingestion_job_state_singleton CHECK (id)
);


--
-- Name: ingestion_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingestion_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_url text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    product_id uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingestion_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    company text,
    email text NOT NULL,
    phone text,
    subject text,
    message text NOT NULL,
    source text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_id uuid,
    product_slug text,
    product_name text,
    designer_name text,
    concierge_lead_id uuid,
    status text DEFAULT 'new'::text NOT NULL,
    linked_quote_id uuid,
    assigned_admin_id uuid,
    admin_notes text,
    selected_finish text,
    attachment_path text,
    assigned_at timestamp with time zone,
    status_changed_at timestamp with time zone
);

ALTER TABLE ONLY public.inquiries REPLICA IDENTITY FULL;


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    brand text,
    category text,
    quantity integer DEFAULT 1 NOT NULL,
    supplier_cost numeric(12,2) DEFAULT 0.00 NOT NULL,
    markup_tier text DEFAULT 'Custom'::text NOT NULL,
    markup_percentage numeric(5,2) DEFAULT 0.00 NOT NULL,
    client_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    thumbnail_url text,
    expected_ready_date date,
    required_by_date date,
    quote_id uuid,
    po_id uuid,
    deposit_required_percent numeric(5,2) DEFAULT 50.00 NOT NULL,
    deposit_paid boolean DEFAULT false NOT NULL,
    balance_due numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    cover_image_url text,
    category public.journal_category DEFAULT 'design_trend'::public.journal_category NOT NULL,
    author text DEFAULT 'Maison Affluency'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    read_time_minutes smallint DEFAULT 5,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gallery_images text[] DEFAULT '{}'::text[],
    pdf_url text,
    is_featured boolean DEFAULT false NOT NULL
);


--
-- Name: journal_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category public.journal_category DEFAULT 'design_trend'::public.journal_category NOT NULL,
    target_date date,
    status public.pipeline_status DEFAULT 'idea'::public.pipeline_status NOT NULL,
    designer_or_brand text DEFAULT ''::text,
    angle text DEFAULT ''::text,
    seo_keywords text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    author text DEFAULT 'Maison Affluency'::text NOT NULL,
    article_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: magazine_badge_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magazine_badge_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    document_label text DEFAULT ''::text,
    event_type text NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    country text DEFAULT ''::text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT magazine_badge_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'click'::text])))
);


--
-- Name: markup_annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.markup_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Untitled'::text NOT NULL,
    image_url text NOT NULL,
    pins jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_swatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_swatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    brand_name text DEFAULT ''::text NOT NULL,
    category text DEFAULT 'fabric'::text NOT NULL,
    color_family text DEFAULT ''::text,
    material_type text DEFAULT ''::text,
    finish text DEFAULT ''::text,
    image_url text DEFAULT ''::text,
    swatch_code text DEFAULT ''::text,
    application text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: material_taxonomy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_taxonomy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    family text NOT NULL,
    synonyms text[] DEFAULT '{}'::text[] NOT NULL,
    description text,
    is_contract_grade boolean DEFAULT false NOT NULL,
    durability_rating smallint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_taxonomy_durability_rating_check CHECK (((durability_rating IS NULL) OR ((durability_rating >= 1) AND (durability_rating <= 5)))),
    CONSTRAINT material_taxonomy_family_check CHECK ((family = ANY (ARRAY['wood'::text, 'metal'::text, 'stone'::text, 'fabric'::text, 'leather'::text, 'glass'::text, 'ceramic'::text, 'composite'::text, 'plastic'::text, 'paper'::text, 'other'::text])))
);


--
-- Name: mcp_click_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_click_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    click_type text NOT NULL,
    pick_id uuid,
    designer_slug text,
    ip_hash text,
    user_agent text,
    referer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mcp_click_log_click_type_check CHECK ((click_type = ANY (ARRAY['product'::text, 'signup'::text, 'designer'::text])))
);


--
-- Name: mcp_query_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_query_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tool_name text NOT NULL,
    args jsonb,
    result_count integer,
    is_error boolean DEFAULT false NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: og_rescrape_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.og_rescrape_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trigger_source text DEFAULT 'unknown'::text NOT NULL,
    build_id text,
    manifest_size integer,
    current_snapshot_size integer,
    previous_snapshot_size integer,
    rescraped_count integer DEFAULT 0 NOT NULL,
    forced boolean DEFAULT false NOT NULL,
    truncated boolean DEFAULT false NOT NULL,
    skipped boolean DEFAULT false NOT NULL,
    skipped_reason text,
    rescrape_result jsonb,
    error text
);


--
-- Name: onboarding_flow_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_flow_config (
    id text DEFAULT 'default'::text NOT NULL,
    greeting_template text DEFAULT 'Welcome to Maison Affluency Atelier{first_name_comma} - I''m {concierge_name}, a proprietary Gen-AI powered digital assistant built exclusively for members of the Maison Affluency Trade Program. I will act as your curatorial guide, instantly map matching design items and collectible pieces across our entire portfolio when you upload a project mood board or enter a specific prompt, generate one click client ready tear sheets, automate FF&E Schedules, calculate global white-glove shipping estimates, whilst applying your trade pricing in real-time. To tailor what I''m about to show you, may I know in what city your project is located?'::text NOT NULL,
    buttons jsonb DEFAULT '[{"label": "Start Quick Tour", "prompt": "__concierge:start_tour__", "primary": true}, {"label": "Start from a brief", "prompt": "__concierge:start_brief__"}, {"label": "Rename {concierge_name}", "prompt": "__concierge:rename__"}]'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: onboarding_tour_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tour_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_key text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    path text NOT NULL,
    icon text DEFAULT 'MapPin'::text NOT NULL,
    cta_label text DEFAULT 'Next'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_duration_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_duration_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    production_weeks smallint DEFAULT 12 NOT NULL,
    shipping_weeks smallint DEFAULT 3 NOT NULL,
    customs_days smallint DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kanban_status text DEFAULT 'deposit_paid'::text NOT NULL,
    deposit_paid_at timestamp with time zone,
    production_start_at timestamp with time zone,
    production_end_at timestamp with time zone,
    balance_due_at timestamp with time zone,
    balance_paid_at timestamp with time zone,
    shipping_start_at timestamp with time zone,
    shipping_end_at timestamp with time zone,
    customs_start_at timestamp with time zone,
    customs_cleared_at timestamp with time zone,
    estimated_delivery_at timestamp with time zone,
    actual_delivery_at timestamp with time zone,
    production_weeks smallint DEFAULT 12 NOT NULL,
    shipping_weeks smallint DEFAULT 3 NOT NULL,
    customs_days smallint DEFAULT 5 NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    studio_id uuid,
    ship_to_name text,
    ship_to_attention text,
    ship_to_address1 text,
    ship_to_address2 text,
    ship_to_city text,
    ship_to_state text,
    ship_to_postal_code text,
    ship_to_country text,
    ship_to_phone text,
    ship_to_email text,
    ship_to_notes text,
    incoterm text,
    CONSTRAINT order_timeline_incoterm_check CHECK (((incoterm IS NULL) OR (incoterm = ANY (ARRAY['EXW'::text, 'FCA'::text, 'FOB'::text, 'CIF'::text, 'CIP'::text, 'DAP'::text, 'DDP'::text, 'DPU'::text]))))
);


--
-- Name: order_timeline_commission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_timeline_commission (
    timeline_id uuid NOT NULL,
    commission_statement_sent_at timestamp with time zone,
    commission_payout_currency text,
    commission_payout_cents bigint,
    commission_fx_rate numeric,
    commission_fx_source text,
    commission_fx_locked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_name text NOT NULL,
    selected_finish text,
    customer_email text,
    transaction_id text NOT NULL,
    amount_total integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'paid'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    buyer_type text DEFAULT 'private'::text,
    buyer_gst_number text
);


--
-- Name: payment_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_credentials (
    id text DEFAULT 'live'::text NOT NULL,
    live_publishable_key text,
    live_secret_key text,
    live_webhook_secret text,
    live_mode boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    test_publishable_key text,
    test_secret_key text,
    test_webhook_secret text,
    whatsapp_recipients text
);


--
-- Name: personal_email_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_email_domains (
    domain text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    code_type text DEFAULT 'single_use'::text NOT NULL,
    max_uses integer DEFAULT 1 NOT NULL,
    uses_count integer DEFAULT 0 NOT NULL,
    campaign_name text,
    invited_name text,
    invited_company text,
    notes text,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portal_invites_code_type_check CHECK ((code_type = ANY (ARRAY['single_use'::text, 'campaign'::text]))),
    CONSTRAINT portal_invites_max_uses_check CHECK ((max_uses >= 1))
);

ALTER TABLE ONLY public.portal_invites FORCE ROW LEVEL SECURITY;


--
-- Name: portal_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_id uuid NOT NULL,
    session_id uuid,
    corporate_id text NOT NULL,
    ip_address inet,
    user_agent text,
    redeemed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.portal_redemptions FORCE ROW LEVEL SECURITY;


--
-- Name: portal_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    invite_id uuid NOT NULL,
    corporate_id text NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.portal_sessions FORCE ROW LEVEL SECURITY;


--
-- Name: presentation_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentation_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    presentation_id uuid NOT NULL,
    slide_id uuid,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.presentation_comments REPLICA IDENTITY FULL;


--
-- Name: presentation_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentation_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    presentation_id uuid NOT NULL,
    shared_with_email text NOT NULL,
    shared_with_user_id uuid,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: presentation_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentation_slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    presentation_id uuid NOT NULL,
    gallery_item_id uuid,
    image_url text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    description text,
    project_name text,
    style_preset text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slide_type text DEFAULT 'image'::text NOT NULL,
    room_section text,
    linked_product_ids jsonb DEFAULT '[]'::jsonb,
    linked_quote_id uuid
);


--
-- Name: presentations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presentations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT 'Untitled Presentation'::text NOT NULL,
    description text,
    created_by uuid NOT NULL,
    client_name text,
    project_name text,
    cover_style text DEFAULT 'default'::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_cad_asset_geometry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_cad_asset_geometry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cad_asset_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_label text,
    file_format text NOT NULL,
    bbox_mm jsonb,
    units text,
    metrics jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    parsed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_cad_asset_geometry_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'parsing'::text, 'ready'::text, 'failed'::text, 'unsupported'::text])))
);


--
-- Name: product_descriptor_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_descriptor_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    pick_id uuid,
    descriptor_id uuid NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_descriptor_links_check CHECK (((product_id IS NOT NULL) OR (pick_id IS NOT NULL)))
);


--
-- Name: product_fabric_swatches_public; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_fabric_swatches_public (
    pick_id uuid NOT NULL,
    fabric_id uuid NOT NULL,
    sort_order integer,
    price_tier_label text,
    name text NOT NULL,
    image_url text,
    category text,
    supplier text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_indices integer[]
);


--
-- Name: product_fabrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_fabrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pick_id uuid,
    fabric_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    price_tier_label text,
    image_indices integer[],
    price_cents_a integer,
    price_cents_b integer,
    product_label text,
    CONSTRAINT product_fabrics_target_chk CHECK (((pick_id IS NOT NULL) OR (product_label IS NOT NULL)))
);

ALTER TABLE ONLY public.product_fabrics REPLICA IDENTITY FULL;


--
-- Name: COLUMN product_fabrics.price_tier_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_fabrics.price_tier_label IS 'Optional label that matches a value of the Upholstery (top) axis in the linked pick''s size_variants. When set, selecting this swatch on the product page auto-selects that upholstery row in the variant price matrix.';


--
-- Name: COLUMN product_fabrics.image_indices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_fabrics.image_indices IS '1-based gallery image indices that depict this swatch on the linked product. Drives gallery auto-jump.';


--
-- Name: product_material_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_material_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    pick_id uuid,
    material_id uuid NOT NULL,
    role text DEFAULT 'primary'::text NOT NULL,
    position_note text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_material_links_role_check CHECK ((role = ANY (ARRAY['primary'::text, 'secondary'::text, 'finish'::text, 'upholstery'::text, 'structural'::text, 'hardware'::text, 'base'::text, 'trim'::text, 'inlay'::text]))),
    CONSTRAINT product_material_links_target_ck CHECK (((product_id IS NOT NULL) OR (pick_id IS NOT NULL)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    company text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    trade_tier public.trade_tier DEFAULT 'standard'::public.trade_tier NOT NULL,
    trade_tier_suggested public.trade_tier,
    trade_tier_locked_by_admin boolean DEFAULT false NOT NULL,
    trade_tier_12mo_spend_cents bigint DEFAULT 0 NOT NULL,
    trade_tier_computed_at timestamp with time zone,
    country text,
    concierge_name text,
    has_seen_trade_intro boolean DEFAULT false NOT NULL,
    trade_status text DEFAULT 'pending_review'::text,
    preferred_currency text,
    CONSTRAINT profiles_trade_status_check CHECK ((trade_status = ANY (ARRAY['approved'::text, 'pending_review'::text, 'rejected'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Untitled Project'::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    color text DEFAULT 'neutral'::text NOT NULL,
    cover_image_url text,
    notes text,
    target_completion_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    studio_id uuid,
    client_id uuid,
    location_neighborhood text,
    location_city text,
    trade_multiplier numeric DEFAULT 1.00 NOT NULL,
    style text,
    tags text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: provenance_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provenance_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    designer_id text NOT NULL,
    piece_title text NOT NULL,
    edition_number text,
    edition_total text,
    year_created smallint,
    certificate_number text,
    authenticity_statement text DEFAULT 'This certificate confirms the authenticity and provenance of this collectible design piece, verified by Maison Affluency.'::text,
    estimated_value_range text,
    appreciation_notes text,
    comparable_references text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: provenance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provenance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certificate_id uuid NOT NULL,
    event_date text NOT NULL,
    event_type text DEFAULT 'milestone'::text NOT NULL,
    title text NOT NULL,
    description text,
    location text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_download_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_download_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    document_label text DEFAULT ''::text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    source text DEFAULT 'public'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text,
    quote_id uuid,
    supplier_id uuid,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    invoice_status text DEFAULT 'missing'::text NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    approved_by_manager boolean DEFAULT false NOT NULL,
    approval_date timestamp with time zone,
    due_date date,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_invoice_status_check CHECK ((invoice_status = ANY (ARRAY['missing'::text, 'received'::text, 'under_review'::text]))),
    CONSTRAINT purchase_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'deposit_settled'::text, 'fully_paid'::text])))
);


--
-- Name: purchase_orders_payable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders_payable (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    line_item_id uuid,
    designer_id uuid,
    designer_name text,
    currency text DEFAULT 'usd'::text NOT NULL,
    retail_rrp integer DEFAULT 0 NOT NULL,
    wholesale_discount_pct numeric(5,2) DEFAULT 30.00 NOT NULL,
    purchase_cost_cogs integer DEFAULT 0 NOT NULL,
    sold_price_gross integer DEFAULT 0 NOT NULL,
    retail_discount_applied integer DEFAULT 0 NOT NULL,
    stripe_processing_fees integer DEFAULT 0 NOT NULL,
    net_maison_margin integer DEFAULT 0 NOT NULL,
    trade_program_id text,
    designer_invoice_status text DEFAULT 'pending'::text NOT NULL,
    designer_invoice_reference text,
    invoice_received_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid,
    paid_at timestamp with time zone,
    stripe_session_id text,
    stripe_payment_intent_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_order_id uuid,
    po_number text,
    requires_manual_followup boolean DEFAULT false NOT NULL,
    followup_flagged_at timestamp with time zone,
    last_escalated_at timestamp with time zone
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    last_success_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    sent_by uuid NOT NULL,
    sent_by_email text,
    recipient_email text NOT NULL,
    client_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_payment_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_payment_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text) NOT NULL,
    amount_cents integer NOT NULL,
    currency text NOT NULL,
    label text DEFAULT 'Full payment'::text NOT NULL,
    payer_email text,
    payer_name text,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_session_id text,
    paid_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quote_payment_links_amount_cents_check CHECK ((amount_cents > 0))
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_number text,
    supplier_id uuid,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    file_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: reference_styles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reference_styles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mode text NOT NULL,
    image_url text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: regional_logistics_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regional_logistics_rules (
    id integer NOT NULL,
    city text NOT NULL,
    neighborhood text,
    multiplier numeric NOT NULL,
    shipping_tier text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: regional_logistics_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regional_logistics_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regional_logistics_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regional_logistics_rules_id_seq OWNED BY public.regional_logistics_rules.id;


--
-- Name: regional_logistics_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regional_logistics_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_tier public.region_tier NOT NULL,
    base_shipping_markup numeric DEFAULT 0 NOT NULL,
    tax_handling_mode text DEFAULT 'standard'::text NOT NULL,
    estimated_lead_time text DEFAULT '12-16 weeks'::text NOT NULL,
    hub_city text,
    delivery_mode text DEFAULT 'sea_freight'::text NOT NULL,
    show_singapore_tax boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: room_planner_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_planner_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Untitled Project'::text NOT NULL,
    plan_image_url text,
    rooms jsonb DEFAULT '[]'::jsonb NOT NULL,
    placed_products jsonb DEFAULT '[]'::jsonb NOT NULL,
    pixels_per_meter integer DEFAULT 50 NOT NULL,
    wall_height numeric DEFAULT 2.8 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sample_request_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_request_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    changed_by uuid,
    old_status text,
    new_status text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scrape_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrape_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    category text DEFAULT 'Uncategorized'::text NOT NULL,
    urls text[] DEFAULT '{}'::text[] NOT NULL,
    extract_prompt text,
    is_active boolean DEFAULT true NOT NULL,
    schedule_cron text,
    last_run_at timestamp with time zone,
    last_run_result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    chunk_size integer DEFAULT 10 NOT NULL,
    chunk_delay integer DEFAULT 0 NOT NULL,
    location text DEFAULT ''::text NOT NULL
);


--
-- Name: scrape_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrape_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    total_urls integer DEFAULT 0 NOT NULL,
    total_scraped integer DEFAULT 0 NOT NULL,
    inserted integer DEFAULT 0 NOT NULL,
    updated integer DEFAULT 0 NOT NULL,
    errors integer DEFAULT 0 NOT NULL,
    duration_seconds numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: section_heroes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_heroes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    image_url text NOT NULL,
    gravity text DEFAULT 'auto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_alert_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_alert_state (
    id text NOT NULL,
    last_alerted_at timestamp with time zone,
    payload jsonb
);


--
-- Name: security_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    event_type text NOT NULL,
    source text NOT NULL,
    user_id uuid,
    ip text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: shipping_duty_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_duty_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dest_country text NOT NULL,
    hs_chapter text DEFAULT '94'::text NOT NULL,
    category text DEFAULT 'furniture'::text NOT NULL,
    duty_percent numeric(6,3) DEFAULT 0 NOT NULL,
    vat_percent numeric(6,3) DEFAULT 0 NOT NULL,
    notes text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_duty_rates_category_check CHECK ((category = ANY (ARRAY['furniture'::text, 'lighting'::text, 'art'::text, 'textile'::text, 'accessory'::text, 'other'::text])))
);


--
-- Name: shipping_lanes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_lanes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    origin_country text NOT NULL,
    origin_city text DEFAULT ''::text NOT NULL,
    dest_country text NOT NULL,
    dest_zone text DEFAULT ''::text NOT NULL,
    carrier_name text NOT NULL,
    mode text NOT NULL,
    transit_days_min smallint DEFAULT 0 NOT NULL,
    transit_days_max smallint DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_lanes_mode_check CHECK ((mode = ANY (ARRAY['sea_lcl'::text, 'sea_fcl'::text, 'air'::text, 'road'::text, 'courier'::text])))
);


--
-- Name: shipping_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quote_id uuid,
    order_timeline_id uuid,
    origin_country text DEFAULT ''::text NOT NULL,
    origin_city text DEFAULT ''::text NOT NULL,
    origin_address text,
    dest_country text DEFAULT ''::text NOT NULL,
    dest_city text DEFAULT ''::text NOT NULL,
    dest_address text,
    dest_zone text,
    total_volume_cbm numeric(10,3) DEFAULT 0 NOT NULL,
    total_weight_kg numeric(10,2) DEFAULT 0 NOT NULL,
    declared_value_cents integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    selected_lane_id uuid,
    selected_carrier text,
    selected_mode text,
    freight_cents integer DEFAULT 0 NOT NULL,
    fuel_cents integer DEFAULT 0 NOT NULL,
    insurance_cents integer DEFAULT 0 NOT NULL,
    duty_cents integer DEFAULT 0 NOT NULL,
    vat_cents integer DEFAULT 0 NOT NULL,
    customs_cents integer DEFAULT 0 NOT NULL,
    last_mile_cents integer DEFAULT 0 NOT NULL,
    handling_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'estimate'::text NOT NULL,
    valid_until date,
    computed_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    CONSTRAINT shipping_quotes_status_check CHECK ((status = ANY (ARRAY['estimate'::text, 'confirmed'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: shipping_rate_brackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_rate_brackets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lane_id uuid NOT NULL,
    min_volume_cbm numeric(10,3) DEFAULT 0 NOT NULL,
    max_volume_cbm numeric(10,3) DEFAULT 9999 NOT NULL,
    min_weight_kg numeric(10,2) DEFAULT 0 NOT NULL,
    max_weight_kg numeric(10,2) DEFAULT 999999 NOT NULL,
    base_rate_cents integer DEFAULT 0 NOT NULL,
    rate_per_cbm_cents integer DEFAULT 0 NOT NULL,
    rate_per_kg_cents integer DEFAULT 0 NOT NULL,
    min_charge_cents integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_to date,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_surcharges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_surcharges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    surcharge_type text NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    lane_id uuid,
    carrier_name text,
    dest_country text,
    dest_zone text,
    calc_method text NOT NULL,
    value_numeric numeric(12,4) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_surcharges_calc_method_check CHECK ((calc_method = ANY (ARRAY['percent'::text, 'flat'::text, 'per_cbm'::text, 'per_kg'::text]))),
    CONSTRAINT shipping_surcharges_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'lane'::text, 'carrier'::text, 'dest_zone'::text]))),
    CONSTRAINT shipping_surcharges_surcharge_type_check CHECK ((surcharge_type = ANY (ARRAY['fuel'::text, 'insurance'::text, 'customs'::text, 'handling'::text, 'last_mile'::text, 'security'::text, 'documentation'::text])))
);


--
-- Name: shop_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    pick_id uuid,
    product_slug text,
    designer_slug text,
    title text NOT NULL,
    designer_name text,
    finish_label text,
    image_url text,
    lead_time text,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_cents integer DEFAULT 0 NOT NULL,
    line_total_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shop_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_ref text NOT NULL,
    user_id uuid,
    email text,
    full_name text,
    payment_method text DEFAULT 'card'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    shipping_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    stripe_session_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    discount_pct numeric DEFAULT 0 NOT NULL,
    discount_label text,
    region_tier text,
    payment_channel text,
    tax_cents integer DEFAULT 0 NOT NULL,
    tax_label text,
    payment_receipt_path text,
    proforma_invoice_path text,
    shipping_address text,
    phone text,
    paid_at timestamp with time zone,
    marked_paid_by uuid,
    payment_confirmation_sent_at timestamp with time zone,
    buyer_type text,
    buyer_tax_id text,
    buyer_tax_country text,
    tax_treatment text,
    tax_rate numeric,
    tax_statement text,
    merchant_tax_registration text,
    shipping_country text,
    delivery_term text,
    import_duty_cents integer DEFAULT 0 NOT NULL,
    import_tax_cents integer DEFAULT 0 NOT NULL,
    import_clearance_cents integer DEFAULT 0 NOT NULL,
    ddp_handling_cents integer DEFAULT 0 NOT NULL,
    import_total_cents integer DEFAULT 0 NOT NULL,
    deferred_import_cents integer DEFAULT 0 NOT NULL,
    customs_statement text,
    customer_po_number text,
    company_name text,
    company_registration_number text,
    po_payment_terms text,
    budget_approved_at timestamp with time zone,
    po_review_status text
);


--
-- Name: sitemap_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sitemap_products (
    id uuid NOT NULL,
    updated_at timestamp with time zone
);


--
-- Name: studio_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text DEFAULT 'supply_update'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    product_id uuid,
    board_id uuid,
    project_name text,
    url text,
    read_at timestamp with time zone,
    pushed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.studio_alerts REPLICA IDENTITY FULL;


--
-- Name: studio_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid NOT NULL,
    email text NOT NULL,
    role public.studio_role DEFAULT 'editor'::public.studio_role NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    invited_by uuid NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.studio_invites REPLICA IDENTITY FULL;


--
-- Name: COLUMN studio_invites.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.studio_invites.token IS 'Secret invite token. SELECT restricted to service_role via column-level grants. Never expose to authenticated/anon.';


--
-- Name: studio_lead_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_lead_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid,
    event_type text NOT NULL,
    cta_kind text,
    filter_key text,
    filter_value text,
    user_id uuid,
    visitor_hash text,
    user_agent text,
    referrer text,
    country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_lead_events_cta_kind_check CHECK ((cta_kind = ANY (ARRAY['website'::text, 'email'::text, 'instagram'::text, 'contact_form'::text]))),
    CONSTRAINT studio_lead_events_event_type_check CHECK ((event_type = ANY (ARRAY['profile_view'::text, 'cta_click'::text, 'directory_card_click'::text, 'filter_applied'::text])))
);


--
-- Name: studio_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.studio_role DEFAULT 'editor'::public.studio_role NOT NULL,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.studio_members REPLICA IDENTITY FULL;


--
-- Name: studio_payout_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_payout_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid NOT NULL,
    label text NOT NULL,
    country_code text NOT NULL,
    currency text NOT NULL,
    account_holder_name text NOT NULL,
    iban text,
    swift_bic text,
    ach_routing_number text,
    ach_account_number text,
    bank_name text,
    bank_address text,
    tax_form_kind text,
    tax_form_reference text,
    tax_form_document_path text,
    stripe_connect_account_id text,
    stripe_connect_status text DEFAULT 'pending'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_payout_accounts_stripe_connect_status_check CHECK ((stripe_connect_status = ANY (ARRAY['pending'::text, 'onboarding'::text, 'verified'::text, 'restricted'::text, 'disabled'::text])))
);


--
-- Name: studio_project_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_project_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.studio_role,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: studio_resale_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_resale_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_id uuid NOT NULL,
    state_code text NOT NULL,
    certificate_number text,
    document_path text NOT NULL,
    issued_on date,
    expires_on date,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    rejected_reason text,
    verified_by uuid,
    verified_at timestamp with time zone,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_resale_certificates_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: studio_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    studio_name text NOT NULL,
    contact_name text NOT NULL,
    email text NOT NULL,
    phone text,
    website text,
    instagram text,
    location text,
    country text,
    disciplines text[] DEFAULT '{}'::text[] NOT NULL,
    project_types text[] DEFAULT '{}'::text[] NOT NULL,
    portfolio_url text,
    about text,
    notable_projects text,
    status text DEFAULT 'new'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    user_id uuid,
    user_agent text,
    referrer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_submissions_email_format_chk CHECK (((email IS NULL) OR ((char_length(email) <= 255) AND (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)))),
    CONSTRAINT studio_submissions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: studios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    logo_url text,
    billing_email text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_name text NOT NULL,
    contact_email text NOT NULL,
    cc_email text,
    brand_aliases text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppressed_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppressed_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    reason text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppressed_emails_reason_check CHECK ((reason = ANY (ARRAY['unsubscribe'::text, 'bounce'::text, 'complaint'::text])))
);


--
-- Name: tour_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tour_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    step_id text,
    step_index integer,
    total_steps integer,
    sub_step_id text,
    sub_step_label text,
    target_path text,
    device_type text,
    platform text,
    viewport text,
    pwa_standalone boolean,
    language text,
    page_path text,
    referrer_host text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tour_events_event_type_check CHECK ((event_type = ANY (ARRAY['tour_step_view'::text, 'tour_substep_click'::text, 'tour_complete'::text, 'tour_skip'::text])))
);


--
-- Name: trade_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    company_website text,
    job_title text DEFAULT ''::text NOT NULL,
    country text DEFAULT 'Singapore'::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    is_certified_professional boolean DEFAULT false NOT NULL,
    certification_details text,
    message text,
    status public.trade_application_status DEFAULT 'pending'::public.trade_application_status NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verification_checklist_sent_at timestamp with time zone,
    verification_checklist_sent_by uuid,
    verification_checklist_sent_by_name text,
    edit_token_expires_at timestamp with time zone,
    edit_token_hash text,
    edit_completed_at timestamp with time zone,
    edit_completed_by_name text,
    instagram_handle text,
    tax_vat_id text,
    credential_document_path text,
    tax_exempt_status boolean DEFAULT false NOT NULL,
    verification_notes text,
    ai_confidence numeric,
    ai_result jsonb,
    ai_verified_at timestamp with time zone,
    verification_attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    last_verification_error text,
    region_tier public.region_tier DEFAULT 'ROW'::public.region_tier NOT NULL,
    verification_fingerprint text,
    approval_email_sent_at timestamp with time zone,
    last_flag_alert_fingerprint text,
    corporate_reg_number text
);

ALTER TABLE ONLY public.trade_applications REPLICA IDENTITY FULL;


--
-- Name: trade_concierge_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_concierge_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    tool text NOT NULL,
    args jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    resulting_resource_id uuid,
    resulting_resource_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_concierge_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_concierge_escalations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trigger_sentiment text NOT NULL,
    trigger_intent text,
    conversation_excerpt jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notified_admins boolean DEFAULT false NOT NULL,
    notified_email boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_concierge_escalations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])))
);


--
-- Name: trade_concierge_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_concierge_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    project_id uuid,
    model text NOT NULL,
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    message_count integer,
    sentiment text,
    intent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source text NOT NULL,
    source_ref uuid,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    applied_to_quote_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    CONSTRAINT trade_credits_status_check CHECK ((status = ANY (ARRAY['available'::text, 'applied'::text, 'expired'::text])))
);


--
-- Name: trade_custom_request_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_custom_request_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    actor_id uuid,
    actor_role text DEFAULT 'system'::text NOT NULL,
    action text NOT NULL,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.trade_custom_request_activity FORCE ROW LEVEL SECURITY;


--
-- Name: trade_custom_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_custom_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    brand_name text,
    project_id uuid,
    request_type text DEFAULT 'customisation'::text NOT NULL,
    dimension_changes text,
    finish_notes text,
    com_col_fabric text,
    com_yardage_meters numeric,
    quantity integer DEFAULT 1 NOT NULL,
    target_lead_weeks integer,
    budget_notes text,
    notes text,
    status text DEFAULT 'new'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    studio_id uuid
);


--
-- Name: trade_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    brand_name text NOT NULL,
    document_type text DEFAULT 'tearsheet'::text NOT NULL,
    file_url text NOT NULL,
    file_size_bytes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_image_url text,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_featured_public boolean DEFAULT false NOT NULL
);


--
-- Name: trade_fair_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_fair_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category text DEFAULT 'fair'::text NOT NULL,
    city text,
    country text,
    venue text,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    website_url text,
    description text,
    brands_exhibiting text[],
    cover_image_url text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_floor_plan_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_floor_plan_layouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    name text DEFAULT 'Layout v1'::text NOT NULL,
    layout jsonb DEFAULT '{"placements": []}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_floor_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_floor_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text DEFAULT 'Untitled plan'::text NOT NULL,
    plan_image_url text NOT NULL,
    brief jsonb DEFAULT '{}'::jsonb NOT NULL,
    suggestions jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trade_product_cad_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_product_cad_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_label text,
    file_url text NOT NULL,
    file_format text NOT NULL,
    file_size_bytes bigint,
    version text,
    uploaded_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_product_cad_assets_format_chk CHECK ((file_format = ANY (ARRAY['dwg'::text, 'dxf'::text, '3ds'::text, 'skp'::text, 'rfa'::text, 'obj'::text, 'fbx'::text, 'step'::text, 'iges'::text])))
);


--
-- Name: trade_product_glb_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_product_glb_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_label text NOT NULL,
    glb_url text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    file_size_bytes bigint,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    material_roles jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN trade_product_glb_variants.material_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_product_glb_variants.material_roles IS 'Maps GLB material name -> role: "fabric" (upholstery, receives fabric swatch), "base" (frame/wood, receives base swatch), or "ignore" (keeps original texture).';


--
-- Name: trade_product_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_product_pricing (
    pick_id uuid NOT NULL,
    trade_price_cents integer,
    price_per_sqm_cents integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: trade_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_name text NOT NULL,
    product_name text NOT NULL,
    sku text,
    description text,
    category text DEFAULT ''::text NOT NULL,
    subcategory text DEFAULT ''::text,
    trade_price_cents integer,
    rrp_price_cents integer,
    currency text DEFAULT 'SGD'::text NOT NULL,
    dimensions text,
    materials text,
    lead_time text,
    image_url text,
    gallery_images text[] DEFAULT '{}'::text[],
    spec_sheet_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    price_unit text DEFAULT 'per_piece'::text NOT NULL,
    price_prefix text,
    origin text,
    lead_weeks_min_override smallint,
    lead_weeks_max_override smallint,
    stock_status_override text,
    is_hidden boolean DEFAULT false NOT NULL,
    price_per_sqm_cents integer,
    pack_cbm numeric(8,3),
    pack_weight_kg numeric(10,2),
    pack_carton_count integer,
    default_ship_mode text,
    pickup_country text,
    pickup_postcode text,
    pickup_address text,
    embedding public.vector(1536),
    embedding_source_hash text,
    embedded_at timestamp with time zone,
    materials_description text,
    glb_url text,
    hs_code text,
    is_upholstered boolean,
    source_pick_id uuid,
    size_variants jsonb DEFAULT '[]'::jsonb,
    variant_image_map jsonb DEFAULT '{}'::jsonb,
    base_axis_label text,
    top_axis_label text,
    variant_placeholder text,
    wood_label_override text,
    pdf_urls jsonb,
    width_mm integer,
    height_mm integer,
    depth_mm integer,
    seat_height_mm integer,
    is_contract_grade boolean DEFAULT false NOT NULL,
    available_finishes text[] DEFAULT '{}'::text[] NOT NULL,
    fabric_options text[] DEFAULT '{}'::text[] NOT NULL,
    lead_time_weeks_min smallint,
    lead_time_weeks_max smallint,
    meta_description text,
    in_situ_sg boolean DEFAULT false NOT NULL,
    available_from date,
    provenance_cn text,
    asia_lead_time_days integer,
    style_tags text[] DEFAULT '{}'::text[] NOT NULL,
    public_rrp_visible boolean DEFAULT false NOT NULL,
    crate_specs jsonb DEFAULT '[]'::jsonb NOT NULL,
    hs_code_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT trade_products_default_ship_mode_check CHECK (((default_ship_mode IS NULL) OR (default_ship_mode = ANY (ARRAY['sea_lcl'::text, 'sea_fcl'::text, 'air'::text, 'road'::text, 'courier'::text])))),
    CONSTRAINT trade_products_pickup_country_iso2_check CHECK (((pickup_country IS NULL) OR (pickup_country ~ '^[A-Z]{2}$'::text)))
);


--
-- Name: COLUMN trade_products.price_per_sqm_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.price_per_sqm_cents IS 'Mirrored from designer_curator_picks via sync trigger. See column comment on the picks table.';


--
-- Name: COLUMN trade_products.glb_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.glb_url IS 'Public URL of a GLB/GLTF 3D model (e.g. from Meshy). When set, renders a <model-viewer> on the trade product page.';


--
-- Name: COLUMN trade_products.width_mm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.width_mm IS 'Overall width in millimetres. Parsed from dimensions text or set manually.';


--
-- Name: COLUMN trade_products.height_mm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.height_mm IS 'Overall height in millimetres.';


--
-- Name: COLUMN trade_products.depth_mm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.depth_mm IS 'Overall depth (or length for French L× ordering) in millimetres.';


--
-- Name: COLUMN trade_products.seat_height_mm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.seat_height_mm IS 'Seat height in millimetres (seating only).';


--
-- Name: COLUMN trade_products.is_contract_grade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.is_contract_grade IS 'Suitable for hospitality/contract projects.';


--
-- Name: COLUMN trade_products.lead_time_weeks_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.lead_time_weeks_min IS 'Canonical minimum lead time in weeks. Prefer over lead_weeks_min_override (legacy) and free-text lead_time.';


--
-- Name: COLUMN trade_products.lead_time_weeks_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.lead_time_weeks_max IS 'Canonical maximum lead time in weeks. Prefer over lead_weeks_max_override (legacy) and free-text lead_time.';


--
-- Name: COLUMN trade_products.in_situ_sg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.in_situ_sg IS 'True when the piece is physically available at the Singapore District 9 showroom for immediate white-glove delivery.';


--
-- Name: COLUMN trade_products.available_from; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.available_from IS 'Optional date the in-situ piece becomes available; NULL means immediately.';


--
-- Name: COLUMN trade_products.provenance_cn; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.provenance_cn IS 'Optional Mandarin provenance snippet used by the CN concierge instead of the auto-translated version.';


--
-- Name: COLUMN trade_products.asia_lead_time_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_products.asia_lead_time_days IS 'Optional per-product override for Asia (Greater China / SEA) lead time, in days. Overrides the brand-level default.';


--
-- Name: trade_products_public_rrp; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.trade_products_public_rrp WITH (security_invoker=off) AS
 SELECT t.id,
    t.source_pick_id,
    t.rrp_price_cents,
    t.currency,
    t.price_unit,
    t.price_prefix,
    p.size_variants AS rrp_size_variants
   FROM (public.trade_products t
     LEFT JOIN public.designer_curator_picks p ON ((p.id = t.source_pick_id)))
  WHERE (t.is_active AND t.public_rrp_visible AND (COALESCE(t.rrp_price_cents, 0) > 0));


--
-- Name: trade_program_signups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_program_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    company_name text,
    website_url text,
    step smallint DEFAULT 1 NOT NULL,
    source text DEFAULT 'trade-program-hero'::text NOT NULL,
    user_agent text,
    referrer text,
    invite_email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_reg_number text,
    credential_document_path text
);


--
-- Name: trade_quote_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_quote_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    label text NOT NULL,
    amount_cents integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text,
    quantity integer DEFAULT 1 NOT NULL
);


--
-- Name: trade_quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_cents integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    axonometric_image_url text,
    po_number text,
    cost_code text,
    lead_time_weeks_override integer,
    deposit_pct_override numeric(5,4),
    variant_label text,
    room text,
    ship_origin_country text,
    ship_mode text,
    ship_cbm numeric(8,3),
    ship_weight_kg numeric(10,2),
    internal_notes text,
    fabric_id uuid,
    fabric_meters numeric(6,2),
    fabric_upcharge_cents integer,
    fabric_currency text,
    wood_fabric_id uuid,
    unit_price_currency text,
    required_by_date date,
    image_url text,
    po_status text DEFAULT 'pending'::text NOT NULL,
    po_approved_by uuid,
    po_approved_by_name text,
    po_approved_at timestamp with time zone,
    po_change_request_note text,
    supplier_id uuid,
    po_dispatched_at timestamp with time zone,
    po_dispatch_email text,
    po_document_path text,
    supplier_invoice_status text DEFAULT 'missing'::text NOT NULL,
    supplier_invoice_total_cents bigint,
    po_payment_status text DEFAULT 'unpaid'::text NOT NULL,
    po_due_date date,
    po_deposit_paid_at timestamp with time zone,
    po_balance_due_date date,
    po_fully_paid_at timestamp with time zone,
    fabrication_start_date date,
    expected_ready_override date,
    crating_cents integer,
    crating_currency text,
    CONSTRAINT trade_quote_items_ship_mode_check CHECK (((ship_mode IS NULL) OR (ship_mode = ANY (ARRAY['sea_lcl'::text, 'sea_fcl'::text, 'air'::text, 'road'::text, 'courier'::text]))))
);


--
-- Name: COLUMN trade_quote_items.po_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.po_number IS 'Optional purchase order reference per quote line';


--
-- Name: COLUMN trade_quote_items.cost_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.cost_code IS 'Optional internal cost / budget code per quote line';


--
-- Name: COLUMN trade_quote_items.lead_time_weeks_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.lead_time_weeks_override IS 'Optional override of the default product lead time, in weeks';


--
-- Name: COLUMN trade_quote_items.deposit_pct_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.deposit_pct_override IS 'Optional override of default deposit percent (0..1), e.g. 0.5 for 50%';


--
-- Name: COLUMN trade_quote_items.ship_origin_country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.ship_origin_country IS 'ISO-2 origin country for this line. Overrides trade_products.origin for shipping grouping.';


--
-- Name: COLUMN trade_quote_items.ship_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.ship_mode IS 'Shipping mode for this line (sea_lcl|sea_fcl|air|road|courier). NULL = auto.';


--
-- Name: COLUMN trade_quote_items.ship_cbm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.ship_cbm IS 'Per-line packing volume in cubic metres.';


--
-- Name: COLUMN trade_quote_items.ship_weight_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quote_items.ship_weight_kg IS 'Per-line gross weight in kilograms.';


--
-- Name: trade_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    client_name text DEFAULT ''::text,
    admin_notes text,
    responded_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    project_id uuid,
    studio_id uuid,
    insurance_enabled boolean DEFAULT false NOT NULL,
    insurance_tier text DEFAULT 'standard'::text NOT NULL,
    insurance_rate_bps smallint DEFAULT 50 NOT NULL,
    insurance_notes text,
    client_id uuid,
    issue_date date,
    credit_applied_cents integer DEFAULT 0 NOT NULL,
    landed_cost_cbm numeric,
    landed_cost_kg numeric,
    landed_cost_mode text DEFAULT 'road'::text NOT NULL,
    ship_to_name text,
    ship_to_attention text,
    ship_to_address1 text,
    ship_to_address2 text,
    ship_to_city text,
    ship_to_state text,
    ship_to_postal_code text,
    ship_to_country text,
    ship_to_phone text,
    ship_to_email text,
    ship_to_notes text,
    incoterm text,
    ship_to_same_as_bill boolean DEFAULT true NOT NULL,
    billing_mode public.billing_mode DEFAULT 'agent_commission'::public.billing_mode NOT NULL,
    payer_type public.payer_type DEFAULT 'end_client'::public.payer_type NOT NULL,
    commission_pct numeric,
    net_discount_pct numeric,
    end_client_billing jsonb,
    designer_payout_account_id uuid,
    resale_certificate_id uuid,
    managed_freight_quote_id uuid,
    quote_kind text DEFAULT 'trade'::text NOT NULL,
    source_inquiry_id uuid,
    client_pdf_path text,
    client_pdf_updated_at timestamp with time zone,
    client_pdf_download_token uuid DEFAULT gen_random_uuid() NOT NULL,
    exchange_rate_at_creation numeric(20,10),
    exchange_rate_locked_at timestamp with time zone,
    exchange_rate_base_currency text,
    CONSTRAINT trade_quotes_incoterm_check CHECK (((incoterm IS NULL) OR (incoterm = ANY (ARRAY['EXW'::text, 'FCA'::text, 'FOB'::text, 'CIF'::text, 'CIP'::text, 'DAP'::text, 'DDP'::text, 'DPU'::text])))),
    CONSTRAINT trade_quotes_insurance_tier_check CHECK ((insurance_tier = ANY (ARRAY['standard'::text, 'premium'::text, 'all_risk'::text]))),
    CONSTRAINT trade_quotes_landed_cost_mode_check CHECK ((landed_cost_mode = ANY (ARRAY['road'::text, 'courier'::text])))
);


--
-- Name: COLUMN trade_quotes.landed_cost_cbm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quotes.landed_cost_cbm IS 'Saved declared volume for landed-cost estimates.';


--
-- Name: COLUMN trade_quotes.landed_cost_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quotes.landed_cost_kg IS 'Saved declared or chargeable weight for landed-cost estimates.';


--
-- Name: COLUMN trade_quotes.landed_cost_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trade_quotes.landed_cost_mode IS 'Saved landed-cost freight mode.';


--
-- Name: trade_recent_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_recent_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_label text,
    brand_name text,
    category text,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_recent_views_entity_type_check CHECK ((entity_type = ANY (ARRAY['designer'::text, 'product'::text, 'curator_pick'::text])))
);


--
-- Name: trade_sample_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_sample_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_name text NOT NULL,
    brand_name text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    project_name text DEFAULT ''::text NOT NULL,
    shipping_address text DEFAULT ''::text NOT NULL,
    shipping_city text DEFAULT ''::text NOT NULL,
    shipping_country text DEFAULT 'Singapore'::text NOT NULL,
    return_by date,
    notes text,
    status public.sample_request_status DEFAULT 'requested'::public.sample_request_status NOT NULL,
    admin_notes text,
    tracking_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    tearsheet_url text,
    product_id uuid
);


--
-- Name: trade_tier_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_tier_config (
    tier public.trade_tier NOT NULL,
    discount_pct numeric NOT NULL,
    min_spend_cents bigint DEFAULT 0 NOT NULL,
    label text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);

ALTER TABLE ONLY public.trade_tier_config REPLICA IDENTITY FULL;


--
-- Name: trade_user_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_user_memory (
    user_id uuid NOT NULL,
    default_deadline date,
    default_budget_cents bigint,
    default_currency text,
    preferred_lead_weeks_max integer,
    studio_style_notes text,
    style_tags text[] DEFAULT '{}'::text[] NOT NULL,
    preferred_materials text[] DEFAULT '{}'::text[] NOT NULL,
    preferred_categories text[] DEFAULT '{}'::text[] NOT NULL,
    preferred_designers text[] DEFAULT '{}'::text[] NOT NULL,
    last_brief_summary text,
    source text DEFAULT 'concierge'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: verification_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    event text NOT NULL,
    actor text DEFAULT 'ai'::text NOT NULL,
    actor_user_id uuid,
    previous_status text,
    confidence_score integer,
    reasoning text,
    attempt integer,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome text DEFAULT 'unknown'::text NOT NULL
);


--
-- Name: verification_feedback_loops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_feedback_loops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    submission jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_reasoning text,
    ai_confidence numeric,
    admin_decision text NOT NULL,
    admin_notes text,
    decided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: video_watch_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_watch_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    event_type text NOT NULL,
    video_id text DEFAULT 'apartment-tour'::text NOT NULL,
    progress_percent smallint,
    watch_duration_seconds numeric,
    user_agent text,
    referrer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_delivery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_delivery_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_sid text NOT NULL,
    message_status text,
    error_code integer,
    error_message text,
    to_number text,
    from_number text,
    channel text DEFAULT 'twilio_whatsapp'::text NOT NULL,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.whatsapp_delivery_events REPLICA IDENTITY FULL;


--
-- Name: regional_logistics_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_logistics_rules ALTER COLUMN id SET DEFAULT nextval('public.regional_logistics_rules_id_seq'::regclass);


--
-- Name: abandoned_carts abandoned_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_carts
    ADD CONSTRAINT abandoned_carts_pkey PRIMARY KEY (id);


--
-- Name: abandoned_carts abandoned_carts_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_carts
    ADD CONSTRAINT abandoned_carts_session_id_key UNIQUE (session_id);


--
-- Name: admin_alert_log admin_alert_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_alert_log
    ADD CONSTRAINT admin_alert_log_pkey PRIMARY KEY (id);


--
-- Name: ai_model_pricing ai_model_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_model_pricing
    ADD CONSTRAINT ai_model_pricing_pkey PRIMARY KEY (model);


--
-- Name: ai_response_cache ai_response_cache_feature_model_prompt_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_response_cache
    ADD CONSTRAINT ai_response_cache_feature_model_prompt_hash_key UNIQUE (feature, model, prompt_hash);


--
-- Name: ai_response_cache ai_response_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_response_cache
    ADD CONSTRAINT ai_response_cache_pkey PRIMARY KEY (id);


--
-- Name: ai_semantic_cache ai_semantic_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_semantic_cache
    ADD CONSTRAINT ai_semantic_cache_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id);


--
-- Name: analytics_rate_limits analytics_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_rate_limits
    ADD CONSTRAINT analytics_rate_limits_pkey PRIMARY KEY (bucket_key);


--
-- Name: auction_benchmarks auction_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_benchmarks
    ADD CONSTRAINT auction_benchmarks_pkey PRIMARY KEY (id);


--
-- Name: axonometric_cad_qa axonometric_cad_qa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axonometric_cad_qa
    ADD CONSTRAINT axonometric_cad_qa_pkey PRIMARY KEY (id);


--
-- Name: axonometric_gallery axonometric_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axonometric_gallery
    ADD CONSTRAINT axonometric_gallery_pkey PRIMARY KEY (id);


--
-- Name: axonometric_requests axonometric_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axonometric_requests
    ADD CONSTRAINT axonometric_requests_pkey PRIMARY KEY (id);


--
-- Name: board_recommendations board_recommendations_board_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_recommendations
    ADD CONSTRAINT board_recommendations_board_id_product_id_key UNIQUE (board_id, product_id);


--
-- Name: board_recommendations board_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_recommendations
    ADD CONSTRAINT board_recommendations_pkey PRIMARY KEY (id);


--
-- Name: brand_lead_times brand_lead_times_brand_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_lead_times
    ADD CONSTRAINT brand_lead_times_brand_name_key UNIQUE (brand_name);


--
-- Name: brand_lead_times brand_lead_times_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_lead_times
    ADD CONSTRAINT brand_lead_times_pkey PRIMARY KEY (id);


--
-- Name: brand_thumbnails brand_thumbnails_brand_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_thumbnails
    ADD CONSTRAINT brand_thumbnails_brand_name_key UNIQUE (brand_name);


--
-- Name: brand_thumbnails brand_thumbnails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_thumbnails
    ADD CONSTRAINT brand_thumbnails_pkey PRIMARY KEY (id);


--
-- Name: brief_drafts brief_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brief_drafts
    ADD CONSTRAINT brief_drafts_pkey PRIMARY KEY (user_id);


--
-- Name: cad_asset_downloads cad_asset_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_asset_downloads
    ADD CONSTRAINT cad_asset_downloads_pkey PRIMARY KEY (id);


--
-- Name: cad_documents cad_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_documents
    ADD CONSTRAINT cad_documents_pkey PRIMARY KEY (id);


--
-- Name: cad_fit_edit_audit cad_fit_edit_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_fit_edit_audit
    ADD CONSTRAINT cad_fit_edit_audit_pkey PRIMARY KEY (id);


--
-- Name: cad_fit_reports cad_fit_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_fit_reports
    ADD CONSTRAINT cad_fit_reports_pkey PRIMARY KEY (id);


--
-- Name: client_board_comments client_board_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_comments
    ADD CONSTRAINT client_board_comments_pkey PRIMARY KEY (id);


--
-- Name: client_board_items client_board_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_items
    ADD CONSTRAINT client_board_items_pkey PRIMARY KEY (id);


--
-- Name: client_boards client_boards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_pkey PRIMARY KEY (id);


--
-- Name: client_boards client_boards_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_share_token_key UNIQUE (share_token);


--
-- Name: client_contacts client_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);


--
-- Name: client_documents client_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_documents
    ADD CONSTRAINT client_documents_pkey PRIMARY KEY (id);


--
-- Name: client_taste_profiles client_taste_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_taste_profiles
    ADD CONSTRAINT client_taste_profiles_pkey PRIMARY KEY (id);


--
-- Name: client_taste_profiles client_taste_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_taste_profiles
    ADD CONSTRAINT client_taste_profiles_user_id_key UNIQUE (user_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: cn_director_briefs cn_director_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cn_director_briefs
    ADD CONSTRAINT cn_director_briefs_pkey PRIMARY KEY (id);


--
-- Name: collectible_atelier_gallery collectible_atelier_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collectible_atelier_gallery
    ADD CONSTRAINT collectible_atelier_gallery_pkey PRIMARY KEY (id);


--
-- Name: collectible_atelier_overrides collectible_atelier_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collectible_atelier_overrides
    ADD CONSTRAINT collectible_atelier_overrides_pkey PRIMARY KEY (slug);


--
-- Name: collectible_overrides collectible_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collectible_overrides
    ADD CONSTRAINT collectible_overrides_pkey PRIMARY KEY (slug);


--
-- Name: collector_applications collector_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_applications
    ADD CONSTRAINT collector_applications_pkey PRIMARY KEY (id);


--
-- Name: collector_applications collector_applications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_applications
    ADD CONSTRAINT collector_applications_user_id_key UNIQUE (user_id);


--
-- Name: competitor_designers competitor_designers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_designers
    ADD CONSTRAINT competitor_designers_pkey PRIMARY KEY (id);


--
-- Name: competitor_galleries competitor_galleries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_galleries
    ADD CONSTRAINT competitor_galleries_pkey PRIMARY KEY (id);


--
-- Name: competitor_traffic competitor_traffic_gallery_id_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_traffic
    ADD CONSTRAINT competitor_traffic_gallery_id_month_key UNIQUE (gallery_id, month);


--
-- Name: competitor_traffic competitor_traffic_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_traffic
    ADD CONSTRAINT competitor_traffic_pkey PRIMARY KEY (id);


--
-- Name: concierge_leads concierge_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_leads
    ADD CONSTRAINT concierge_leads_pkey PRIMARY KEY (id);


--
-- Name: concierge_rag_traces concierge_rag_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_rag_traces
    ADD CONSTRAINT concierge_rag_traces_pkey PRIMARY KEY (id);


--
-- Name: concierge_rate_limits concierge_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_rate_limits
    ADD CONSTRAINT concierge_rate_limits_pkey PRIMARY KEY (key);


--
-- Name: concierge_roster_embeddings concierge_roster_embeddings_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_roster_embeddings
    ADD CONSTRAINT concierge_roster_embeddings_name_key UNIQUE (name);


--
-- Name: concierge_roster_embeddings concierge_roster_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_roster_embeddings
    ADD CONSTRAINT concierge_roster_embeddings_pkey PRIMARY KEY (id);


--
-- Name: concierge_sessions concierge_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_sessions
    ADD CONSTRAINT concierge_sessions_pkey PRIMARY KEY (user_id);


--
-- Name: concierge_stream_frames concierge_stream_frames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_stream_frames
    ADD CONSTRAINT concierge_stream_frames_pkey PRIMARY KEY (stream_id, seq);


--
-- Name: concierge_stream_sessions concierge_stream_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_stream_sessions
    ADD CONSTRAINT concierge_stream_sessions_pkey PRIMARY KEY (stream_id);


--
-- Name: concierge_threads concierge_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_threads
    ADD CONSTRAINT concierge_threads_pkey PRIMARY KEY (id);


--
-- Name: content_audit_log content_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_audit_log
    ADD CONSTRAINT content_audit_log_pkey PRIMARY KEY (id);


--
-- Name: cpd_attendance cpd_attendance_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpd_attendance
    ADD CONSTRAINT cpd_attendance_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: cpd_attendance cpd_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpd_attendance
    ADD CONSTRAINT cpd_attendance_pkey PRIMARY KEY (id);


--
-- Name: cpd_events cpd_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpd_events
    ADD CONSTRAINT cpd_events_pkey PRIMARY KEY (id);


--
-- Name: cron_http_call_log cron_http_call_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_http_call_log
    ADD CONSTRAINT cron_http_call_log_pkey PRIMARY KEY (request_id);


--
-- Name: curated_drops curated_drops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curated_drops
    ADD CONSTRAINT curated_drops_pkey PRIMARY KEY (id);


--
-- Name: currency_rates currency_rates_pair_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency_rates
    ADD CONSTRAINT currency_rates_pair_unique UNIQUE (base_currency, target_currency);


--
-- Name: currency_rates currency_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency_rates
    ADD CONSTRAINT currency_rates_pkey PRIMARY KEY (id);


--
-- Name: custom_inquiries custom_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_inquiries
    ADD CONSTRAINT custom_inquiries_pkey PRIMARY KEY (id);


--
-- Name: descriptor_taxonomy descriptor_taxonomy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptor_taxonomy
    ADD CONSTRAINT descriptor_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: descriptor_taxonomy descriptor_taxonomy_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptor_taxonomy
    ADD CONSTRAINT descriptor_taxonomy_slug_key UNIQUE (slug);


--
-- Name: designer_curator_picks designer_curator_picks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_curator_picks
    ADD CONSTRAINT designer_curator_picks_pkey PRIMARY KEY (id);


--
-- Name: designer_curator_picks_public designer_curator_picks_public_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_curator_picks_public
    ADD CONSTRAINT designer_curator_picks_public_pkey PRIMARY KEY (id);


--
-- Name: designer_heritage_slides designer_heritage_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_heritage_slides
    ADD CONSTRAINT designer_heritage_slides_pkey PRIMARY KEY (id);


--
-- Name: designer_instagram_posts designer_instagram_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_instagram_posts
    ADD CONSTRAINT designer_instagram_posts_pkey PRIMARY KEY (id);


--
-- Name: designer_payouts designer_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_payouts
    ADD CONSTRAINT designer_payouts_pkey PRIMARY KEY (id);


--
-- Name: designer_purchase_orders designer_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_purchase_orders
    ADD CONSTRAINT designer_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: designer_purchase_orders designer_purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_purchase_orders
    ADD CONSTRAINT designer_purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: designers designers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designers
    ADD CONSTRAINT designers_pkey PRIMARY KEY (id);


--
-- Name: designers designers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designers
    ADD CONSTRAINT designers_slug_key UNIQUE (slug);


--
-- Name: document_downloads document_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_downloads
    ADD CONSTRAINT document_downloads_pkey PRIMARY KEY (id);


--
-- Name: email_click_log email_click_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_click_log
    ADD CONSTRAINT email_click_log_pkey PRIMARY KEY (id);


--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);


--
-- Name: email_send_state email_send_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_state
    ADD CONSTRAINT email_send_state_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_email_key UNIQUE (email);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_unsubscribe_tokens email_unsubscribe_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_unsubscribe_tokens
    ADD CONSTRAINT email_unsubscribe_tokens_token_key UNIQUE (token);


--
-- Name: fabrics fabrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fabrics
    ADD CONSTRAINT fabrics_pkey PRIMARY KEY (id);


--
-- Name: favorite_folder_items favorite_folder_items_folder_id_favorite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_folder_items
    ADD CONSTRAINT favorite_folder_items_folder_id_favorite_id_key UNIQUE (folder_id, favorite_id);


--
-- Name: favorite_folder_items favorite_folder_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_folder_items
    ADD CONSTRAINT favorite_folder_items_pkey PRIMARY KEY (id);


--
-- Name: favorite_folders favorite_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_folders
    ADD CONSTRAINT favorite_folders_pkey PRIMARY KEY (id);


--
-- Name: featured_studios featured_studios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_studios
    ADD CONSTRAINT featured_studios_pkey PRIMARY KEY (id);


--
-- Name: featured_studios_public featured_studios_public_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_studios_public
    ADD CONSTRAINT featured_studios_public_pkey PRIMARY KEY (id);


--
-- Name: featured_studios featured_studios_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_studios
    ADD CONSTRAINT featured_studios_slug_key UNIQUE (slug);


--
-- Name: ffe_entitlements ffe_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ffe_entitlements
    ADD CONSTRAINT ffe_entitlements_pkey PRIMARY KEY (id);


--
-- Name: ffe_entitlements ffe_entitlements_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ffe_entitlements
    ADD CONSTRAINT ffe_entitlements_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: funnel_card_payments funnel_card_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_card_payments
    ADD CONSTRAINT funnel_card_payments_pkey PRIMARY KEY (id);


--
-- Name: funnel_card_payments funnel_card_payments_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_card_payments
    ADD CONSTRAINT funnel_card_payments_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: funnel_reminder_log funnel_reminder_log_entity_type_entity_id_reminder_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_reminder_log
    ADD CONSTRAINT funnel_reminder_log_entity_type_entity_id_reminder_number_key UNIQUE (entity_type, entity_id, reminder_number);


--
-- Name: funnel_reminder_log funnel_reminder_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_reminder_log
    ADD CONSTRAINT funnel_reminder_log_pkey PRIMARY KEY (id);


--
-- Name: funnel_reminder_pauses funnel_reminder_pauses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_reminder_pauses
    ADD CONSTRAINT funnel_reminder_pauses_pkey PRIMARY KEY (entity_type, entity_id);


--
-- Name: gallery_hotspots gallery_hotspots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_hotspots
    ADD CONSTRAINT gallery_hotspots_pkey PRIMARY KEY (id);


--
-- Name: guardrail_logs guardrail_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guardrail_logs
    ADD CONSTRAINT guardrail_logs_pkey PRIMARY KEY (id);


--
-- Name: guide_views guide_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_views
    ADD CONSTRAINT guide_views_pkey PRIMARY KEY (id);


--
-- Name: ingestion_job_state ingestion_job_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_job_state
    ADD CONSTRAINT ingestion_job_state_pkey PRIMARY KEY (id);


--
-- Name: ingestion_queue ingestion_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_queue
    ADD CONSTRAINT ingestion_queue_pkey PRIMARY KEY (id);


--
-- Name: ingestion_queue ingestion_queue_source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingestion_queue
    ADD CONSTRAINT ingestion_queue_source_url_key UNIQUE (source_url);


--
-- Name: inquiries inquiries_concierge_lead_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_concierge_lead_id_key UNIQUE (concierge_lead_id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: journal_articles journal_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_articles
    ADD CONSTRAINT journal_articles_pkey PRIMARY KEY (id);


--
-- Name: journal_articles journal_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_articles
    ADD CONSTRAINT journal_articles_slug_key UNIQUE (slug);


--
-- Name: journal_pipeline journal_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_pipeline
    ADD CONSTRAINT journal_pipeline_pkey PRIMARY KEY (id);


--
-- Name: magazine_badge_events magazine_badge_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magazine_badge_events
    ADD CONSTRAINT magazine_badge_events_pkey PRIMARY KEY (id);


--
-- Name: markup_annotations markup_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markup_annotations
    ADD CONSTRAINT markup_annotations_pkey PRIMARY KEY (id);


--
-- Name: material_swatches material_swatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_swatches
    ADD CONSTRAINT material_swatches_pkey PRIMARY KEY (id);


--
-- Name: material_taxonomy material_taxonomy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_taxonomy
    ADD CONSTRAINT material_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: material_taxonomy material_taxonomy_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_taxonomy
    ADD CONSTRAINT material_taxonomy_slug_key UNIQUE (slug);


--
-- Name: mcp_click_log mcp_click_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_click_log
    ADD CONSTRAINT mcp_click_log_pkey PRIMARY KEY (id);


--
-- Name: mcp_query_log mcp_query_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_query_log
    ADD CONSTRAINT mcp_query_log_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: og_rescrape_runs og_rescrape_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.og_rescrape_runs
    ADD CONSTRAINT og_rescrape_runs_pkey PRIMARY KEY (id);


--
-- Name: onboarding_flow_config onboarding_flow_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_flow_config
    ADD CONSTRAINT onboarding_flow_config_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tour_steps onboarding_tour_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tour_steps
    ADD CONSTRAINT onboarding_tour_steps_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tour_steps onboarding_tour_steps_step_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tour_steps
    ADD CONSTRAINT onboarding_tour_steps_step_key_key UNIQUE (step_key);


--
-- Name: order_duration_templates order_duration_templates_brand_name_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_duration_templates
    ADD CONSTRAINT order_duration_templates_brand_name_category_key UNIQUE (brand_name, category);


--
-- Name: order_duration_templates order_duration_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_duration_templates
    ADD CONSTRAINT order_duration_templates_pkey PRIMARY KEY (id);


--
-- Name: order_timeline_commission order_timeline_commission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline_commission
    ADD CONSTRAINT order_timeline_commission_pkey PRIMARY KEY (timeline_id);


--
-- Name: order_timeline order_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline
    ADD CONSTRAINT order_timeline_pkey PRIMARY KEY (id);


--
-- Name: order_timeline order_timeline_quote_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline
    ADD CONSTRAINT order_timeline_quote_id_key UNIQUE (quote_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_transaction_id_key UNIQUE (transaction_id);


--
-- Name: payment_credentials payment_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_credentials
    ADD CONSTRAINT payment_credentials_pkey PRIMARY KEY (id);


--
-- Name: personal_email_domains personal_email_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_email_domains
    ADD CONSTRAINT personal_email_domains_pkey PRIMARY KEY (domain);


--
-- Name: portal_invites portal_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invites
    ADD CONSTRAINT portal_invites_code_key UNIQUE (code);


--
-- Name: portal_invites portal_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invites
    ADD CONSTRAINT portal_invites_pkey PRIMARY KEY (id);


--
-- Name: portal_redemptions portal_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_redemptions
    ADD CONSTRAINT portal_redemptions_pkey PRIMARY KEY (id);


--
-- Name: portal_sessions portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: portal_sessions portal_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_token_key UNIQUE (token);


--
-- Name: presentation_comments presentation_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_comments
    ADD CONSTRAINT presentation_comments_pkey PRIMARY KEY (id);


--
-- Name: presentation_shares presentation_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_shares
    ADD CONSTRAINT presentation_shares_pkey PRIMARY KEY (id);


--
-- Name: presentation_shares presentation_shares_presentation_id_shared_with_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_shares
    ADD CONSTRAINT presentation_shares_presentation_id_shared_with_email_key UNIQUE (presentation_id, shared_with_email);


--
-- Name: presentation_slides presentation_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_slides
    ADD CONSTRAINT presentation_slides_pkey PRIMARY KEY (id);


--
-- Name: presentations presentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentations
    ADD CONSTRAINT presentations_pkey PRIMARY KEY (id);


--
-- Name: product_cad_asset_geometry product_cad_asset_geometry_cad_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cad_asset_geometry
    ADD CONSTRAINT product_cad_asset_geometry_cad_asset_id_key UNIQUE (cad_asset_id);


--
-- Name: product_cad_asset_geometry product_cad_asset_geometry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cad_asset_geometry
    ADD CONSTRAINT product_cad_asset_geometry_pkey PRIMARY KEY (id);


--
-- Name: product_descriptor_links product_descriptor_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_descriptor_links
    ADD CONSTRAINT product_descriptor_links_pkey PRIMARY KEY (id);


--
-- Name: product_fabric_swatches_public product_fabric_swatches_public_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_fabric_swatches_public
    ADD CONSTRAINT product_fabric_swatches_public_pkey PRIMARY KEY (pick_id, fabric_id);


--
-- Name: product_fabrics product_fabrics_pick_fabric_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_fabrics
    ADD CONSTRAINT product_fabrics_pick_fabric_uq UNIQUE (pick_id, fabric_id);


--
-- Name: product_fabrics product_fabrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_fabrics
    ADD CONSTRAINT product_fabrics_pkey PRIMARY KEY (id);


--
-- Name: product_material_links product_material_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_material_links
    ADD CONSTRAINT product_material_links_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: provenance_certificates provenance_certificates_designer_id_piece_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provenance_certificates
    ADD CONSTRAINT provenance_certificates_designer_id_piece_title_key UNIQUE (designer_id, piece_title);


--
-- Name: provenance_certificates provenance_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provenance_certificates
    ADD CONSTRAINT provenance_certificates_pkey PRIMARY KEY (id);


--
-- Name: provenance_events provenance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provenance_events
    ADD CONSTRAINT provenance_events_pkey PRIMARY KEY (id);


--
-- Name: public_download_events public_download_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_download_events
    ADD CONSTRAINT public_download_events_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders_payable purchase_orders_payable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders_payable
    ADD CONSTRAINT purchase_orders_payable_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: quote_email_log quote_email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_email_log
    ADD CONSTRAINT quote_email_log_pkey PRIMARY KEY (id);


--
-- Name: quote_payment_links quote_payment_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payment_links
    ADD CONSTRAINT quote_payment_links_pkey PRIMARY KEY (id);


--
-- Name: quote_payment_links quote_payment_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payment_links
    ADD CONSTRAINT quote_payment_links_token_key UNIQUE (token);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: reference_styles reference_styles_mode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_styles
    ADD CONSTRAINT reference_styles_mode_key UNIQUE (mode);


--
-- Name: reference_styles reference_styles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_styles
    ADD CONSTRAINT reference_styles_pkey PRIMARY KEY (id);


--
-- Name: regional_logistics_rules regional_logistics_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_logistics_rules
    ADD CONSTRAINT regional_logistics_rules_pkey PRIMARY KEY (id);


--
-- Name: regional_logistics_tiers regional_logistics_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_logistics_tiers
    ADD CONSTRAINT regional_logistics_tiers_pkey PRIMARY KEY (id);


--
-- Name: regional_logistics_tiers regional_logistics_tiers_region_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_logistics_tiers
    ADD CONSTRAINT regional_logistics_tiers_region_tier_key UNIQUE (region_tier);


--
-- Name: room_planner_projects room_planner_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_planner_projects
    ADD CONSTRAINT room_planner_projects_pkey PRIMARY KEY (id);


--
-- Name: sample_request_audit_log sample_request_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_audit_log
    ADD CONSTRAINT sample_request_audit_log_pkey PRIMARY KEY (id);


--
-- Name: scrape_configs scrape_configs_brand_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrape_configs
    ADD CONSTRAINT scrape_configs_brand_name_key UNIQUE (brand_name);


--
-- Name: scrape_configs scrape_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrape_configs
    ADD CONSTRAINT scrape_configs_pkey PRIMARY KEY (id);


--
-- Name: scrape_runs scrape_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrape_runs
    ADD CONSTRAINT scrape_runs_pkey PRIMARY KEY (id);


--
-- Name: section_heroes section_heroes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_heroes
    ADD CONSTRAINT section_heroes_pkey PRIMARY KEY (id);


--
-- Name: section_heroes section_heroes_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_heroes
    ADD CONSTRAINT section_heroes_section_key_key UNIQUE (section_key);


--
-- Name: security_alert_state security_alert_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_alert_state
    ADD CONSTRAINT security_alert_state_pkey PRIMARY KEY (id);


--
-- Name: security_audit_events security_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_events
    ADD CONSTRAINT security_audit_events_pkey PRIMARY KEY (id);


--
-- Name: shipping_duty_rates shipping_duty_rates_dest_country_hs_chapter_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_duty_rates
    ADD CONSTRAINT shipping_duty_rates_dest_country_hs_chapter_category_key UNIQUE (dest_country, hs_chapter, category);


--
-- Name: shipping_duty_rates shipping_duty_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_duty_rates
    ADD CONSTRAINT shipping_duty_rates_pkey PRIMARY KEY (id);


--
-- Name: shipping_lanes shipping_lanes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_lanes
    ADD CONSTRAINT shipping_lanes_pkey PRIMARY KEY (id);


--
-- Name: shipping_quotes shipping_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_pkey PRIMARY KEY (id);


--
-- Name: shipping_rate_brackets shipping_rate_brackets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rate_brackets
    ADD CONSTRAINT shipping_rate_brackets_pkey PRIMARY KEY (id);


--
-- Name: shipping_surcharges shipping_surcharges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_surcharges
    ADD CONSTRAINT shipping_surcharges_pkey PRIMARY KEY (id);


--
-- Name: shop_order_items shop_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_pkey PRIMARY KEY (id);


--
-- Name: shop_orders shop_orders_order_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_order_ref_key UNIQUE (order_ref);


--
-- Name: shop_orders shop_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_pkey PRIMARY KEY (id);


--
-- Name: sitemap_products sitemap_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitemap_products
    ADD CONSTRAINT sitemap_products_pkey PRIMARY KEY (id);


--
-- Name: studio_alerts studio_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_alerts
    ADD CONSTRAINT studio_alerts_pkey PRIMARY KEY (id);


--
-- Name: studio_invites studio_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_invites
    ADD CONSTRAINT studio_invites_pkey PRIMARY KEY (id);


--
-- Name: studio_invites studio_invites_studio_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_invites
    ADD CONSTRAINT studio_invites_studio_id_email_key UNIQUE (studio_id, email);


--
-- Name: studio_invites studio_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_invites
    ADD CONSTRAINT studio_invites_token_key UNIQUE (token);


--
-- Name: studio_lead_events studio_lead_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_lead_events
    ADD CONSTRAINT studio_lead_events_pkey PRIMARY KEY (id);


--
-- Name: studio_members studio_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_members
    ADD CONSTRAINT studio_members_pkey PRIMARY KEY (id);


--
-- Name: studio_members studio_members_studio_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_members
    ADD CONSTRAINT studio_members_studio_id_user_id_key UNIQUE (studio_id, user_id);


--
-- Name: studio_payout_accounts studio_payout_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_payout_accounts
    ADD CONSTRAINT studio_payout_accounts_pkey PRIMARY KEY (id);


--
-- Name: studio_payout_accounts studio_payout_accounts_stripe_connect_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_payout_accounts
    ADD CONSTRAINT studio_payout_accounts_stripe_connect_account_id_key UNIQUE (stripe_connect_account_id);


--
-- Name: studio_project_overrides studio_project_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_overrides
    ADD CONSTRAINT studio_project_overrides_pkey PRIMARY KEY (id);


--
-- Name: studio_project_overrides studio_project_overrides_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_overrides
    ADD CONSTRAINT studio_project_overrides_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: studio_resale_certificates studio_resale_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resale_certificates
    ADD CONSTRAINT studio_resale_certificates_pkey PRIMARY KEY (id);


--
-- Name: studio_submissions studio_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_submissions
    ADD CONSTRAINT studio_submissions_pkey PRIMARY KEY (id);


--
-- Name: studios studios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_pkey PRIMARY KEY (id);


--
-- Name: studios studios_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studios
    ADD CONSTRAINT studios_slug_key UNIQUE (slug);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (supplier_name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppressed_emails suppressed_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_email_key UNIQUE (email);


--
-- Name: suppressed_emails suppressed_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppressed_emails
    ADD CONSTRAINT suppressed_emails_pkey PRIMARY KEY (id);


--
-- Name: tour_events tour_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tour_events
    ADD CONSTRAINT tour_events_pkey PRIMARY KEY (id);


--
-- Name: trade_applications trade_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_applications
    ADD CONSTRAINT trade_applications_pkey PRIMARY KEY (id);


--
-- Name: trade_concierge_actions trade_concierge_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_concierge_actions
    ADD CONSTRAINT trade_concierge_actions_pkey PRIMARY KEY (id);


--
-- Name: trade_concierge_escalations trade_concierge_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_concierge_escalations
    ADD CONSTRAINT trade_concierge_escalations_pkey PRIMARY KEY (id);


--
-- Name: trade_concierge_usage trade_concierge_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_concierge_usage
    ADD CONSTRAINT trade_concierge_usage_pkey PRIMARY KEY (id);


--
-- Name: trade_credits trade_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_credits
    ADD CONSTRAINT trade_credits_pkey PRIMARY KEY (id);


--
-- Name: trade_custom_request_activity trade_custom_request_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_request_activity
    ADD CONSTRAINT trade_custom_request_activity_pkey PRIMARY KEY (id);


--
-- Name: trade_custom_requests trade_custom_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_requests
    ADD CONSTRAINT trade_custom_requests_pkey PRIMARY KEY (id);


--
-- Name: trade_documents trade_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_documents
    ADD CONSTRAINT trade_documents_pkey PRIMARY KEY (id);


--
-- Name: trade_fair_events trade_fair_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_fair_events
    ADD CONSTRAINT trade_fair_events_pkey PRIMARY KEY (id);


--
-- Name: trade_fair_events trade_fair_events_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_fair_events
    ADD CONSTRAINT trade_fair_events_slug_key UNIQUE (slug);


--
-- Name: trade_favorites trade_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_favorites
    ADD CONSTRAINT trade_favorites_pkey PRIMARY KEY (id);


--
-- Name: trade_favorites trade_favorites_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_favorites
    ADD CONSTRAINT trade_favorites_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: trade_floor_plan_layouts trade_floor_plan_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_floor_plan_layouts
    ADD CONSTRAINT trade_floor_plan_layouts_pkey PRIMARY KEY (id);


--
-- Name: trade_floor_plans trade_floor_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_floor_plans
    ADD CONSTRAINT trade_floor_plans_pkey PRIMARY KEY (id);


--
-- Name: trade_product_cad_assets trade_product_cad_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_cad_assets
    ADD CONSTRAINT trade_product_cad_assets_pkey PRIMARY KEY (id);


--
-- Name: trade_product_glb_variants trade_product_glb_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_glb_variants
    ADD CONSTRAINT trade_product_glb_variants_pkey PRIMARY KEY (id);


--
-- Name: trade_product_glb_variants trade_product_glb_variants_product_id_variant_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_glb_variants
    ADD CONSTRAINT trade_product_glb_variants_product_id_variant_label_key UNIQUE (product_id, variant_label);


--
-- Name: trade_product_pricing trade_product_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_pricing
    ADD CONSTRAINT trade_product_pricing_pkey PRIMARY KEY (pick_id);


--
-- Name: trade_products trade_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_products
    ADD CONSTRAINT trade_products_pkey PRIMARY KEY (id);


--
-- Name: trade_program_signups trade_program_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_program_signups
    ADD CONSTRAINT trade_program_signups_pkey PRIMARY KEY (id);


--
-- Name: trade_quote_extras trade_quote_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_extras
    ADD CONSTRAINT trade_quote_extras_pkey PRIMARY KEY (id);


--
-- Name: trade_quote_items trade_quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_pkey PRIMARY KEY (id);


--
-- Name: trade_quotes trade_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_pkey PRIMARY KEY (id);


--
-- Name: trade_recent_views trade_recent_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_recent_views
    ADD CONSTRAINT trade_recent_views_pkey PRIMARY KEY (id);


--
-- Name: trade_sample_requests trade_sample_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_sample_requests
    ADD CONSTRAINT trade_sample_requests_pkey PRIMARY KEY (id);


--
-- Name: trade_tier_config trade_tier_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_tier_config
    ADD CONSTRAINT trade_tier_config_pkey PRIMARY KEY (tier);


--
-- Name: trade_user_memory trade_user_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_user_memory
    ADD CONSTRAINT trade_user_memory_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: verification_audit_log verification_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_audit_log
    ADD CONSTRAINT verification_audit_log_pkey PRIMARY KEY (id);


--
-- Name: verification_feedback_loops verification_feedback_loops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_feedback_loops
    ADD CONSTRAINT verification_feedback_loops_pkey PRIMARY KEY (id);


--
-- Name: video_watch_events video_watch_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_watch_events
    ADD CONSTRAINT video_watch_events_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_delivery_events whatsapp_delivery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_delivery_events
    ADD CONSTRAINT whatsapp_delivery_events_pkey PRIMARY KEY (id);


--
-- Name: admin_alert_log_application_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_alert_log_application_id_idx ON public.admin_alert_log USING btree (application_id, created_at DESC);


--
-- Name: ai_response_cache_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_response_cache_expires_idx ON public.ai_response_cache USING btree (expires_at);


--
-- Name: ai_semantic_cache_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_semantic_cache_embedding_idx ON public.ai_semantic_cache USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: ai_semantic_cache_feature_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_semantic_cache_feature_model_idx ON public.ai_semantic_cache USING btree (feature, model, expires_at);


--
-- Name: ai_usage_events_feature_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_events_feature_tier_idx ON public.ai_usage_events USING btree (feature, tier, created_at DESC);


--
-- Name: ai_usage_events_prompt_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_events_prompt_hash_idx ON public.ai_usage_events USING btree (prompt_hash) WHERE (prompt_hash IS NOT NULL);


--
-- Name: axonometric_cad_qa_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX axonometric_cad_qa_product_idx ON public.axonometric_cad_qa USING btree (product_id, created_at DESC);


--
-- Name: axonometric_cad_qa_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX axonometric_cad_qa_status_idx ON public.axonometric_cad_qa USING btree (status, created_at DESC);


--
-- Name: axonometric_cad_qa_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX axonometric_cad_qa_user_idx ON public.axonometric_cad_qa USING btree (user_id, created_at DESC);


--
-- Name: cad_fit_edit_audit_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cad_fit_edit_audit_batch_id_idx ON public.cad_fit_edit_audit USING btree (batch_id) WHERE (batch_id IS NOT NULL);


--
-- Name: cad_fit_edit_audit_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cad_fit_edit_audit_user_created_idx ON public.cad_fit_edit_audit USING btree (user_id, created_at DESC);


--
-- Name: client_board_items_pending_mobile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_board_items_pending_mobile_idx ON public.client_board_items USING btree (board_id, created_at DESC) WHERE ((saved_via = 'mobile'::text) AND (seen_on_desktop_at IS NULL));


--
-- Name: client_boards_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_boards_source_idx ON public.client_boards USING btree (user_id, source);


--
-- Name: collectible_atelier_gallery_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collectible_atelier_gallery_slug_idx ON public.collectible_atelier_gallery USING btree (slug, "position");


--
-- Name: concierge_leads_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concierge_leads_created_idx ON public.concierge_leads USING btree (created_at DESC);


--
-- Name: concierge_leads_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concierge_leads_score_idx ON public.concierge_leads USING btree (qualified_score DESC);


--
-- Name: concierge_leads_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concierge_leads_session_idx ON public.concierge_leads USING btree (session_id, created_at DESC);


--
-- Name: concierge_roster_embeddings_hnsw_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concierge_roster_embeddings_hnsw_idx ON public.concierge_roster_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: concierge_threads_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concierge_threads_user_active_idx ON public.concierge_threads USING btree (user_id, last_active_at DESC);


--
-- Name: cron_http_call_log_jobname_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cron_http_call_log_jobname_created_idx ON public.cron_http_call_log USING btree (jobname, created_at DESC);


--
-- Name: curated_drops_region_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curated_drops_region_idx ON public.curated_drops USING btree (target_region, is_active, sort_order);


--
-- Name: descriptor_taxonomy_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX descriptor_taxonomy_category_idx ON public.descriptor_taxonomy USING btree (category) WHERE is_active;


--
-- Name: descriptor_taxonomy_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX descriptor_taxonomy_sort_idx ON public.descriptor_taxonomy USING btree (category, sort_order);


--
-- Name: designer_curator_picks_designer_slug_uk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX designer_curator_picks_designer_slug_uk ON public.designer_curator_picks USING btree (designer_id, slug);


--
-- Name: designer_curator_picks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_curator_picks_embedding_idx ON public.designer_curator_picks USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: designer_curator_picks_public_designer_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_curator_picks_public_designer_slug_idx ON public.designer_curator_picks_public USING btree (designer_id, slug);


--
-- Name: designer_curator_picks_style_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_curator_picks_style_tags_idx ON public.designer_curator_picks USING gin (style_tags);


--
-- Name: designer_payouts_designer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_payouts_designer_idx ON public.designer_payouts USING btree (designer_id);


--
-- Name: designer_payouts_line_item_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX designer_payouts_line_item_uniq ON public.designer_payouts USING btree (line_item_id) WHERE (line_item_id IS NOT NULL);


--
-- Name: designer_payouts_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_payouts_order_idx ON public.designer_payouts USING btree (order_id);


--
-- Name: designer_payouts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designer_payouts_status_idx ON public.designer_payouts USING btree (payout_status);


--
-- Name: designer_purchase_orders_ack_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX designer_purchase_orders_ack_token_key ON public.designer_purchase_orders USING btree (ack_token);


--
-- Name: designer_purchase_orders_acknowledgment_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX designer_purchase_orders_acknowledgment_token_key ON public.designer_purchase_orders USING btree (acknowledgment_token);


--
-- Name: designers_country_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designers_country_idx ON public.designers USING btree (country);


--
-- Name: designers_era_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX designers_era_idx ON public.designers USING btree (era);


--
-- Name: dpo_designer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dpo_designer_idx ON public.designer_purchase_orders USING btree (designer_id);


--
-- Name: dpo_order_designer_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX dpo_order_designer_uniq ON public.designer_purchase_orders USING btree (order_id, designer_id);


--
-- Name: dpo_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dpo_order_idx ON public.designer_purchase_orders USING btree (order_id);


--
-- Name: gallery_hotspots_designer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gallery_hotspots_designer_id_idx ON public.gallery_hotspots USING btree (designer_id);


--
-- Name: gallery_hotspots_mapped_pick_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gallery_hotspots_mapped_pick_id_idx ON public.gallery_hotspots USING btree (mapped_pick_id);


--
-- Name: guardrail_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guardrail_logs_created_at_idx ON public.guardrail_logs USING btree (created_at DESC);


--
-- Name: idx_abandoned_carts_status_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_carts_status_activity ON public.abandoned_carts USING btree (status, last_activity_at DESC);


--
-- Name: idx_admin_alert_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_alert_log_created_at ON public.admin_alert_log USING btree (created_at DESC);


--
-- Name: idx_ai_usage_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_events_created_at ON public.ai_usage_events USING btree (created_at DESC);


--
-- Name: idx_ai_usage_events_feature_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_events_feature_created ON public.ai_usage_events USING btree (feature, created_at DESC);


--
-- Name: idx_axo_gallery_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axo_gallery_created_by ON public.axonometric_gallery USING btree (created_by);


--
-- Name: idx_axo_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axo_requests_user_id ON public.axonometric_requests USING btree (user_id);


--
-- Name: idx_axonometric_gallery_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_axonometric_gallery_request_id ON public.axonometric_gallery USING btree (request_id);


--
-- Name: idx_board_recommendations_board_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_board_recommendations_board_id ON public.board_recommendations USING btree (board_id);


--
-- Name: idx_board_recommendations_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_board_recommendations_product_id ON public.board_recommendations USING btree (product_id);


--
-- Name: idx_cad_assets_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_assets_product ON public.trade_product_cad_assets USING btree (product_id);


--
-- Name: idx_cad_assets_product_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_assets_product_variant ON public.trade_product_cad_assets USING btree (product_id, variant_label);


--
-- Name: idx_cad_documents_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_documents_studio ON public.cad_documents USING btree (studio_id);


--
-- Name: idx_cad_documents_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_documents_uploader ON public.cad_documents USING btree (uploaded_by);


--
-- Name: idx_cad_downloads_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_downloads_asset ON public.cad_asset_downloads USING btree (cad_asset_id);


--
-- Name: idx_cad_downloads_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_downloads_user ON public.cad_asset_downloads USING btree (user_id);


--
-- Name: idx_cad_fit_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_fit_doc ON public.cad_fit_reports USING btree (cad_document_id);


--
-- Name: idx_cad_fit_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_fit_product ON public.cad_fit_reports USING btree (product_id);


--
-- Name: idx_cad_geometry_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cad_geometry_product ON public.product_cad_asset_geometry USING btree (product_id);


--
-- Name: idx_cbi_saved_via_unseen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbi_saved_via_unseen ON public.client_board_items USING btree (saved_via, seen_on_desktop_at) WHERE (saved_via = 'mobile'::text);


--
-- Name: idx_client_board_comments_board_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_board_comments_board_id ON public.client_board_comments USING btree (board_id);


--
-- Name: idx_client_board_comments_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_board_comments_item_id ON public.client_board_comments USING btree (item_id);


--
-- Name: idx_client_board_items_board_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_board_items_board_id ON public.client_board_items USING btree (board_id);


--
-- Name: idx_client_board_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_board_items_product_id ON public.client_board_items USING btree (product_id);


--
-- Name: idx_client_boards_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_boards_client_id ON public.client_boards USING btree (client_id);


--
-- Name: idx_client_boards_id_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_boards_id_user ON public.client_boards USING btree (id, user_id);


--
-- Name: idx_client_boards_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_boards_project_id ON public.client_boards USING btree (project_id);


--
-- Name: idx_client_boards_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_boards_studio ON public.client_boards USING btree (studio_id);


--
-- Name: idx_client_boards_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_boards_user_id ON public.client_boards USING btree (user_id);


--
-- Name: idx_client_contacts_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_contacts_client ON public.client_contacts USING btree (client_id);


--
-- Name: idx_client_contacts_one_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_client_contacts_one_primary ON public.client_contacts USING btree (client_id) WHERE (is_primary = true);


--
-- Name: idx_client_documents_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_documents_client ON public.client_documents USING btree (client_id);


--
-- Name: idx_client_documents_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_documents_created_by ON public.client_documents USING btree (created_by);


--
-- Name: idx_client_documents_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_documents_studio ON public.client_documents USING btree (studio_id);


--
-- Name: idx_clients_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_created_by ON public.clients USING btree (created_by);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name ON public.clients USING btree (studio_id, lower(name));


--
-- Name: idx_clients_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_studio ON public.clients USING btree (studio_id);


--
-- Name: idx_cn_director_briefs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_director_briefs_session ON public.cn_director_briefs USING btree (session_id);


--
-- Name: idx_cn_director_briefs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_director_briefs_status ON public.cn_director_briefs USING btree (status);


--
-- Name: idx_cn_director_briefs_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cn_director_briefs_updated ON public.cn_director_briefs USING btree (updated_at DESC);


--
-- Name: idx_collectible_overrides_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collectible_overrides_updated_by ON public.collectible_overrides USING btree (updated_by);


--
-- Name: idx_collector_applications_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collector_applications_reviewed_by ON public.collector_applications USING btree (reviewed_by);


--
-- Name: idx_competitor_designers_gallery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitor_designers_gallery ON public.competitor_designers USING btree (gallery_id);


--
-- Name: idx_competitor_traffic_gallery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitor_traffic_gallery ON public.competitor_traffic USING btree (gallery_id);


--
-- Name: idx_concierge_rag_traces_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rag_traces_created_at ON public.concierge_rag_traces USING btree (created_at DESC);


--
-- Name: idx_concierge_rag_traces_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rag_traces_user_id ON public.concierge_rag_traces USING btree (user_id);


--
-- Name: idx_concierge_rate_limits_reset_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_rate_limits_reset_at ON public.concierge_rate_limits USING btree (reset_at);


--
-- Name: idx_concierge_stream_frames_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_stream_frames_created ON public.concierge_stream_frames USING btree (created_at);


--
-- Name: idx_concierge_stream_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_stream_sessions_created ON public.concierge_stream_sessions USING btree (created_at);


--
-- Name: idx_concierge_stream_sessions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concierge_stream_sessions_user_created ON public.concierge_stream_sessions USING btree (user_id, created_at DESC);


--
-- Name: idx_content_audit_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_audit_record ON public.content_audit_log USING btree (record_id);


--
-- Name: idx_content_audit_table_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_audit_table_time ON public.content_audit_log USING btree (table_name, created_at DESC);


--
-- Name: idx_curator_picks_designer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curator_picks_designer_id ON public.designer_curator_picks USING btree (designer_id);


--
-- Name: idx_currency_rates_base; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currency_rates_base ON public.currency_rates USING btree (base_currency);


--
-- Name: idx_designer_curator_picks_is_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designer_curator_picks_is_hidden ON public.designer_curator_picks USING btree (is_hidden) WHERE (is_hidden = false);


--
-- Name: idx_designer_curator_picks_public_designer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designer_curator_picks_public_designer_id ON public.designer_curator_picks_public USING btree (designer_id);


--
-- Name: idx_designer_heritage_slides_designer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designer_heritage_slides_designer_id ON public.designer_heritage_slides USING btree (designer_id);


--
-- Name: idx_designer_instagram_posts_designer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designer_instagram_posts_designer_id ON public.designer_instagram_posts USING btree (designer_id);


--
-- Name: idx_designers_founder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designers_founder ON public.designers USING btree (founder);


--
-- Name: idx_designers_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designers_is_published ON public.designers USING btree (is_published);


--
-- Name: idx_designers_trade_only; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designers_trade_only ON public.designers USING btree (trade_only) WHERE (trade_only = true);


--
-- Name: idx_document_downloads_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_downloads_country ON public.document_downloads USING btree (country);


--
-- Name: idx_document_downloads_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_downloads_document_id ON public.document_downloads USING btree (document_id);


--
-- Name: idx_document_downloads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_downloads_user_id ON public.document_downloads USING btree (user_id);


--
-- Name: idx_email_click_log_clicked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_click_log_clicked_at ON public.email_click_log USING btree (clicked_at DESC);


--
-- Name: idx_email_click_log_template_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_click_log_template_link ON public.email_click_log USING btree (template_name, link_id, clicked_at DESC);


--
-- Name: idx_email_send_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_created ON public.email_send_log USING btree (created_at DESC);


--
-- Name: idx_email_send_log_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_message ON public.email_send_log USING btree (message_id);


--
-- Name: idx_email_send_log_message_sent_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique ON public.email_send_log USING btree (message_id) WHERE (status = 'sent'::text);


--
-- Name: idx_email_send_log_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_recipient ON public.email_send_log USING btree (recipient_email);


--
-- Name: idx_favorite_folder_items_favorite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_folder_items_favorite_id ON public.favorite_folder_items USING btree (favorite_id);


--
-- Name: idx_favorite_folder_items_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_folder_items_folder ON public.favorite_folder_items USING btree (folder_id);


--
-- Name: idx_favorite_folders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorite_folders_user ON public.favorite_folders USING btree (user_id);


--
-- Name: idx_featured_studios_disciplines; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_studios_disciplines ON public.featured_studios USING gin (disciplines);


--
-- Name: idx_featured_studios_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_studios_owner ON public.featured_studios USING btree (owner_user_id);


--
-- Name: idx_featured_studios_project_types; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_studios_project_types ON public.featured_studios USING gin (project_types);


--
-- Name: idx_featured_studios_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_studios_published ON public.featured_studios USING btree (is_published, sort_order);


--
-- Name: idx_ffe_entitlements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ffe_entitlements_user ON public.ffe_entitlements USING btree (user_id, status);


--
-- Name: idx_funnel_card_payments_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_card_payments_card ON public.funnel_card_payments USING btree (card_id);


--
-- Name: idx_funnel_reminder_log_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_reminder_log_sent ON public.funnel_reminder_log USING btree (sent_at DESC);


--
-- Name: idx_funnel_reminder_pauses_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_reminder_pauses_updated_by ON public.funnel_reminder_pauses USING btree (updated_by);


--
-- Name: idx_gallery_hotspots_image; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gallery_hotspots_image ON public.gallery_hotspots USING btree (image_identifier);


--
-- Name: idx_guide_views_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guide_views_created ON public.guide_views USING btree (created_at DESC);


--
-- Name: idx_guide_views_slug_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guide_views_slug_created ON public.guide_views USING btree (slug, created_at DESC);


--
-- Name: idx_guide_views_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guide_views_user_id ON public.guide_views USING btree (user_id);


--
-- Name: idx_inquiries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_created_at ON public.inquiries USING btree (created_at DESC);


--
-- Name: idx_inquiries_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_email ON public.inquiries USING btree (email);


--
-- Name: idx_inquiries_linked_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_linked_quote_id ON public.inquiries USING btree (linked_quote_id);


--
-- Name: idx_inquiries_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_product_id ON public.inquiries USING btree (product_id);


--
-- Name: idx_inquiries_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_source ON public.inquiries USING btree (source);


--
-- Name: idx_inquiries_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_status_created ON public.inquiries USING btree (status, created_at DESC);


--
-- Name: idx_items_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_po ON public.items USING btree (po_id);


--
-- Name: idx_items_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_quote ON public.items USING btree (quote_id);


--
-- Name: idx_journal_pipeline_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_pipeline_article_id ON public.journal_pipeline USING btree (article_id);


--
-- Name: idx_journal_pipeline_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_pipeline_status ON public.journal_pipeline USING btree (status);


--
-- Name: idx_journal_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_published ON public.journal_articles USING btree (is_published, published_at DESC);


--
-- Name: idx_magazine_badge_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_magazine_badge_events_user_id ON public.magazine_badge_events USING btree (user_id);


--
-- Name: idx_markup_annotations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markup_annotations_user_id ON public.markup_annotations USING btree (user_id);


--
-- Name: idx_mcp_click_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_click_log_created_at ON public.mcp_click_log USING btree (created_at DESC);


--
-- Name: idx_mcp_click_log_pick; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_click_log_pick ON public.mcp_click_log USING btree (pick_id) WHERE (pick_id IS NOT NULL);


--
-- Name: idx_mcp_click_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_click_log_type ON public.mcp_click_log USING btree (click_type, created_at DESC);


--
-- Name: idx_mcp_query_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_query_log_created_at ON public.mcp_query_log USING btree (created_at DESC);


--
-- Name: idx_mcp_query_log_tool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_query_log_tool ON public.mcp_query_log USING btree (tool_name, created_at DESC);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_og_rescrape_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_og_rescrape_runs_created_at ON public.og_rescrape_runs USING btree (created_at DESC);


--
-- Name: idx_order_timeline_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_timeline_project_id ON public.order_timeline USING btree (project_id);


--
-- Name: idx_order_timeline_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_timeline_studio ON public.order_timeline USING btree (studio_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_pop_requires_followup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pop_requires_followup ON public.purchase_orders_payable USING btree (requires_manual_followup) WHERE requires_manual_followup;


--
-- Name: idx_portal_invites_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_invites_created_by ON public.portal_invites USING btree (created_by);


--
-- Name: idx_portal_redemptions_invite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_redemptions_invite_id ON public.portal_redemptions USING btree (invite_id);


--
-- Name: idx_portal_redemptions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_redemptions_session_id ON public.portal_redemptions USING btree (session_id);


--
-- Name: idx_portal_sessions_invite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portal_sessions_invite_id ON public.portal_sessions USING btree (invite_id);


--
-- Name: idx_pos_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_quote ON public.purchase_orders USING btree (quote_id);


--
-- Name: idx_pos_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_supplier ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_pres_comments_presentation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pres_comments_presentation_id ON public.presentation_comments USING btree (presentation_id);


--
-- Name: idx_pres_shares_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pres_shares_user_id ON public.presentation_shares USING btree (shared_with_user_id);


--
-- Name: idx_pres_slides_presentation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pres_slides_presentation_id ON public.presentation_slides USING btree (presentation_id);


--
-- Name: idx_presentation_comments_slide_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presentation_comments_slide_id ON public.presentation_comments USING btree (slide_id);


--
-- Name: idx_presentation_slides_gallery_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presentation_slides_gallery_item_id ON public.presentation_slides USING btree (gallery_item_id);


--
-- Name: idx_projects_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_projects_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_studio ON public.projects USING btree (studio_id);


--
-- Name: idx_projects_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_user_id ON public.projects USING btree (user_id);


--
-- Name: idx_provenance_certificates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provenance_certificates_created_by ON public.provenance_certificates USING btree (created_by);


--
-- Name: idx_provenance_events_cert_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provenance_events_cert_id ON public.provenance_events USING btree (certificate_id);


--
-- Name: idx_public_download_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_download_events_created_at ON public.public_download_events USING btree (created_at DESC);


--
-- Name: idx_public_download_events_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_download_events_document_id ON public.public_download_events USING btree (document_id);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_quote_email_log_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_email_log_quote_id ON public.quote_email_log USING btree (quote_id, created_at DESC);


--
-- Name: idx_quote_payment_links_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_payment_links_created_by ON public.quote_payment_links USING btree (created_by);


--
-- Name: idx_quotes_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_supplier ON public.quotes USING btree (supplier_id);


--
-- Name: idx_rate_brackets_lane; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_brackets_lane ON public.shipping_rate_brackets USING btree (lane_id, valid_from);


--
-- Name: idx_sample_audit_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sample_audit_request_id ON public.sample_request_audit_log USING btree (request_id);


--
-- Name: idx_scrape_configs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scrape_configs_created_by ON public.scrape_configs USING btree (created_by);


--
-- Name: idx_sec_audit_events_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sec_audit_events_time ON public.security_audit_events USING btree (occurred_at DESC);


--
-- Name: idx_sec_audit_events_type_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sec_audit_events_type_time ON public.security_audit_events USING btree (event_type, occurred_at DESC);


--
-- Name: idx_shipping_lanes_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_lanes_lookup ON public.shipping_lanes USING btree (origin_country, dest_country, mode, active);


--
-- Name: idx_shipping_quotes_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_quotes_order ON public.shipping_quotes USING btree (order_timeline_id);


--
-- Name: idx_shipping_quotes_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_quotes_quote ON public.shipping_quotes USING btree (quote_id);


--
-- Name: idx_shipping_quotes_selected_lane_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_quotes_selected_lane_id ON public.shipping_quotes USING btree (selected_lane_id);


--
-- Name: idx_shipping_quotes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_quotes_user ON public.shipping_quotes USING btree (user_id, created_at DESC);


--
-- Name: idx_shipping_surcharges_lane_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_surcharges_lane_id ON public.shipping_surcharges USING btree (lane_id);


--
-- Name: idx_sle_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sle_created ON public.studio_lead_events USING btree (created_at DESC);


--
-- Name: idx_sle_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sle_event_type ON public.studio_lead_events USING btree (event_type);


--
-- Name: idx_sle_studio_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sle_studio_created ON public.studio_lead_events USING btree (studio_id, created_at DESC);


--
-- Name: idx_studio_alerts_unpushed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_alerts_unpushed ON public.studio_alerts USING btree (pushed_at) WHERE (pushed_at IS NULL);


--
-- Name: idx_studio_alerts_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_alerts_user_unread ON public.studio_alerts USING btree (user_id, read_at, created_at DESC);


--
-- Name: idx_studio_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_invites_email ON public.studio_invites USING btree (lower(email));


--
-- Name: idx_studio_invites_studio_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_invites_studio_email ON public.studio_invites USING btree (studio_id, lower(email));


--
-- Name: idx_studio_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_invites_token ON public.studio_invites USING btree (token);


--
-- Name: idx_studio_lead_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_lead_events_user_id ON public.studio_lead_events USING btree (user_id);


--
-- Name: idx_studio_members_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_members_studio ON public.studio_members USING btree (studio_id);


--
-- Name: idx_studio_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_members_user ON public.studio_members USING btree (user_id);


--
-- Name: idx_studio_payout_accounts_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_payout_accounts_created_by ON public.studio_payout_accounts USING btree (created_by);


--
-- Name: idx_studio_payout_accounts_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_payout_accounts_studio ON public.studio_payout_accounts USING btree (studio_id);


--
-- Name: idx_studio_project_overrides_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_project_overrides_user ON public.studio_project_overrides USING btree (user_id);


--
-- Name: idx_studio_resale_certificates_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_resale_certificates_uploaded_by ON public.studio_resale_certificates USING btree (uploaded_by);


--
-- Name: idx_studio_resale_certificates_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_resale_certificates_verified_by ON public.studio_resale_certificates USING btree (verified_by);


--
-- Name: idx_studio_resale_certs_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_resale_certs_state ON public.studio_resale_certificates USING btree (studio_id, state_code);


--
-- Name: idx_studio_resale_certs_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_resale_certs_studio ON public.studio_resale_certificates USING btree (studio_id);


--
-- Name: idx_studio_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_submissions_created_at ON public.studio_submissions USING btree (created_at DESC);


--
-- Name: idx_studio_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_studio_submissions_status ON public.studio_submissions USING btree (status);


--
-- Name: idx_suppressed_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails USING btree (email);


--
-- Name: idx_surcharges_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surcharges_lookup ON public.shipping_surcharges USING btree (surcharge_type, scope, active);


--
-- Name: idx_tcr_activity_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tcr_activity_request ON public.trade_custom_request_activity USING btree (request_id, created_at DESC);


--
-- Name: idx_tcu_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tcu_created ON public.trade_concierge_usage USING btree (created_at DESC);


--
-- Name: idx_tcu_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tcu_user_created ON public.trade_concierge_usage USING btree (user_id, created_at DESC);


--
-- Name: idx_tour_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tour_events_created_at ON public.tour_events USING btree (created_at DESC);


--
-- Name: idx_tour_events_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tour_events_device ON public.tour_events USING btree (device_type);


--
-- Name: idx_tour_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tour_events_type ON public.tour_events USING btree (event_type);


--
-- Name: idx_tour_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tour_events_user ON public.tour_events USING btree (user_id);


--
-- Name: idx_tpglb_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tpglb_product ON public.trade_product_glb_variants USING btree (product_id);


--
-- Name: idx_trade_applications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_applications_user_id ON public.trade_applications USING btree (user_id);


--
-- Name: idx_trade_concierge_actions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_concierge_actions_user ON public.trade_concierge_actions USING btree (user_id, created_at DESC);


--
-- Name: idx_trade_concierge_escalations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_concierge_escalations_status ON public.trade_concierge_escalations USING btree (status, created_at DESC);


--
-- Name: idx_trade_concierge_escalations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_concierge_escalations_user ON public.trade_concierge_escalations USING btree (user_id, created_at DESC);


--
-- Name: idx_trade_credits_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_credits_user_status ON public.trade_credits USING btree (user_id, status);


--
-- Name: idx_trade_custom_requests_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_custom_requests_product_id ON public.trade_custom_requests USING btree (product_id);


--
-- Name: idx_trade_custom_requests_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_custom_requests_project_id ON public.trade_custom_requests USING btree (project_id);


--
-- Name: idx_trade_custom_requests_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_custom_requests_studio ON public.trade_custom_requests USING btree (studio_id);


--
-- Name: idx_trade_custom_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_custom_requests_user ON public.trade_custom_requests USING btree (user_id, created_at DESC);


--
-- Name: idx_trade_fair_events_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_fair_events_dates ON public.trade_fair_events USING btree (starts_on);


--
-- Name: idx_trade_favorites_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_favorites_product_id ON public.trade_favorites USING btree (product_id);


--
-- Name: idx_trade_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_favorites_user_id ON public.trade_favorites USING btree (user_id);


--
-- Name: idx_trade_floor_plan_layouts_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_floor_plan_layouts_plan ON public.trade_floor_plan_layouts USING btree (plan_id);


--
-- Name: idx_trade_floor_plan_layouts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_floor_plan_layouts_user ON public.trade_floor_plan_layouts USING btree (user_id);


--
-- Name: idx_trade_floor_plans_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_floor_plans_user ON public.trade_floor_plans USING btree (user_id);


--
-- Name: idx_trade_product_glb_variants_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_product_glb_variants_created_by ON public.trade_product_glb_variants USING btree (created_by);


--
-- Name: idx_trade_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_products_active ON public.trade_products USING btree (is_active);


--
-- Name: idx_trade_products_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_products_brand ON public.trade_products USING btree (brand_name);


--
-- Name: idx_trade_products_is_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_products_is_hidden ON public.trade_products USING btree (is_hidden) WHERE (is_hidden = false);


--
-- Name: idx_trade_quote_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quote_items_product_id ON public.trade_quote_items USING btree (product_id);


--
-- Name: idx_trade_quote_items_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quote_items_quote_id ON public.trade_quote_items USING btree (quote_id);


--
-- Name: idx_trade_quote_items_quote_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quote_items_quote_room ON public.trade_quote_items USING btree (quote_id, room);


--
-- Name: idx_trade_quote_items_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quote_items_supplier_id ON public.trade_quote_items USING btree (supplier_id);


--
-- Name: idx_trade_quotes_billing_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_billing_mode ON public.trade_quotes USING btree (billing_mode);


--
-- Name: idx_trade_quotes_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_client_id ON public.trade_quotes USING btree (client_id);


--
-- Name: idx_trade_quotes_designer_payout_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_designer_payout_account_id ON public.trade_quotes USING btree (designer_payout_account_id);


--
-- Name: idx_trade_quotes_id_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_id_user ON public.trade_quotes USING btree (id, user_id);


--
-- Name: idx_trade_quotes_managed_freight; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_managed_freight ON public.trade_quotes USING btree (managed_freight_quote_id);


--
-- Name: idx_trade_quotes_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_project_id ON public.trade_quotes USING btree (project_id);


--
-- Name: idx_trade_quotes_resale_certificate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_resale_certificate_id ON public.trade_quotes USING btree (resale_certificate_id);


--
-- Name: idx_trade_quotes_source_inquiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_source_inquiry ON public.trade_quotes USING btree (source_inquiry_id);


--
-- Name: idx_trade_quotes_studio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_studio ON public.trade_quotes USING btree (studio_id);


--
-- Name: idx_trade_quotes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_quotes_user_id ON public.trade_quotes USING btree (user_id);


--
-- Name: idx_trade_recent_views_user_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_recent_views_user_entity ON public.trade_recent_views USING btree (user_id, entity_type, entity_id);


--
-- Name: idx_trade_recent_views_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_recent_views_user_time ON public.trade_recent_views USING btree (user_id, viewed_at DESC);


--
-- Name: idx_trade_sample_requests_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_sample_requests_product_id ON public.trade_sample_requests USING btree (product_id);


--
-- Name: idx_trade_sample_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trade_sample_requests_user_id ON public.trade_sample_requests USING btree (user_id);


--
-- Name: idx_unsubscribe_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens USING btree (token);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_verification_audit_log_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_audit_log_application ON public.verification_audit_log USING btree (application_id, created_at);


--
-- Name: idx_verification_feedback_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_feedback_created ON public.verification_feedback_loops USING btree (created_at DESC);


--
-- Name: idx_video_watch_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_watch_events_created_at ON public.video_watch_events USING btree (created_at);


--
-- Name: idx_video_watch_events_video_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_watch_events_video_id ON public.video_watch_events USING btree (video_id);


--
-- Name: idx_webhook_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_pending ON public.webhook_events USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: idx_webhook_events_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_status_created ON public.webhook_events USING btree (status, created_at DESC);


--
-- Name: idx_whatsapp_delivery_events_sid_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_delivery_events_sid_created ON public.whatsapp_delivery_events USING btree (message_sid, created_at DESC);


--
-- Name: ingestion_queue_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ingestion_queue_status_idx ON public.ingestion_queue USING btree (status, created_at);


--
-- Name: journal_articles_one_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX journal_articles_one_featured_idx ON public.journal_articles USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: magazine_badge_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX magazine_badge_events_created_idx ON public.magazine_badge_events USING btree (created_at DESC);


--
-- Name: magazine_badge_events_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX magazine_badge_events_doc_idx ON public.magazine_badge_events USING btree (document_id);


--
-- Name: magazine_badge_events_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX magazine_badge_events_type_idx ON public.magazine_badge_events USING btree (event_type);


--
-- Name: material_taxonomy_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_taxonomy_family_idx ON public.material_taxonomy USING btree (family) WHERE is_active;


--
-- Name: pop_designer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pop_designer_idx ON public.purchase_orders_payable USING btree (designer_id);


--
-- Name: pop_line_item_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pop_line_item_uniq ON public.purchase_orders_payable USING btree (line_item_id);


--
-- Name: pop_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pop_order_idx ON public.purchase_orders_payable USING btree (order_id);


--
-- Name: pop_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pop_status_idx ON public.purchase_orders_payable USING btree (designer_invoice_status);


--
-- Name: product_descriptor_links_descriptor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_descriptor_links_descriptor_idx ON public.product_descriptor_links USING btree (descriptor_id);


--
-- Name: product_descriptor_links_pick_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_descriptor_links_pick_unique ON public.product_descriptor_links USING btree (pick_id, descriptor_id) WHERE (pick_id IS NOT NULL);


--
-- Name: product_descriptor_links_product_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_descriptor_links_product_unique ON public.product_descriptor_links USING btree (product_id, descriptor_id) WHERE (product_id IS NOT NULL);


--
-- Name: product_fabrics_fabric_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_fabrics_fabric_idx ON public.product_fabrics USING btree (fabric_id);


--
-- Name: product_fabrics_label_fabric_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_fabrics_label_fabric_uq ON public.product_fabrics USING btree (product_label, fabric_id) WHERE (product_label IS NOT NULL);


--
-- Name: product_fabrics_pick_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_fabrics_pick_idx ON public.product_fabrics USING btree (pick_id);


--
-- Name: product_material_links_material_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_material_links_material_idx ON public.product_material_links USING btree (material_id);


--
-- Name: product_material_links_pick_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_material_links_pick_idx ON public.product_material_links USING btree (pick_id) WHERE (pick_id IS NOT NULL);


--
-- Name: product_material_links_pick_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_material_links_pick_unique ON public.product_material_links USING btree (pick_id, material_id, role) WHERE (pick_id IS NOT NULL);


--
-- Name: product_material_links_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_material_links_product_idx ON public.product_material_links USING btree (product_id) WHERE (product_id IS NOT NULL);


--
-- Name: product_material_links_product_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_material_links_product_unique ON public.product_material_links USING btree (product_id, material_id, role) WHERE (product_id IS NOT NULL);


--
-- Name: quote_payment_links_quote_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_payment_links_quote_id_idx ON public.quote_payment_links USING btree (quote_id);


--
-- Name: regional_logistics_rules_city_hood_uk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX regional_logistics_rules_city_hood_uk ON public.regional_logistics_rules USING btree (lower(city), lower(COALESCE(neighborhood, ''::text)));


--
-- Name: shop_order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_order_items_order_idx ON public.shop_order_items USING btree (order_id);


--
-- Name: shop_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_orders_status_idx ON public.shop_orders USING btree (status, created_at DESC);


--
-- Name: shop_orders_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shop_orders_user_idx ON public.shop_orders USING btree (user_id);


--
-- Name: suppliers_name_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suppliers_name_unique_idx ON public.suppliers USING btree (lower(supplier_name));


--
-- Name: trade_applications_edit_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trade_applications_edit_token_hash_key ON public.trade_applications USING btree (edit_token_hash) WHERE (edit_token_hash IS NOT NULL);


--
-- Name: trade_documents_featured_public_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_documents_featured_public_recent ON public.trade_documents USING btree (created_at DESC) WHERE (is_featured_public = true);


--
-- Name: trade_documents_one_featured_public; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trade_documents_one_featured_public ON public.trade_documents USING btree ((true)) WHERE (is_featured_public = true);


--
-- Name: trade_products_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_products_embedding_idx ON public.trade_products USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: trade_products_embedding_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_products_embedding_visible_idx ON public.trade_products USING hnsw (embedding public.vector_cosine_ops) WITH (m='16', ef_construction='64') WHERE ((is_active = true) AND (is_hidden = false));


--
-- Name: trade_products_lead_time_weeks_max_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_products_lead_time_weeks_max_idx ON public.trade_products USING btree (lead_time_weeks_max) WHERE (lead_time_weeks_max IS NOT NULL);


--
-- Name: trade_products_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trade_products_sku_key ON public.trade_products USING btree (sku) WHERE ((sku IS NOT NULL) AND (sku <> ''::text));


--
-- Name: trade_products_source_pick_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_products_source_pick_id_idx ON public.trade_products USING btree (source_pick_id);


--
-- Name: trade_products_style_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_products_style_tags_idx ON public.trade_products USING gin (style_tags);


--
-- Name: trade_program_signups_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trade_program_signups_email_key ON public.trade_program_signups USING btree (lower(email));


--
-- Name: trade_quote_extras_quote_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_extras_quote_id_idx ON public.trade_quote_extras USING btree (quote_id);


--
-- Name: trade_quote_items_expected_ready_override_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_items_expected_ready_override_idx ON public.trade_quote_items USING btree (expected_ready_override);


--
-- Name: trade_quote_items_fabric_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_items_fabric_idx ON public.trade_quote_items USING btree (fabric_id);


--
-- Name: trade_quote_items_po_payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_items_po_payment_status_idx ON public.trade_quote_items USING btree (po_payment_status);


--
-- Name: trade_quote_items_po_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_items_po_status_idx ON public.trade_quote_items USING btree (po_status);


--
-- Name: trade_quote_items_wood_fabric_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_quote_items_wood_fabric_id_idx ON public.trade_quote_items USING btree (wood_fabric_id);


--
-- Name: trade_quotes_client_pdf_download_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trade_quotes_client_pdf_download_token_key ON public.trade_quotes USING btree (client_pdf_download_token);


--
-- Name: uniq_tpglb_default_per_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_tpglb_default_per_product ON public.trade_product_glb_variants USING btree (product_id) WHERE (is_default = true);


--
-- Name: uq_studio_payout_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_studio_payout_default ON public.studio_payout_accounts USING btree (studio_id) WHERE (is_default = true);


--
-- Name: verification_feedback_loops_app_decision_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX verification_feedback_loops_app_decision_key ON public.verification_feedback_loops USING btree (application_id, admin_decision) WHERE (application_id IS NOT NULL);


--
-- Name: webhook_events_provider_event_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX webhook_events_provider_event_id_key ON public.webhook_events USING btree (provider, event_id);


--
-- Name: studios add_studio_creator_member_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER add_studio_creator_member_trigger AFTER INSERT ON public.studios FOR EACH ROW EXECUTE FUNCTION public.add_studio_creator_member();


--
-- Name: profiles auto_accept_studio_invites_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_accept_studio_invites_trigger AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_accept_studio_invites();


--
-- Name: collectible_overrides collectible_overrides_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collectible_overrides_set_updated_at BEFORE UPDATE ON public.collectible_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: concierge_leads concierge_leads_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER concierge_leads_set_updated_at BEFORE UPDATE ON public.concierge_leads FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: descriptor_taxonomy descriptor_taxonomy_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER descriptor_taxonomy_set_updated_at BEFORE UPDATE ON public.descriptor_taxonomy FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: fabrics fabrics_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fabrics_set_updated_at BEFORE UPDATE ON public.fabrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: axonometric_requests guard_axonometric_request_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_axonometric_request_status BEFORE INSERT OR UPDATE ON public.axonometric_requests FOR EACH ROW EXECUTE FUNCTION public.tg_guard_axonometric_request_status();


--
-- Name: trade_custom_requests guard_custom_request_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_custom_request_status BEFORE INSERT OR UPDATE ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.tg_guard_custom_request_status();


--
-- Name: profiles guard_profile_tier_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_profile_tier_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_tier_columns();


--
-- Name: profiles guard_profile_tier_columns_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_profile_tier_columns_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_tier_columns();


--
-- Name: trade_quote_items guard_quote_item_pricing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_quote_item_pricing BEFORE INSERT OR UPDATE ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_item_pricing();


--
-- Name: trade_quotes guard_quote_pricing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_quote_pricing BEFORE INSERT OR UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_pricing();


--
-- Name: trade_quotes guard_quote_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_quote_status BEFORE INSERT OR UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.tg_guard_quote_status();


--
-- Name: trade_applications guard_trade_application_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_trade_application_status BEFORE INSERT OR UPDATE ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.tg_guard_trade_application_status();


--
-- Name: ingestion_job_state ingestion_job_state_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ingestion_job_state_set_updated_at BEFORE UPDATE ON public.ingestion_job_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ingestion_queue ingestion_queue_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ingestion_queue_set_updated_at BEFORE UPDATE ON public.ingestion_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: items items_recalc_financials_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER items_recalc_financials_trg BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.items_recalc_financials();


--
-- Name: material_taxonomy material_taxonomy_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER material_taxonomy_set_updated_at BEFORE UPDATE ON public.material_taxonomy FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: orders notify_admins_new_order_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notify_admins_new_order_trigger AFTER INSERT ON public.orders FOR EACH ROW WHEN ((lower(new.status) = ANY (ARRAY['completed'::text, 'paid'::text]))) EXECUTE FUNCTION public.notify_admins_new_order();


--
-- Name: profiles on_new_profile_notify_admins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_profile_notify_admins AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_registration();


--
-- Name: order_timeline order_timeline_delivery_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_timeline_delivery_escalation AFTER UPDATE OF estimated_delivery_at, actual_delivery_at, deposit_paid_at, shipping_weeks ON public.order_timeline FOR EACH ROW EXECUTE FUNCTION public.trg_order_timeline_delivery_escalation();


--
-- Name: order_timeline order_timeline_guard_ship_to_pii; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_timeline_guard_ship_to_pii BEFORE UPDATE ON public.order_timeline FOR EACH ROW EXECUTE FUNCTION public.tg_order_timeline_guard_ship_to_pii();


--
-- Name: product_descriptor_links product_descriptor_links_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_descriptor_links_set_updated_at BEFORE UPDATE ON public.product_descriptor_links FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: product_material_links product_material_links_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_material_links_set_updated_at BEFORE UPDATE ON public.product_material_links FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: concierge_leads rate_limit_concierge_leads; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_concierge_leads BEFORE INSERT ON public.concierge_leads FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('20');


--
-- Name: magazine_badge_events rate_limit_magazine_badge_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_magazine_badge_events BEFORE INSERT ON public.magazine_badge_events FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: mcp_click_log rate_limit_mcp_click_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_mcp_click_log BEFORE INSERT ON public.mcp_click_log FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: mcp_query_log rate_limit_mcp_query_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_mcp_query_log BEFORE INSERT ON public.mcp_query_log FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: studio_lead_events rate_limit_studio_lead_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_studio_lead_events BEFORE INSERT ON public.studio_lead_events FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: tour_events rate_limit_tour_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_tour_events BEFORE INSERT ON public.tour_events FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: video_watch_events rate_limit_video_watch_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rate_limit_video_watch_events BEFORE INSERT ON public.video_watch_events FOR EACH ROW EXECUTE FUNCTION public.enforce_analytics_rate_limit('120');


--
-- Name: fabrics refresh_product_fabric_swatches_public_from_fabrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refresh_product_fabric_swatches_public_from_fabrics AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.fabrics FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();


--
-- Name: product_fabrics refresh_product_fabric_swatches_public_from_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refresh_product_fabric_swatches_public_from_links AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.product_fabrics FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_product_fabric_swatches_public();


--
-- Name: order_timeline_commission set_updated_at_on_commission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_on_commission BEFORE UPDATE ON public.order_timeline_commission FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shop_orders shop_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shop_orders_updated_at BEFORE UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: studios studios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER studios_updated_at BEFORE UPDATE ON public.studios FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: trade_products sync_sitemap_product_on_trade_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_sitemap_product_on_trade_products AFTER INSERT OR DELETE OR UPDATE OF is_active, is_hidden, updated_at ON public.trade_products FOR EACH ROW EXECUTE FUNCTION public.sync_sitemap_product();


--
-- Name: favorite_folders tg_favorite_folders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_favorite_folders_updated BEFORE UPDATE ON public.favorite_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects tg_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: trade_product_pricing tg_trade_product_pricing_mirror; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_trade_product_pricing_mirror AFTER INSERT OR UPDATE ON public.trade_product_pricing FOR EACH ROW EXECUTE FUNCTION public.tg_mirror_pricing_to_pick();


--
-- Name: trade_product_pricing tg_trade_product_pricing_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_trade_product_pricing_updated_at BEFORE UPDATE ON public.trade_product_pricing FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: projects tr_apply_regional_trade_multipliers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_apply_regional_trade_multipliers BEFORE INSERT OR UPDATE OF location_city, location_neighborhood ON public.projects FOR EACH ROW EXECUTE FUNCTION public.apply_regional_trade_multipliers();


--
-- Name: trade_custom_requests trade_custom_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_custom_requests_set_updated_at BEFORE UPDATE ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: trade_fair_events trade_fair_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_fair_events_set_updated_at BEFORE UPDATE ON public.trade_fair_events FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: trade_program_signups trade_program_signups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_program_signups_updated_at BEFORE UPDATE ON public.trade_program_signups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trade_quote_extras trade_quote_extras_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_quote_extras_set_updated_at BEFORE UPDATE ON public.trade_quote_extras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trade_quote_items trade_quote_item_delivery_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_quote_item_delivery_escalation AFTER UPDATE OF required_by_date, lead_time_weeks_override ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.trg_quote_item_delivery_escalation();


--
-- Name: trade_quote_items trade_quote_items_client_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_quote_items_client_tier AFTER INSERT OR DELETE OR UPDATE ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_client_tier_items();


--
-- Name: trade_quotes trade_quotes_client_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_quotes_client_tier AFTER INSERT OR DELETE OR UPDATE OF status, confirmed_at, client_id ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_client_tier();


--
-- Name: trade_user_memory trade_user_memory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trade_user_memory_updated_at BEFORE UPDATE ON public.trade_user_memory FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: designer_curator_picks trg_audit_curator_picks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_curator_picks AFTER INSERT OR DELETE OR UPDATE ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.log_curator_picks_change();


--
-- Name: designers trg_audit_designers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_designers AFTER INSERT OR DELETE OR UPDATE ON public.designers FOR EACH ROW EXECUTE FUNCTION public.log_designers_change();


--
-- Name: trade_documents trg_audit_trade_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_trade_documents AFTER INSERT OR DELETE OR UPDATE ON public.trade_documents FOR EACH ROW EXECUTE FUNCTION public.log_trade_documents_change();


--
-- Name: brand_lead_times trg_brand_lead_times_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_lead_times_updated_at BEFORE UPDATE ON public.brand_lead_times FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: concierge_leads trg_bridge_concierge_lead_to_inquiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bridge_concierge_lead_to_inquiry AFTER INSERT OR UPDATE OF qualified_score, signals ON public.concierge_leads FOR EACH ROW EXECUTE FUNCTION public.bridge_concierge_lead_to_inquiry();


--
-- Name: trade_product_cad_assets trg_cad_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cad_assets_updated_at BEFORE UPDATE ON public.trade_product_cad_assets FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: cad_documents trg_cad_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cad_documents_updated_at BEFORE UPDATE ON public.cad_documents FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: product_cad_asset_geometry trg_cad_geometry_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cad_geometry_updated_at BEFORE UPDATE ON public.product_cad_asset_geometry FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: client_contacts trg_client_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_documents trg_client_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_client_documents_updated_at BEFORE UPDATE ON public.client_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients trg_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cn_director_briefs trg_cn_director_briefs_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cn_director_briefs_validate BEFORE INSERT OR UPDATE ON public.cn_director_briefs FOR EACH ROW EXECUTE FUNCTION public.cn_director_briefs_validate_status();


--
-- Name: collectible_atelier_gallery trg_collectible_atelier_gallery_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collectible_atelier_gallery_updated_at BEFORE UPDATE ON public.collectible_atelier_gallery FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: collectible_atelier_overrides trg_collectible_atelier_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collectible_atelier_overrides_updated_at BEFORE UPDATE ON public.collectible_atelier_overrides FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: collector_applications trg_collector_apps_grant_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collector_apps_grant_role BEFORE UPDATE ON public.collector_applications FOR EACH ROW EXECUTE FUNCTION public.grant_collector_role_on_approve();


--
-- Name: collector_applications trg_collector_apps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_collector_apps_updated_at BEFORE UPDATE ON public.collector_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trade_concierge_escalations trg_concierge_escalations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_concierge_escalations_updated BEFORE UPDATE ON public.trade_concierge_escalations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: designer_curator_picks trg_deactivate_orphaned_trade_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_deactivate_orphaned_trade_product BEFORE DELETE ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.deactivate_orphaned_trade_product();


--
-- Name: shipping_duty_rates trg_duty_rates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_duty_rates_updated BEFORE UPDATE ON public.shipping_duty_rates FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: concierge_leads trg_enforce_concierge_lead_rate_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_concierge_lead_rate_limit BEFORE INSERT ON public.concierge_leads FOR EACH ROW EXECUTE FUNCTION public.enforce_concierge_lead_rate_limit();


--
-- Name: trade_products trg_fanout_supply_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fanout_supply_change AFTER UPDATE ON public.trade_products FOR EACH ROW EXECUTE FUNCTION public.fanout_supply_change();


--
-- Name: gallery_hotspots trg_gallery_hotspots_resolve_designer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gallery_hotspots_resolve_designer BEFORE INSERT OR UPDATE OF designer_name ON public.gallery_hotspots FOR EACH ROW EXECUTE FUNCTION public.gallery_hotspots_resolve_designer();


--
-- Name: shop_orders trg_guard_shop_order_buyer_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_shop_order_buyer_update BEFORE UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.guard_shop_order_buyer_update();


--
-- Name: trade_custom_requests trg_log_custom_request_activity_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_custom_request_activity_ins AFTER INSERT ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.log_custom_request_activity();


--
-- Name: trade_custom_requests trg_log_custom_request_activity_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_custom_request_activity_upd AFTER UPDATE ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.log_custom_request_activity();


--
-- Name: trade_custom_requests trg_notify_admins_custom_request_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_custom_request_ins AFTER INSERT ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admins_custom_request();


--
-- Name: trade_custom_requests trg_notify_admins_custom_request_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admins_custom_request_upd AFTER UPDATE ON public.trade_custom_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admins_custom_request();


--
-- Name: onboarding_flow_config trg_onboarding_flow_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_flow_config_updated_at BEFORE UPDATE ON public.onboarding_flow_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_tour_steps trg_onboarding_tour_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_tour_steps_updated_at BEFORE UPDATE ON public.onboarding_tour_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: portal_invites trg_portal_invites_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_portal_invites_updated BEFORE UPDATE ON public.portal_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles trg_prevent_profile_tier_self_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_profile_tier_self_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tier_self_escalation();


--
-- Name: profiles trg_prevent_profile_tier_self_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_profile_tier_self_insert BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tier_self_update();


--
-- Name: profiles trg_prevent_profile_tier_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_profile_tier_self_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tier_self_update();


--
-- Name: trade_quote_items trg_prevent_quote_item_price_self_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_quote_item_price_self_insert BEFORE INSERT ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_item_price_self_update();


--
-- Name: trade_quote_items trg_prevent_quote_item_price_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_quote_item_price_self_update BEFORE UPDATE ON public.trade_quote_items FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_item_price_self_update();


--
-- Name: trade_quotes trg_prevent_quote_pricing_self_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_quote_pricing_self_insert BEFORE INSERT ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_pricing_self_update();


--
-- Name: trade_quotes trg_prevent_quote_pricing_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_quote_pricing_self_update BEFORE UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.prevent_quote_pricing_self_update();


--
-- Name: trade_applications trg_protect_trade_application_privileged_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_trade_application_privileged_fields BEFORE UPDATE ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.protect_trade_application_privileged_fields();


--
-- Name: shipping_rate_brackets trg_rate_brackets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rate_brackets_updated BEFORE UPDATE ON public.shipping_rate_brackets FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: designer_curator_picks trg_route_cc_tapis_pick; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_route_cc_tapis_pick BEFORE INSERT OR UPDATE OF title, subtitle, designer_id ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.route_cc_tapis_pick_to_collab();


--
-- Name: trade_sample_requests trg_sample_request_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sample_request_audit BEFORE UPDATE ON public.trade_sample_requests FOR EACH ROW EXECUTE FUNCTION public.log_sample_request_status_change();


--
-- Name: designer_curator_picks trg_set_curator_pick_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_curator_pick_slug BEFORE INSERT OR UPDATE OF title, subtitle, slug ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.set_curator_pick_slug();


--
-- Name: trade_applications trg_set_region_tier; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_region_tier BEFORE INSERT OR UPDATE OF country ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.set_region_tier_from_country();


--
-- Name: shipping_lanes trg_shipping_lanes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipping_lanes_updated BEFORE UPDATE ON public.shipping_lanes FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: shipping_quotes trg_shipping_quotes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipping_quotes_updated BEFORE UPDATE ON public.shipping_quotes FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: studio_payout_accounts trg_studio_payout_accounts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_studio_payout_accounts_updated BEFORE UPDATE ON public.studio_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: studio_resale_certificates trg_studio_resale_certificates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_studio_resale_certificates_updated BEFORE UPDATE ON public.studio_resale_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: studio_submissions trg_studio_submissions_rate_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_studio_submissions_rate_limit BEFORE INSERT ON public.studio_submissions FOR EACH ROW EXECUTE FUNCTION public.tg_studio_submissions_rate_limit();


--
-- Name: shipping_surcharges trg_surcharges_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_surcharges_updated BEFORE UPDATE ON public.shipping_surcharges FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();


--
-- Name: designer_curator_picks trg_sync_curator_pick_to_trade_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_curator_pick_to_trade_product AFTER INSERT OR UPDATE OF title, subtitle, designer_id, category, subcategory, materials, dimensions, description, meta_description, pdf_url, pdf_urls, currency, lead_time, price_prefix, gallery_images, origin, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, is_hidden, trade_price_cents, price_per_sqm_cents, pack_cbm, pack_weight_kg, pack_carton_count, default_ship_mode, pickup_country, pickup_postcode, pickup_address, hs_code, is_upholstered, wood_label_override, image_url, hover_image_url, width_mm, depth_mm, height_mm, seat_height_mm, is_contract_grade ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.sync_curator_pick_to_trade_product();


--
-- Name: designer_curator_picks trg_sync_designer_curator_picks_public; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_designer_curator_picks_public AFTER INSERT OR DELETE OR UPDATE OF title, subtitle, designer_id, category, subcategory, tags, materials, dimensions, description, edition, photo_credit, pdf_url, pdf_filename, pdf_urls, sort_order, currency, lead_time, price_prefix, gallery_images, origin, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, is_hidden, edition_number, edition_signing, default_ship_mode, materials_description, gallery_captions, is_upholstered, wood_label_override, image_url, hover_image_url, allow_com_col, slug ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.sync_designer_curator_picks_public();


--
-- Name: featured_studios trg_sync_featured_studios_public; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_featured_studios_public AFTER INSERT OR DELETE OR UPDATE ON public.featured_studios FOR EACH ROW EXECUTE FUNCTION public.sync_featured_studios_public();


--
-- Name: inquiries trg_sync_inquiry_to_directory; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_inquiry_to_directory AFTER INSERT ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.sync_inquiry_to_admin_directory();


--
-- Name: designer_curator_picks trg_sync_pick_crate_specs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_pick_crate_specs AFTER INSERT OR UPDATE OF crate_specs, hs_code_rules ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.sync_pick_crate_specs();


--
-- Name: trade_applications trg_sync_trade_access; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_trade_access BEFORE INSERT OR UPDATE OF status ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.sync_trade_access_on_status();


--
-- Name: trade_applications trg_sync_trade_app_to_directory; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_trade_app_to_directory AFTER INSERT OR UPDATE OF status ON public.trade_applications FOR EACH ROW EXECUTE FUNCTION public.sync_trade_application_to_admin_directory();


--
-- Name: trade_product_glb_variants trg_tpglb_sync_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tpglb_sync_default AFTER INSERT OR DELETE OR UPDATE ON public.trade_product_glb_variants FOR EACH ROW EXECUTE FUNCTION public.sync_trade_product_default_glb();


--
-- Name: trade_product_glb_variants trg_tpglb_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tpglb_updated_at BEFORE UPDATE ON public.trade_product_glb_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trade_floor_plan_layouts trg_trade_floor_plan_layouts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trade_floor_plan_layouts_updated BEFORE UPDATE ON public.trade_floor_plan_layouts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: trade_floor_plans trg_trade_floor_plans_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trade_floor_plans_updated BEFORE UPDATE ON public.trade_floor_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: trade_quotes trg_validate_trade_quote_billing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_trade_quote_billing BEFORE INSERT OR UPDATE ON public.trade_quotes FOR EACH ROW EXECUTE FUNCTION public.tg_validate_trade_quote_billing();


--
-- Name: webhook_events trg_webhook_queue_wake; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_webhook_queue_wake AFTER INSERT ON public.webhook_events FOR EACH STATEMENT EXECUTE FUNCTION public.webhook_queue_wake();


--
-- Name: designer_curator_picks trim_meta_description_curator; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trim_meta_description_curator BEFORE INSERT OR UPDATE OF meta_description ON public.designer_curator_picks FOR EACH ROW EXECUTE FUNCTION public.trim_meta_description();


--
-- Name: trade_products trim_meta_description_trade; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trim_meta_description_trade BEFORE INSERT OR UPDATE OF meta_description ON public.trade_products FOR EACH ROW EXECUTE FUNCTION public.trim_meta_description();


--
-- Name: ai_model_pricing update_ai_model_pricing_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_model_pricing_updated_at BEFORE UPDATE ON public.ai_model_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: concierge_roster_embeddings update_concierge_roster_embeddings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_concierge_roster_embeddings_updated_at BEFORE UPDATE ON public.concierge_roster_embeddings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: concierge_sessions update_concierge_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_concierge_sessions_updated_at BEFORE UPDATE ON public.concierge_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: concierge_threads update_concierge_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_concierge_threads_updated_at BEFORE UPDATE ON public.concierge_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: curated_drops update_curated_drops_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_curated_drops_updated_at BEFORE UPDATE ON public.curated_drops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_inquiries update_custom_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_inquiries_updated_at BEFORE UPDATE ON public.custom_inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: featured_studios update_featured_studios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_featured_studios_updated_at BEFORE UPDATE ON public.featured_studios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inquiries update_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: push_subscriptions update_push_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: regional_logistics_tiers update_regional_logistics_tiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_regional_logistics_tiers_updated_at BEFORE UPDATE ON public.regional_logistics_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: studio_alerts update_studio_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_studio_alerts_updated_at BEFORE UPDATE ON public.studio_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: studio_submissions update_studio_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_studio_submissions_updated_at BEFORE UPDATE ON public.studio_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: verification_feedback_loops update_verification_feedback_loops_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_verification_feedback_loops_updated_at BEFORE UPDATE ON public.verification_feedback_loops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: axonometric_gallery axonometric_gallery_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.axonometric_gallery
    ADD CONSTRAINT axonometric_gallery_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.axonometric_requests(id) ON DELETE SET NULL;


--
-- Name: board_recommendations board_recommendations_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_recommendations
    ADD CONSTRAINT board_recommendations_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.client_boards(id) ON DELETE CASCADE;


--
-- Name: board_recommendations board_recommendations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_recommendations
    ADD CONSTRAINT board_recommendations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;


--
-- Name: brief_drafts brief_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brief_drafts
    ADD CONSTRAINT brief_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cad_documents cad_documents_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_documents
    ADD CONSTRAINT cad_documents_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: cad_fit_reports cad_fit_reports_cad_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cad_fit_reports
    ADD CONSTRAINT cad_fit_reports_cad_document_id_fkey FOREIGN KEY (cad_document_id) REFERENCES public.cad_documents(id) ON DELETE CASCADE;


--
-- Name: client_board_comments client_board_comments_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_comments
    ADD CONSTRAINT client_board_comments_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.client_boards(id) ON DELETE CASCADE;


--
-- Name: client_board_comments client_board_comments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_comments
    ADD CONSTRAINT client_board_comments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.client_board_items(id) ON DELETE CASCADE;


--
-- Name: client_board_items client_board_items_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_items
    ADD CONSTRAINT client_board_items_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.client_boards(id) ON DELETE CASCADE;


--
-- Name: client_board_items client_board_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_board_items
    ADD CONSTRAINT client_board_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: client_boards client_boards_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: client_boards client_boards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: client_boards client_boards_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: client_boards client_boards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_boards
    ADD CONSTRAINT client_boards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: client_contacts client_contacts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_documents client_documents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_documents
    ADD CONSTRAINT client_documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_documents client_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_documents
    ADD CONSTRAINT client_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: client_documents client_documents_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_documents
    ADD CONSTRAINT client_documents_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: clients clients_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: cn_director_briefs cn_director_briefs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cn_director_briefs
    ADD CONSTRAINT cn_director_briefs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.portal_sessions(id) ON DELETE SET NULL;


--
-- Name: collectible_overrides collectible_overrides_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collectible_overrides
    ADD CONSTRAINT collectible_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: collector_applications collector_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_applications
    ADD CONSTRAINT collector_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: collector_applications collector_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collector_applications
    ADD CONSTRAINT collector_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: competitor_designers competitor_designers_gallery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_designers
    ADD CONSTRAINT competitor_designers_gallery_id_fkey FOREIGN KEY (gallery_id) REFERENCES public.competitor_galleries(id) ON DELETE CASCADE;


--
-- Name: competitor_traffic competitor_traffic_gallery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_traffic
    ADD CONSTRAINT competitor_traffic_gallery_id_fkey FOREIGN KEY (gallery_id) REFERENCES public.competitor_galleries(id) ON DELETE CASCADE;


--
-- Name: concierge_rag_traces concierge_rag_traces_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_rag_traces
    ADD CONSTRAINT concierge_rag_traces_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: concierge_sessions concierge_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_sessions
    ADD CONSTRAINT concierge_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: concierge_stream_frames concierge_stream_frames_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_stream_frames
    ADD CONSTRAINT concierge_stream_frames_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.concierge_stream_sessions(stream_id) ON DELETE CASCADE;


--
-- Name: concierge_threads concierge_threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concierge_threads
    ADD CONSTRAINT concierge_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cpd_attendance cpd_attendance_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpd_attendance
    ADD CONSTRAINT cpd_attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.cpd_events(id) ON DELETE CASCADE;


--
-- Name: designer_curator_picks designer_curator_picks_designer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_curator_picks
    ADD CONSTRAINT designer_curator_picks_designer_id_fkey FOREIGN KEY (designer_id) REFERENCES public.designers(id) ON DELETE CASCADE;


--
-- Name: designer_heritage_slides designer_heritage_slides_designer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_heritage_slides
    ADD CONSTRAINT designer_heritage_slides_designer_id_fkey FOREIGN KEY (designer_id) REFERENCES public.designers(id) ON DELETE CASCADE;


--
-- Name: designer_instagram_posts designer_instagram_posts_designer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designer_instagram_posts
    ADD CONSTRAINT designer_instagram_posts_designer_id_fkey FOREIGN KEY (designer_id) REFERENCES public.designers(id) ON DELETE CASCADE;


--
-- Name: document_downloads document_downloads_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_downloads
    ADD CONSTRAINT document_downloads_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.trade_documents(id) ON DELETE CASCADE;


--
-- Name: document_downloads document_downloads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_downloads
    ADD CONSTRAINT document_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: favorite_folder_items favorite_folder_items_favorite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_folder_items
    ADD CONSTRAINT favorite_folder_items_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES public.trade_favorites(id) ON DELETE CASCADE;


--
-- Name: favorite_folder_items favorite_folder_items_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorite_folder_items
    ADD CONSTRAINT favorite_folder_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.favorite_folders(id) ON DELETE CASCADE;


--
-- Name: featured_studios featured_studios_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_studios
    ADD CONSTRAINT featured_studios_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: funnel_reminder_pauses funnel_reminder_pauses_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_reminder_pauses
    ADD CONSTRAINT funnel_reminder_pauses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: gallery_hotspots gallery_hotspots_designer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_hotspots
    ADD CONSTRAINT gallery_hotspots_designer_id_fkey FOREIGN KEY (designer_id) REFERENCES public.designers(id) ON DELETE SET NULL;


--
-- Name: gallery_hotspots gallery_hotspots_mapped_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_hotspots
    ADD CONSTRAINT gallery_hotspots_mapped_pick_id_fkey FOREIGN KEY (mapped_pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE SET NULL;


--
-- Name: guide_views guide_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_views
    ADD CONSTRAINT guide_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_concierge_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_concierge_lead_id_fkey FOREIGN KEY (concierge_lead_id) REFERENCES public.concierge_leads(id) ON DELETE SET NULL;


--
-- Name: inquiries inquiries_linked_quote_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_linked_quote_fk FOREIGN KEY (linked_quote_id) REFERENCES public.trade_quotes(id) ON DELETE SET NULL;


--
-- Name: items items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: items items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: journal_pipeline journal_pipeline_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_pipeline
    ADD CONSTRAINT journal_pipeline_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.journal_articles(id) ON DELETE SET NULL;


--
-- Name: magazine_badge_events magazine_badge_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magazine_badge_events
    ADD CONSTRAINT magazine_badge_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.trade_documents(id) ON DELETE SET NULL;


--
-- Name: magazine_badge_events magazine_badge_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magazine_badge_events
    ADD CONSTRAINT magazine_badge_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: markup_annotations markup_annotations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markup_annotations
    ADD CONSTRAINT markup_annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_timeline_commission order_timeline_commission_timeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline_commission
    ADD CONSTRAINT order_timeline_commission_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES public.order_timeline(id) ON DELETE CASCADE;


--
-- Name: order_timeline order_timeline_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline
    ADD CONSTRAINT order_timeline_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: order_timeline order_timeline_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline
    ADD CONSTRAINT order_timeline_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE CASCADE;


--
-- Name: order_timeline order_timeline_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_timeline
    ADD CONSTRAINT order_timeline_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: portal_invites portal_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invites
    ADD CONSTRAINT portal_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: portal_redemptions portal_redemptions_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_redemptions
    ADD CONSTRAINT portal_redemptions_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.portal_invites(id) ON DELETE CASCADE;


--
-- Name: portal_redemptions portal_redemptions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_redemptions
    ADD CONSTRAINT portal_redemptions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.portal_sessions(id) ON DELETE SET NULL;


--
-- Name: portal_sessions portal_sessions_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_sessions
    ADD CONSTRAINT portal_sessions_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.portal_invites(id) ON DELETE CASCADE;


--
-- Name: presentation_comments presentation_comments_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_comments
    ADD CONSTRAINT presentation_comments_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.presentations(id) ON DELETE CASCADE;


--
-- Name: presentation_comments presentation_comments_slide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_comments
    ADD CONSTRAINT presentation_comments_slide_id_fkey FOREIGN KEY (slide_id) REFERENCES public.presentation_slides(id) ON DELETE CASCADE;


--
-- Name: presentation_shares presentation_shares_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_shares
    ADD CONSTRAINT presentation_shares_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.presentations(id) ON DELETE CASCADE;


--
-- Name: presentation_slides presentation_slides_gallery_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_slides
    ADD CONSTRAINT presentation_slides_gallery_item_id_fkey FOREIGN KEY (gallery_item_id) REFERENCES public.axonometric_gallery(id) ON DELETE SET NULL;


--
-- Name: presentation_slides presentation_slides_presentation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presentation_slides
    ADD CONSTRAINT presentation_slides_presentation_id_fkey FOREIGN KEY (presentation_id) REFERENCES public.presentations(id) ON DELETE CASCADE;


--
-- Name: product_cad_asset_geometry product_cad_asset_geometry_cad_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cad_asset_geometry
    ADD CONSTRAINT product_cad_asset_geometry_cad_asset_id_fkey FOREIGN KEY (cad_asset_id) REFERENCES public.trade_product_cad_assets(id) ON DELETE CASCADE;


--
-- Name: product_descriptor_links product_descriptor_links_descriptor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_descriptor_links
    ADD CONSTRAINT product_descriptor_links_descriptor_id_fkey FOREIGN KEY (descriptor_id) REFERENCES public.descriptor_taxonomy(id) ON DELETE RESTRICT;


--
-- Name: product_descriptor_links product_descriptor_links_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_descriptor_links
    ADD CONSTRAINT product_descriptor_links_pick_id_fkey FOREIGN KEY (pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;


--
-- Name: product_descriptor_links product_descriptor_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_descriptor_links
    ADD CONSTRAINT product_descriptor_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: product_fabrics product_fabrics_fabric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_fabrics
    ADD CONSTRAINT product_fabrics_fabric_id_fkey FOREIGN KEY (fabric_id) REFERENCES public.fabrics(id) ON DELETE CASCADE;


--
-- Name: product_fabrics product_fabrics_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_fabrics
    ADD CONSTRAINT product_fabrics_pick_id_fkey FOREIGN KEY (pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;


--
-- Name: product_material_links product_material_links_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_material_links
    ADD CONSTRAINT product_material_links_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material_taxonomy(id) ON DELETE RESTRICT;


--
-- Name: product_material_links product_material_links_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_material_links
    ADD CONSTRAINT product_material_links_pick_id_fkey FOREIGN KEY (pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;


--
-- Name: product_material_links product_material_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_material_links
    ADD CONSTRAINT product_material_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: projects projects_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: provenance_certificates provenance_certificates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provenance_certificates
    ADD CONSTRAINT provenance_certificates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: provenance_events provenance_events_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provenance_events
    ADD CONSTRAINT provenance_events_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES public.provenance_certificates(id) ON DELETE CASCADE;


--
-- Name: public_download_events public_download_events_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_download_events
    ADD CONSTRAINT public_download_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.trade_documents(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: quote_email_log quote_email_log_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_email_log
    ADD CONSTRAINT quote_email_log_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE CASCADE;


--
-- Name: quote_payment_links quote_payment_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payment_links
    ADD CONSTRAINT quote_payment_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: quote_payment_links quote_payment_links_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_payment_links
    ADD CONSTRAINT quote_payment_links_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: sample_request_audit_log sample_request_audit_log_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_request_audit_log
    ADD CONSTRAINT sample_request_audit_log_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.trade_sample_requests(id) ON DELETE CASCADE;


--
-- Name: scrape_configs scrape_configs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrape_configs
    ADD CONSTRAINT scrape_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shipping_quotes shipping_quotes_order_timeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_order_timeline_id_fkey FOREIGN KEY (order_timeline_id) REFERENCES public.order_timeline(id) ON DELETE CASCADE;


--
-- Name: shipping_quotes shipping_quotes_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE SET NULL;


--
-- Name: shipping_quotes shipping_quotes_selected_lane_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_selected_lane_id_fkey FOREIGN KEY (selected_lane_id) REFERENCES public.shipping_lanes(id) ON DELETE SET NULL;


--
-- Name: shipping_rate_brackets shipping_rate_brackets_lane_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rate_brackets
    ADD CONSTRAINT shipping_rate_brackets_lane_id_fkey FOREIGN KEY (lane_id) REFERENCES public.shipping_lanes(id) ON DELETE CASCADE;


--
-- Name: shipping_surcharges shipping_surcharges_lane_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_surcharges
    ADD CONSTRAINT shipping_surcharges_lane_id_fkey FOREIGN KEY (lane_id) REFERENCES public.shipping_lanes(id) ON DELETE CASCADE;


--
-- Name: shop_order_items shop_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_order_items
    ADD CONSTRAINT shop_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shop_orders(id) ON DELETE CASCADE;


--
-- Name: shop_orders shop_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_orders
    ADD CONSTRAINT shop_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: studio_alerts studio_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_alerts
    ADD CONSTRAINT studio_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: studio_invites studio_invites_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_invites
    ADD CONSTRAINT studio_invites_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: studio_lead_events studio_lead_events_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_lead_events
    ADD CONSTRAINT studio_lead_events_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.featured_studios(id) ON DELETE CASCADE;


--
-- Name: studio_lead_events studio_lead_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_lead_events
    ADD CONSTRAINT studio_lead_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: studio_members studio_members_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_members
    ADD CONSTRAINT studio_members_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: studio_payout_accounts studio_payout_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_payout_accounts
    ADD CONSTRAINT studio_payout_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: studio_payout_accounts studio_payout_accounts_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_payout_accounts
    ADD CONSTRAINT studio_payout_accounts_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: studio_project_overrides studio_project_overrides_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_project_overrides
    ADD CONSTRAINT studio_project_overrides_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: studio_resale_certificates studio_resale_certificates_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resale_certificates
    ADD CONSTRAINT studio_resale_certificates_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: studio_resale_certificates studio_resale_certificates_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resale_certificates
    ADD CONSTRAINT studio_resale_certificates_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: studio_resale_certificates studio_resale_certificates_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_resale_certificates
    ADD CONSTRAINT studio_resale_certificates_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);


--
-- Name: trade_applications trade_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_applications
    ADD CONSTRAINT trade_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_concierge_actions trade_concierge_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_concierge_actions
    ADD CONSTRAINT trade_concierge_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_concierge_escalations trade_concierge_escalations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_concierge_escalations
    ADD CONSTRAINT trade_concierge_escalations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_custom_request_activity trade_custom_request_activity_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_request_activity
    ADD CONSTRAINT trade_custom_request_activity_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.trade_custom_requests(id) ON DELETE CASCADE;


--
-- Name: trade_custom_requests trade_custom_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_requests
    ADD CONSTRAINT trade_custom_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE SET NULL;


--
-- Name: trade_custom_requests trade_custom_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_requests
    ADD CONSTRAINT trade_custom_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: trade_custom_requests trade_custom_requests_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_custom_requests
    ADD CONSTRAINT trade_custom_requests_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: trade_favorites trade_favorites_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_favorites
    ADD CONSTRAINT trade_favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: trade_favorites trade_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_favorites
    ADD CONSTRAINT trade_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_floor_plan_layouts trade_floor_plan_layouts_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_floor_plan_layouts
    ADD CONSTRAINT trade_floor_plan_layouts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.trade_floor_plans(id) ON DELETE CASCADE;


--
-- Name: trade_product_glb_variants trade_product_glb_variants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_glb_variants
    ADD CONSTRAINT trade_product_glb_variants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: trade_product_glb_variants trade_product_glb_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_glb_variants
    ADD CONSTRAINT trade_product_glb_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: trade_product_pricing trade_product_pricing_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_product_pricing
    ADD CONSTRAINT trade_product_pricing_pick_id_fkey FOREIGN KEY (pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE CASCADE;


--
-- Name: trade_products trade_products_source_pick_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_products
    ADD CONSTRAINT trade_products_source_pick_id_fkey FOREIGN KEY (source_pick_id) REFERENCES public.designer_curator_picks(id) ON DELETE SET NULL;


--
-- Name: trade_quote_extras trade_quote_extras_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_extras
    ADD CONSTRAINT trade_quote_extras_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE CASCADE;


--
-- Name: trade_quote_items trade_quote_items_fabric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_fabric_id_fkey FOREIGN KEY (fabric_id) REFERENCES public.fabrics(id) ON DELETE SET NULL;


--
-- Name: trade_quote_items trade_quote_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE CASCADE;


--
-- Name: trade_quote_items trade_quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.trade_quotes(id) ON DELETE CASCADE;


--
-- Name: trade_quote_items trade_quote_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: trade_quote_items trade_quote_items_wood_fabric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quote_items
    ADD CONSTRAINT trade_quote_items_wood_fabric_id_fkey FOREIGN KEY (wood_fabric_id) REFERENCES public.fabrics(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_designer_payout_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_designer_payout_account_id_fkey FOREIGN KEY (designer_payout_account_id) REFERENCES public.studio_payout_accounts(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_managed_freight_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_managed_freight_quote_id_fkey FOREIGN KEY (managed_freight_quote_id) REFERENCES public.shipping_quotes(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_resale_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_resale_certificate_id_fkey FOREIGN KEY (resale_certificate_id) REFERENCES public.studio_resale_certificates(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_source_inquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_source_inquiry_id_fkey FOREIGN KEY (source_inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;


--
-- Name: trade_quotes trade_quotes_studio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_studio_id_fkey FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE CASCADE;


--
-- Name: trade_quotes trade_quotes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_quotes
    ADD CONSTRAINT trade_quotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_recent_views trade_recent_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_recent_views
    ADD CONSTRAINT trade_recent_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_sample_requests trade_sample_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_sample_requests
    ADD CONSTRAINT trade_sample_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.trade_products(id) ON DELETE SET NULL;


--
-- Name: trade_sample_requests trade_sample_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_sample_requests
    ADD CONSTRAINT trade_sample_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trade_user_memory trade_user_memory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_user_memory
    ADD CONSTRAINT trade_user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: verification_audit_log verification_audit_log_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_audit_log
    ADD CONSTRAINT verification_audit_log_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.trade_applications(id) ON DELETE CASCADE;


--
-- Name: verification_feedback_loops verification_feedback_loops_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_feedback_loops
    ADD CONSTRAINT verification_feedback_loops_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.trade_applications(id) ON DELETE SET NULL;


--
-- Name: verification_audit_log Admins can append verification audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can append verification audit log" ON public.verification_audit_log FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: trade_product_glb_variants Admins can delete GLB variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete GLB variants" ON public.trade_product_glb_variants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cn_director_briefs Admins can delete cn director briefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete cn director briefs" ON public.cn_director_briefs FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: custom_inquiries Admins can delete customization inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete customization inquiries" ON public.custom_inquiries FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: gallery_hotspots Admins can delete gallery hotspots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete gallery hotspots" ON public.gallery_hotspots FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inquiries Admins can delete inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete inquiries" ON public.inquiries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_quote_items Admins can delete quote items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete quote items" ON public.trade_quote_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_quotes Admins can delete quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete quotes" ON public.trade_quotes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: studio_lead_events Admins can delete studio lead events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete studio lead events" ON public.studio_lead_events FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: studio_submissions Admins can delete submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete submissions" ON public.studio_submissions FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_product_glb_variants Admins can insert GLB variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert GLB variants" ON public.trade_product_glb_variants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: funnel_card_payments Admins can insert funnel card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert funnel card payments" ON public.funnel_card_payments FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: gallery_hotspots Admins can insert gallery hotspots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert gallery hotspots" ON public.gallery_hotspots FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_product_cad_assets Admins can manage CAD assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage CAD assets" ON public.trade_product_cad_assets TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cpd_events Admins can manage CPD events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage CPD events" ON public.cpd_events TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: projects Admins can manage all projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all projects" ON public.projects TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_articles Admins can manage articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage articles" ON public.journal_articles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: auction_benchmarks Admins can manage auction benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage auction benchmarks" ON public.auction_benchmarks TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: axonometric_gallery Admins can manage axonometric gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage axonometric gallery" ON public.axonometric_gallery TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: brand_thumbnails Admins can manage brand thumbnails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage brand thumbnails" ON public.brand_thumbnails TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: provenance_events Admins can manage certificate events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage certificate events" ON public.provenance_events TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: provenance_certificates Admins can manage certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage certificates" ON public.provenance_certificates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: collectible_overrides Admins can manage collectible overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage collectible overrides" ON public.collectible_overrides TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: competitor_designers Admins can manage competitor designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage competitor designers" ON public.competitor_designers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: competitor_galleries Admins can manage competitor galleries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage competitor galleries" ON public.competitor_galleries TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: competitor_traffic Admins can manage competitor traffic; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage competitor traffic" ON public.competitor_traffic TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: currency_rates Admins can manage currency rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage currency rates" ON public.currency_rates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designer_curator_picks Admins can manage designer picks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage designer picks" ON public.designer_curator_picks TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designers Admins can manage designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage designers" ON public.designers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_documents Admins can manage documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage documents" ON public.trade_documents TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_duration_templates Admins can manage duration templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage duration templates" ON public.order_duration_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: featured_studios Admins can manage featured studios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage featured studios" ON public.featured_studios TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designer_heritage_slides Admins can manage heritage slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage heritage slides" ON public.designer_heritage_slides TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designer_instagram_posts Admins can manage instagram posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage instagram posts" ON public.designer_instagram_posts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_timeline Admins can manage order timelines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order timelines" ON public.order_timeline TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_pipeline Admins can manage pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage pipeline" ON public.journal_pipeline TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: presentation_comments Admins can manage presentation comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage presentation comments" ON public.presentation_comments TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: presentation_shares Admins can manage presentation shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage presentation shares" ON public.presentation_shares TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: presentation_slides Admins can manage presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage presentation slides" ON public.presentation_slides TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: presentations Admins can manage presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage presentations" ON public.presentations TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_products Admins can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage products" ON public.trade_products TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: board_recommendations Admins can manage recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage recommendations" ON public.board_recommendations USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reference_styles Admins can manage reference styles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage reference styles" ON public.reference_styles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: scrape_configs Admins can manage scrape configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage scrape configs" ON public.scrape_configs TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: scrape_runs Admins can manage scrape runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage scrape runs" ON public.scrape_runs TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: section_heroes Admins can manage section heroes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage section heroes" ON public.section_heroes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: material_swatches Admins can manage swatches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage swatches" ON public.material_swatches TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: client_taste_profiles Admins can manage taste profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage taste profiles" ON public.client_taste_profiles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_usage_events Admins can read ai usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read ai usage" ON public.ai_usage_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_applications Admins can read all applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all applications" ON public.trade_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can read all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cn_director_briefs Admins can read cn director briefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read cn director briefs" ON public.cn_director_briefs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: custom_inquiries Admins can read customization inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read customization inquiries" ON public.custom_inquiries FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: guide_views Admins can read guide views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read guide views" ON public.guide_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: magazine_badge_events Admins can read magazine badge events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read magazine badge events" ON public.magazine_badge_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: verification_audit_log Admins can read verification audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read verification audit log" ON public.verification_audit_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: webhook_events Admins can read webhook events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read webhook events" ON public.webhook_events FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: trade_product_glb_variants Admins can update GLB variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update GLB variants" ON public.trade_product_glb_variants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: axonometric_requests Admins can update all axonometric requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all axonometric requests" ON public.axonometric_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_quote_items Admins can update all quote items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all quote items" ON public.trade_quote_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_sample_requests Admins can update all sample requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all sample requests" ON public.trade_sample_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_applications Admins can update applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update applications" ON public.trade_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cn_director_briefs Admins can update cn director briefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update cn director briefs" ON public.cn_director_briefs FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: concierge_leads Admins can update concierge leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update concierge leads" ON public.concierge_leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_inquiries Admins can update customization inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update customization inquiries" ON public.custom_inquiries FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: funnel_card_payments Admins can update funnel card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update funnel card payments" ON public.funnel_card_payments FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: gallery_hotspots Admins can update gallery hotspots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update gallery hotspots" ON public.gallery_hotspots FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inquiries Admins can update inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update inquiries" ON public.inquiries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update profile tier; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update profile tier" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: studio_submissions Admins can update submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update submissions" ON public.studio_submissions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: og_rescrape_runs Admins can view OG rescrape runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view OG rescrape runs" ON public.og_rescrape_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_alert_log Admins can view alert log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view alert log" ON public.admin_alert_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: cad_asset_downloads Admins can view all CAD downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all CAD downloads" ON public.cad_asset_downloads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_custom_request_activity Admins can view all activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all activity" ON public.trade_custom_request_activity FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: markup_annotations Admins can view all annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all annotations" ON public.markup_annotations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cpd_attendance Admins can view all attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all attendance" ON public.cpd_attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: axonometric_requests Admins can view all axonometric requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all axonometric requests" ON public.axonometric_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: client_board_items Admins can view all board items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all board items" ON public.client_board_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: concierge_leads Admins can view all concierge leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all concierge leads" ON public.concierge_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: document_downloads Admins can view all downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all downloads" ON public.document_downloads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_favorites Admins can view all favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all favorites" ON public.trade_favorites FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inquiries Admins can view all inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all inquiries" ON public.inquiries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: room_planner_projects Admins can view all planner projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all planner projects" ON public.room_planner_projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_quote_items Admins can view all quote items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all quote items" ON public.trade_quote_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: concierge_rag_traces Admins can view all rag traces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all rag traces" ON public.concierge_rag_traces FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_sample_requests Admins can view all sample requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all sample requests" ON public.trade_sample_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: content_audit_log Admins can view audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit log" ON public.content_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sample_request_audit_log Admins can view audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit log" ON public.sample_request_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cron_http_call_log Admins can view cron http call log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view cron http call log" ON public.cron_http_call_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_click_log Admins can view email click logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email click logs" ON public.email_click_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: email_send_log Admins can view email send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email send log" ON public.email_send_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: funnel_card_payments Admins can view funnel card payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view funnel card payments" ON public.funnel_card_payments FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: guardrail_logs Admins can view guardrail logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view guardrail logs" ON public.guardrail_logs FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: public_download_events Admins can view public download events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view public download events" ON public.public_download_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: studio_submissions Admins can view submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view submissions" ON public.studio_submissions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: suppressed_emails Admins can view suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view suppressed emails" ON public.suppressed_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tour_events Admins can view tour events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view tour events" ON public.tour_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_program_signups Admins can view trade program signups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view trade program signups" ON public.trade_program_signups FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: video_watch_events Admins can view video watch events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view video watch events" ON public.video_watch_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: whatsapp_delivery_events Admins can view whatsapp delivery events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view whatsapp delivery events" ON public.whatsapp_delivery_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: abandoned_carts Admins delete abandoned carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete abandoned carts" ON public.abandoned_carts FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: ai_model_pricing Admins manage ai model pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage ai model pricing" ON public.ai_model_pricing TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_quote_extras Admins manage all quote extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all quote extras" ON public.trade_quote_extras TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shipping_quotes Admins manage all shipping quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage all shipping quotes" ON public.shipping_quotes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: collectible_atelier_gallery Admins manage atelier gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage atelier gallery" ON public.collectible_atelier_gallery USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: collectible_atelier_overrides Admins manage atelier overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage atelier overrides" ON public.collectible_atelier_overrides USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: brand_lead_times Admins manage brand lead times; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage brand lead times" ON public.brand_lead_times TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_timeline_commission Admins manage commission; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage commission" ON public.order_timeline_commission TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: descriptor_taxonomy Admins manage descriptor taxonomy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage descriptor taxonomy" ON public.descriptor_taxonomy TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designer_payouts Admins manage designer payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage designer payouts" ON public.designer_payouts TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: shipping_duty_rates Admins manage duty rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage duty rates" ON public.shipping_duty_rates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fabrics Admins manage fabrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage fabrics" ON public.fabrics USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ingestion_job_state Admins manage ingestion job state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage ingestion job state" ON public.ingestion_job_state TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: ingestion_queue Admins manage ingestion queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage ingestion queue" ON public.ingestion_queue TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: material_taxonomy Admins manage material taxonomy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage material taxonomy" ON public.material_taxonomy TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: onboarding_flow_config Admins manage onboarding config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage onboarding config" ON public.onboarding_flow_config TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shop_orders Admins manage orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage orders" ON public.shop_orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: personal_email_domains Admins manage personal email domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage personal email domains" ON public.personal_email_domains TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: portal_invites Admins manage portal invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage portal invites" ON public.portal_invites TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: product_descriptor_links Admins manage product descriptor links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage product descriptor links" ON public.product_descriptor_links TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_fabrics Admins manage product fabrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage product fabrics" ON public.product_fabrics USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_material_links Admins manage product material links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage product material links" ON public.product_material_links TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: quote_payment_links Admins manage quote payment links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage quote payment links" ON public.quote_payment_links TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shipping_rate_brackets Admins manage rate brackets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage rate brackets" ON public.shipping_rate_brackets TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: funnel_reminder_pauses Admins manage reminder pauses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage reminder pauses" ON public.funnel_reminder_pauses TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: shipping_lanes Admins manage shipping lanes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage shipping lanes" ON public.shipping_lanes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: suppliers Admins manage suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage suppliers" ON public.suppliers TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: shipping_surcharges Admins manage surcharges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage surcharges" ON public.shipping_surcharges TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_tier_config Admins manage tier config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tier config" ON public.trade_tier_config TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: onboarding_tour_steps Admins manage tour steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tour steps" ON public.onboarding_tour_steps TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_fair_events Admins manage trade fair events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage trade fair events" ON public.trade_fair_events USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_product_pricing Admins manage trade pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage trade pricing" ON public.trade_product_pricing TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: verification_feedback_loops Admins manage verification feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage verification feedback" ON public.verification_feedback_loops TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_orders_payable Admins manage wholesale payables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage wholesale payables" ON public.purchase_orders_payable TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: mcp_click_log Admins may read MCP click log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins may read MCP click log" ON public.mcp_click_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: mcp_query_log Admins may read MCP query log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins may read MCP query log" ON public.mcp_query_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: studio_project_overrides Admins of project's studio manage overrides (delete); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins of project's studio manage overrides (delete)" ON public.studio_project_overrides FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = studio_project_overrides.project_id) AND public.has_studio_role(auth.uid(), p.studio_id, 'admin'::public.studio_role)))));


--
-- Name: studio_project_overrides Admins of project's studio manage overrides (insert); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins of project's studio manage overrides (insert)" ON public.studio_project_overrides FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = studio_project_overrides.project_id) AND public.has_studio_role(auth.uid(), p.studio_id, 'admin'::public.studio_role)))));


--
-- Name: studio_project_overrides Admins of project's studio manage overrides (update); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins of project's studio manage overrides (update)" ON public.studio_project_overrides FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = studio_project_overrides.project_id) AND public.has_studio_role(auth.uid(), p.studio_id, 'admin'::public.studio_role)))));


--
-- Name: abandoned_carts Admins read abandoned carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read abandoned carts" ON public.abandoned_carts FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: security_alert_state Admins read alert state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read alert state" ON public.security_alert_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_concierge_escalations Admins read all escalations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all escalations" ON public.trade_concierge_escalations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_recent_views Admins read all recent views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all recent views" ON public.trade_recent_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: designer_purchase_orders Admins read designer purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read designer purchase orders" ON public.designer_purchase_orders FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: funnel_reminder_log Admins read funnel reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read funnel reminders" ON public.funnel_reminder_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: security_audit_events Admins read security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read security events" ON public.security_audit_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: abandoned_carts Admins update abandoned carts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update abandoned carts" ON public.abandoned_carts FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: collector_applications Admins update collector applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update collector applications" ON public.collector_applications FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: trade_concierge_escalations Admins update escalations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update escalations" ON public.trade_concierge_escalations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_concierge_actions Admins view all concierge actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all concierge actions" ON public.trade_concierge_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trade_concierge_usage Admins view all concierge usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all concierge usage" ON public.trade_concierge_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: shop_orders Admins view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all orders" ON public.shop_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: portal_redemptions Admins view portal redemptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view portal redemptions" ON public.portal_redemptions FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: portal_sessions Admins view portal sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view portal sessions" ON public.portal_sessions FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: studios Anyone authenticated can create a studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can create a studio" ON public.studios FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: onboarding_flow_config Anyone authenticated can read onboarding config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can read onboarding config" ON public.onboarding_flow_config FOR SELECT TO authenticated USING (true);


--
-- Name: onboarding_tour_steps Anyone authenticated can read tour steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can read tour steps" ON public.onboarding_tour_steps FOR SELECT TO authenticated USING (true);


--
-- Name: concierge_leads Anyone can insert a concierge lead; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert a concierge lead" ON public.concierge_leads FOR INSERT TO authenticated, anon WITH CHECK ((((user_id IS NULL) OR (user_id = auth.uid())) AND (surface = ANY (ARRAY['public'::text, 'trade'::text])) AND (session_id IS NOT NULL) AND ((char_length(session_id) >= 1) AND (char_length(session_id) <= 200)) AND ((name IS NULL) OR (char_length(name) <= 200)) AND ((city IS NULL) OR (char_length(city) <= 120)) AND ((country IS NULL) OR (char_length(country) <= 120)) AND ((first_message IS NULL) OR (char_length(first_message) <= 5000)) AND ((intent IS NULL) OR (char_length(intent) <= 200)) AND ((path IS NULL) OR (char_length(path) <= 500)) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 500)) AND ((referrer IS NULL) OR (char_length(referrer) <= 500))));


--
-- Name: magazine_badge_events Anyone can insert magazine badge events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert magazine badge events" ON public.magazine_badge_events FOR INSERT TO authenticated, anon WITH CHECK (((event_type = ANY (ARRAY['impression'::text, 'click'::text])) AND ((document_label IS NULL) OR (char_length(document_label) <= 200)) AND (char_length(source) <= 100) AND ((country IS NULL) OR (char_length(country) <= 120)) AND ((user_id IS NULL) OR (user_id = auth.uid()))));


--
-- Name: video_watch_events Anyone can insert video watch events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert video watch events" ON public.video_watch_events FOR INSERT TO authenticated, anon WITH CHECK (((video_id IS NOT NULL) AND (char_length(video_id) <= 200) AND (session_id IS NOT NULL) AND ((char_length(session_id) >= 1) AND (char_length(session_id) <= 200)) AND (event_type IS NOT NULL) AND (char_length(event_type) <= 64) AND ((progress_percent IS NULL) OR ((progress_percent >= 0) AND (progress_percent <= 100))) AND ((watch_duration_seconds IS NULL) OR ((watch_duration_seconds >= (0)::numeric) AND (watch_duration_seconds <= (86400)::numeric))) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 500)) AND ((referrer IS NULL) OR (char_length(referrer) <= 500))));


--
-- Name: studio_lead_events Anyone can log studio lead events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can log studio lead events" ON public.studio_lead_events FOR INSERT WITH CHECK (((studio_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.studios s
  WHERE (s.id = studio_lead_events.studio_id))) AND (event_type IS NOT NULL) AND (char_length(event_type) <= 64) AND ((cta_kind IS NULL) OR (char_length(cta_kind) <= 64)) AND ((filter_key IS NULL) OR (char_length(filter_key) <= 64)) AND ((filter_value IS NULL) OR (char_length(filter_value) <= 256)) AND ((visitor_hash IS NULL) OR (char_length(visitor_hash) <= 128)) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 500)) AND ((referrer IS NULL) OR (char_length(referrer) <= 500))));


--
-- Name: tour_events Anyone can log tour events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can log tour events" ON public.tour_events FOR INSERT TO authenticated, anon WITH CHECK (((event_type = ANY (ARRAY['tour_step_view'::text, 'tour_substep_click'::text, 'tour_complete'::text, 'tour_skip'::text])) AND ((user_id IS NULL) OR (user_id = auth.uid())) AND ((step_id IS NULL) OR (char_length(step_id) <= 200)) AND ((sub_step_id IS NULL) OR (char_length(sub_step_id) <= 200)) AND ((sub_step_label IS NULL) OR (char_length(sub_step_label) <= 300)) AND ((target_path IS NULL) OR (char_length(target_path) <= 500)) AND ((device_type IS NULL) OR (char_length(device_type) <= 40)) AND ((platform IS NULL) OR (char_length(platform) <= 40)) AND ((viewport IS NULL) OR (char_length(viewport) <= 40)) AND ((language IS NULL) OR (char_length(language) <= 20)) AND ((page_path IS NULL) OR (char_length(page_path) <= 500)) AND ((referrer_host IS NULL) OR (char_length(referrer_host) <= 200))));


--
-- Name: custom_inquiries Anyone can submit a customization inquiry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit a customization inquiry" ON public.custom_inquiries FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: studio_submissions Anyone can submit a studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit a studio" ON public.studio_submissions FOR INSERT TO authenticated, anon WITH CHECK ((((user_id IS NULL) OR (user_id = auth.uid())) AND ((char_length(studio_name) >= 1) AND (char_length(studio_name) <= 200)) AND ((char_length(contact_name) >= 1) AND (char_length(contact_name) <= 200)) AND ((char_length(email) >= 3) AND (char_length(email) <= 320)) AND (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND ((phone IS NULL) OR (char_length(phone) <= 64)) AND ((website IS NULL) OR (char_length(website) <= 500)) AND ((instagram IS NULL) OR (char_length(instagram) <= 200)) AND ((location IS NULL) OR (char_length(location) <= 200)) AND ((country IS NULL) OR (char_length(country) <= 120)) AND ((portfolio_url IS NULL) OR (char_length(portfolio_url) <= 500)) AND ((about IS NULL) OR (char_length(about) <= 5000)) AND ((notable_projects IS NULL) OR (char_length(notable_projects) <= 5000)) AND (COALESCE(array_length(disciplines, 1), 0) <= 20) AND (COALESCE(array_length(project_types, 1), 0) <= 20) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 500)) AND ((referrer IS NULL) OR (char_length(referrer) <= 500))));


--
-- Name: trade_documents Anyone can view featured public document; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view featured public document" ON public.trade_documents FOR SELECT TO authenticated, anon USING ((is_featured_public = true));


--
-- Name: journal_articles Anyone can view published articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published articles" ON public.journal_articles FOR SELECT TO authenticated, anon USING ((is_published = true));


--
-- Name: provenance_events Anyone can view published certificate events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published certificate events" ON public.provenance_events FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.provenance_certificates
  WHERE ((provenance_certificates.id = provenance_events.certificate_id) AND (provenance_certificates.is_published = true)))));


--
-- Name: provenance_certificates Anyone can view published certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published certificates" ON public.provenance_certificates FOR SELECT TO authenticated, anon USING ((is_published = true));


--
-- Name: designers Anyone can view published designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published designers" ON public.designers FOR SELECT USING (((is_published = true) AND (trade_only = false)));


--
-- Name: trade_fair_events Anyone can view published trade fair events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published trade fair events" ON public.trade_fair_events FOR SELECT USING (((is_published = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: mcp_click_log Anyone may insert MCP click events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone may insert MCP click events" ON public.mcp_click_log FOR INSERT TO authenticated, anon WITH CHECK (((click_type = ANY (ARRAY['product'::text, 'signup'::text, 'designer'::text])) AND ((designer_slug IS NULL) OR (char_length(designer_slug) <= 200)) AND ((ip_hash IS NULL) OR (char_length(ip_hash) <= 128)) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 500)) AND ((referer IS NULL) OR (char_length(referer) <= 500))));


--
-- Name: mcp_query_log Anyone may insert MCP query events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone may insert MCP query events" ON public.mcp_query_log FOR INSERT TO authenticated, anon WITH CHECK (((tool_name IS NOT NULL) AND ((char_length(tool_name) >= 1) AND (char_length(tool_name) <= 200)) AND ((args IS NULL) OR (pg_column_size(args) <= 8192)) AND ((result_count IS NULL) OR ((result_count >= 0) AND (result_count <= 100000))) AND ((duration_ms IS NULL) OR ((duration_ms >= 0) AND (duration_ms <= 600000)))));


--
-- Name: trade_product_pricing Approved trade users and admins can read trade pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved trade users and admins can read trade pricing" ON public.trade_product_pricing FOR SELECT TO authenticated USING (public.is_approved_trade_user(auth.uid()));


--
-- Name: designer_curator_picks Approved trade users and admins can view curator picks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved trade users and admins can view curator picks" ON public.designer_curator_picks FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.is_approved_trade_user(auth.uid()) AND (is_hidden IS NOT TRUE))));


--
-- Name: trade_products Approved trade users and admins can view products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved trade users and admins can view products" ON public.trade_products FOR SELECT TO authenticated USING (public.is_approved_trade_user(auth.uid()));


--
-- Name: trade_tier_config Approved trade users view tier config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved trade users view tier config" ON public.trade_tier_config FOR SELECT TO authenticated USING (public.is_approved_trade_user(auth.uid()));


--
-- Name: items Authenticated insert own items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert own items" ON public.items FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: purchase_orders Authenticated insert own pos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert own pos" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: quotes Authenticated insert own quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated insert own quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: guide_views Authenticated users can log guide views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can log guide views" ON public.guide_views FOR INSERT TO authenticated WITH CHECK (((user_id IS NULL) OR (user_id = auth.uid())));


--
-- Name: suppliers Authenticated users can read suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);


--
-- Name: client_board_comments Board owners can manage comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Board owners can manage comments" ON public.client_board_comments TO authenticated USING (public.owns_client_board(auth.uid(), board_id)) WITH CHECK (public.owns_client_board(auth.uid(), board_id));


--
-- Name: client_board_items Board owners can manage items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Board owners can manage items" ON public.client_board_items TO authenticated USING (public.owns_client_board(auth.uid(), board_id)) WITH CHECK (public.owns_client_board(auth.uid(), board_id));


--
-- Name: board_recommendations Board owners can view recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Board owners can view recommendations" ON public.board_recommendations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.client_boards
  WHERE ((client_boards.id = board_recommendations.board_id) AND (client_boards.user_id = auth.uid())))));


--
-- Name: client_boards Create boards (editor+ in studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create boards (editor+ in studio)" ON public.client_boards FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((studio_id IS NULL) OR public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_custom_requests Create custom requests (editor+ in studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create custom requests (editor+ in studio)" ON public.trade_custom_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((studio_id IS NULL) OR public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: projects Create projects in own studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create projects in own studio" ON public.projects FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((studio_id IS NULL) OR public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_quotes Create quotes (editor+ in studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create quotes (editor+ in studio)" ON public.trade_quotes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((studio_id IS NULL) OR public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: order_timeline Create timelines (editor+ in studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Create timelines (editor+ in studio)" ON public.order_timeline FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((studio_id IS NULL) OR public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: currency_rates Currency rates are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Currency rates are publicly readable" ON public.currency_rates FOR SELECT USING (true);


--
-- Name: client_boards Delete boards (admin+ of studio or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete boards (admin+ of studio or platform admin)" ON public.client_boards FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) OR ((studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: trade_custom_requests Delete custom requests (admin+ of studio or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete custom requests (admin+ of studio or platform admin)" ON public.trade_custom_requests FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) OR ((studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: projects Delete projects (admin/owner of studio or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete projects (admin/owner of studio or platform admin)" ON public.projects FOR DELETE USING ((((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_quotes Delete quotes (admin/owner of studio or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete quotes (admin/owner of studio or platform admin)" ON public.trade_quotes FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) OR ((studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: order_timeline Delete timelines (admin+ of studio or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete timelines (admin+ of studio or platform admin)" ON public.order_timeline FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) OR ((studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: projects Edit projects (editor+ on project or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Edit projects (editor+ on project or platform admin)" ON public.projects FOR UPDATE USING (public.can_edit_project(auth.uid(), id));


--
-- Name: quote_email_log Insert quote email log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insert quote email log" ON public.quote_email_log FOR INSERT WITH CHECK (((sent_by = auth.uid()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.trade_quotes q
  WHERE ((q.id = quote_email_log.quote_id) AND (q.user_id = auth.uid())))))));


--
-- Name: studio_members Invitees can join studios via valid invite; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Invitees can join studios via valid invite" ON public.studio_members FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.has_valid_studio_invite(auth.uid(), studio_id, role)));


--
-- Name: cad_fit_reports Members can delete their fit reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can delete their fit reports" ON public.cad_fit_reports FOR DELETE TO authenticated USING ((created_by = auth.uid()));


--
-- Name: cad_fit_reports Members can insert fit reports for their cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can insert fit reports for their cad documents" ON public.cad_fit_reports FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.cad_documents d
  WHERE ((d.id = cad_fit_reports.cad_document_id) AND ((d.uploaded_by = auth.uid()) OR ((d.studio_id IS NOT NULL) AND public.can_view_studio(auth.uid(), d.studio_id))))))));


--
-- Name: studio_members Members can view fellow members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view fellow members" ON public.studio_members FOR SELECT USING (public.can_view_studio(auth.uid(), studio_id));


--
-- Name: cad_fit_reports Members can view fit reports for their cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view fit reports for their cad documents" ON public.cad_fit_reports FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.cad_documents d
  WHERE ((d.id = cad_fit_reports.cad_document_id) AND ((d.uploaded_by = auth.uid()) OR ((d.studio_id IS NOT NULL) AND public.can_view_studio(auth.uid(), d.studio_id)))))));


--
-- Name: studio_project_overrides Members can view overrides for their studio's projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view overrides for their studio's projects" ON public.studio_project_overrides FOR SELECT USING (public.can_view_project(auth.uid(), project_id));


--
-- Name: studios Members can view their studios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their studios" ON public.studios FOR SELECT USING (public.can_view_studio(auth.uid(), id));


--
-- Name: trade_custom_request_activity No client deletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client deletes" ON public.trade_custom_request_activity FOR DELETE TO authenticated USING (false);


--
-- Name: trade_custom_request_activity No client inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client inserts" ON public.trade_custom_request_activity FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: trade_custom_request_activity No client updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client updates" ON public.trade_custom_request_activity FOR UPDATE TO authenticated USING (false);


--
-- Name: studios Owners and admins can update studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can update studio" ON public.studios FOR UPDATE USING ((public.has_studio_role(auth.uid(), id, 'admin'::public.studio_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: reference_styles Owners and admins can view reference styles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can view reference styles" ON public.reference_styles FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: studio_lead_events Owners and admins can view studio lead events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can view studio lead events" ON public.studio_lead_events FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'owner'::public.studio_role))));


--
-- Name: items Owners and admins delete items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins delete items" ON public.items FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: purchase_orders Owners and admins delete pos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins delete pos" ON public.purchase_orders FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: quotes Owners and admins delete quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins delete quotes" ON public.quotes FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: items Owners and admins read items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins read items" ON public.items FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: purchase_orders Owners and admins read pos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins read pos" ON public.purchase_orders FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: quotes Owners and admins read quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins read quotes" ON public.quotes FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: items Owners and admins update items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins update items" ON public.items FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: purchase_orders Owners and admins update pos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins update pos" ON public.purchase_orders FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: quotes Owners and admins update quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins update quotes" ON public.quotes FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: presentations Owners can delete own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete own presentations" ON public.presentations FOR DELETE TO authenticated USING ((created_by = auth.uid()));


--
-- Name: studios Owners can delete studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete studio" ON public.studios FOR DELETE USING ((public.has_studio_role(auth.uid(), id, 'owner'::public.studio_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: presentation_slides Owners can delete their presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete their presentation slides" ON public.presentation_slides FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_slides.presentation_id) AND (p.created_by = auth.uid())))));


--
-- Name: presentation_comments Owners can insert comments on their presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert comments on their presentations" ON public.presentation_comments FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_comments.presentation_id) AND (p.created_by = auth.uid()))))));


--
-- Name: presentations Owners can insert own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert own presentations" ON public.presentations FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: presentation_slides Owners can insert their presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert their presentation slides" ON public.presentation_slides FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_slides.presentation_id) AND (p.created_by = auth.uid())))));


--
-- Name: presentation_comments Owners can read their presentation comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can read their presentation comments" ON public.presentation_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_comments.presentation_id) AND (p.created_by = auth.uid())))));


--
-- Name: presentation_slides Owners can read their presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can read their presentation slides" ON public.presentation_slides FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_slides.presentation_id) AND (p.created_by = auth.uid())))));


--
-- Name: presentations Owners can update own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update own presentations" ON public.presentations FOR UPDATE TO authenticated USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: presentation_slides Owners can update their presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their presentation slides" ON public.presentation_slides FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_slides.presentation_id) AND (p.created_by = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.presentations p
  WHERE ((p.id = presentation_slides.presentation_id) AND (p.created_by = auth.uid())))));


--
-- Name: presentations Owners can view own presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view own presentations" ON public.presentations FOR SELECT TO authenticated USING ((created_by = auth.uid()));


--
-- Name: featured_studios Owners can view their own studio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view their own studio" ON public.featured_studios FOR SELECT TO authenticated USING ((owner_user_id = auth.uid()));


--
-- Name: studio_invites Owners/admins can create invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners/admins can create invites" ON public.studio_invites FOR INSERT WITH CHECK ((public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role) AND (invited_by = auth.uid()) AND ((role <> 'owner'::public.studio_role) OR public.has_studio_role(auth.uid(), studio_id, 'owner'::public.studio_role))));


--
-- Name: studio_invites Owners/admins can revoke invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners/admins can revoke invites" ON public.studio_invites FOR DELETE USING (public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role));


--
-- Name: studio_members Owners/admins can update member roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners/admins can update member roles" ON public.studio_members FOR UPDATE USING (public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)) WITH CHECK ((public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role) AND ((role <> 'owner'::public.studio_role) OR public.has_studio_role(auth.uid(), studio_id, 'owner'::public.studio_role)) AND (user_id <> auth.uid())));


--
-- Name: studio_members Owners/admins or self can remove a member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners/admins or self can remove a member" ON public.studio_members FOR DELETE USING ((public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role) OR (auth.uid() = user_id)));


--
-- Name: studio_payout_accounts Payout accounts read (studio admin+ or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Payout accounts read (studio admin+ or platform admin)" ON public.studio_payout_accounts FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)));


--
-- Name: studio_payout_accounts Payout accounts write (studio admin+ or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Payout accounts write (studio admin+ or platform admin)" ON public.studio_payout_accounts TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)));


--
-- Name: studio_members Platform admins can add studio members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can add studio members" ON public.studio_members FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: presentation_shares Presentation owners can view own shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Presentation owners can view own shares" ON public.presentation_shares FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentations
  WHERE ((presentations.id = presentation_shares.presentation_id) AND (presentations.created_by = auth.uid())))));


--
-- Name: product_fabric_swatches_public Public can read active fabric swatches only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active fabric swatches only" ON public.product_fabric_swatches_public FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((pick_id IS NULL) OR public.pick_is_publicly_visible(pick_id))));


--
-- Name: collectible_atelier_gallery Public can read atelier gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read atelier gallery" ON public.collectible_atelier_gallery FOR SELECT USING (true);


--
-- Name: collectible_atelier_overrides Public can read atelier overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read atelier overrides" ON public.collectible_atelier_overrides FOR SELECT USING (true);


--
-- Name: gallery_hotspots Public can read hotspots for public content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read hotspots for public content" ON public.gallery_hotspots FOR SELECT TO authenticated, anon USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (public._hotspot_mapped_pick_public(mapped_pick_id) AND public._hotspot_designer_public(designer_id, designer_name))));


--
-- Name: product_descriptor_links Public can read visible product descriptor links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read visible product descriptor links" ON public.product_descriptor_links FOR SELECT TO authenticated, anon USING ((((pick_id IS NULL) OR public.pick_is_publicly_visible(pick_id)) AND ((product_id IS NULL) OR public.trade_product_is_publicly_visible(product_id))));


--
-- Name: product_material_links Public can read visible product material links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read visible product material links" ON public.product_material_links FOR SELECT TO authenticated, anon USING ((((pick_id IS NULL) OR public.pick_is_publicly_visible(pick_id)) AND ((product_id IS NULL) OR public.trade_product_is_publicly_visible(product_id))));


--
-- Name: designer_heritage_slides Public can view heritage slides for public designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view heritage slides for public designers" ON public.designer_heritage_slides FOR SELECT TO authenticated, anon USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.designers d
  WHERE ((d.id = designer_heritage_slides.designer_id) AND (COALESCE(d.is_published, false) = true) AND (COALESCE(d.trade_only, false) = false))))));


--
-- Name: designer_instagram_posts Public can view instagram posts for public designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view instagram posts for public designers" ON public.designer_instagram_posts FOR SELECT TO authenticated, anon USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((COALESCE(hidden, false) = false) AND (EXISTS ( SELECT 1
   FROM public.designers d
  WHERE ((d.id = designer_instagram_posts.designer_id) AND (COALESCE(d.is_published, false) = true) AND (COALESCE(d.trade_only, false) = false)))))));


--
-- Name: featured_studios_public Public can view published featured studios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view published featured studios" ON public.featured_studios_public FOR SELECT USING ((is_published = true));


--
-- Name: sitemap_products Public can view sitemap URLs for public products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view sitemap URLs for public products" ON public.sitemap_products FOR SELECT TO authenticated, anon USING (public.is_public_sitemap_product(id));


--
-- Name: designer_curator_picks_public Public can view visible curator picks safe projection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view visible curator picks safe projection" ON public.designer_curator_picks_public FOR SELECT USING (((is_hidden IS NOT TRUE) AND (EXISTS ( SELECT 1
   FROM public.designers d
  WHERE ((d.id = designer_curator_picks_public.designer_id) AND (d.is_published = true) AND (d.trade_only = false))))));


--
-- Name: trade_quote_extras Quote owner manages extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quote owner manages extras" ON public.trade_quote_extras TO authenticated USING (public.owns_trade_quote(auth.uid(), quote_id)) WITH CHECK (public.owns_trade_quote(auth.uid(), quote_id));


--
-- Name: quote_payment_links Quote owners view their payment links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Quote owners view their payment links" ON public.quote_payment_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.trade_quotes q
  WHERE ((q.id = quote_payment_links.quote_id) AND (q.user_id = auth.uid())))));


--
-- Name: trade_custom_request_activity Request owners can view own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Request owners can view own activity" ON public.trade_custom_request_activity FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.trade_custom_requests r
  WHERE ((r.id = trade_custom_request_activity.request_id) AND (r.user_id = auth.uid())))));


--
-- Name: sample_request_audit_log Service role can insert audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert audit log" ON public.sample_request_audit_log FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: notifications Service role can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: public_download_events Service role can insert public download events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert public download events" ON public.public_download_events FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: concierge_rag_traces Service role can insert rag traces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert rag traces" ON public.concierge_rag_traces FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: email_send_log Service role can insert send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert send log" ON public.email_send_log FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: suppressed_emails Service role can insert suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can insert tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: board_recommendations Service role can manage recommendations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage recommendations" ON public.board_recommendations TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_send_state Service role can manage send state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage send state" ON public.email_send_state USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can mark tokens as used; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can read send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read send log" ON public.email_send_log FOR SELECT TO service_role USING (true);


--
-- Name: suppressed_emails Service role can read suppressed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_unsubscribe_tokens Service role can read tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: email_send_log Service role can update send log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update send log" ON public.email_send_log FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: presentation_comments Shared users can insert comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared users can insert comments" ON public.presentation_comments FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.presentation_shares
  WHERE ((presentation_shares.presentation_id = presentation_comments.presentation_id) AND (presentation_shares.shared_with_user_id = auth.uid()))))));


--
-- Name: presentation_comments Shared users can read presentation comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared users can read presentation comments" ON public.presentation_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentation_shares
  WHERE ((presentation_shares.presentation_id = presentation_comments.presentation_id) AND (presentation_shares.shared_with_user_id = auth.uid())))));


--
-- Name: presentation_shares Shared users can view own shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared users can view own shares" ON public.presentation_shares FOR SELECT TO authenticated USING ((shared_with_user_id = auth.uid()));


--
-- Name: presentation_slides Shared users can view shared presentation slides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared users can view shared presentation slides" ON public.presentation_slides FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentation_shares
  WHERE ((presentation_shares.presentation_id = presentation_slides.presentation_id) AND (presentation_shares.shared_with_user_id = auth.uid())))));


--
-- Name: presentations Shared users can view shared presentations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared users can view shared presentations" ON public.presentations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.presentation_shares
  WHERE ((presentation_shares.presentation_id = presentations.id) AND (presentation_shares.shared_with_user_id = auth.uid())))));


--
-- Name: studio_invites Studio admins can view invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio admins can view invites" ON public.studio_invites FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)));


--
-- Name: studio_resale_certificates Studio admins manage resale certs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio admins manage resale certs" ON public.studio_resale_certificates TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_studio_role(auth.uid(), studio_id, 'admin'::public.studio_role)));


--
-- Name: cad_documents Studio editors can delete cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors can delete cad documents" ON public.cad_documents FOR DELETE TO authenticated USING ((((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((studio_id IS NULL) AND (uploaded_by = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))));


--
-- Name: client_documents Studio editors can delete client documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors can delete client documents" ON public.client_documents FOR DELETE USING (public.can_edit_studio(auth.uid(), studio_id));


--
-- Name: client_documents Studio editors can insert client documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors can insert client documents" ON public.client_documents FOR INSERT WITH CHECK ((public.can_edit_studio(auth.uid(), studio_id) AND (created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_documents.client_id) AND (c.studio_id = client_documents.studio_id))))));


--
-- Name: cad_documents Studio editors can update cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors can update cad documents" ON public.cad_documents FOR UPDATE TO authenticated USING ((((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((studio_id IS NULL) AND (uploaded_by = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))))) WITH CHECK ((((studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((studio_id IS NULL) AND (uploaded_by = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))));


--
-- Name: client_documents Studio editors can update client documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors can update client documents" ON public.client_documents FOR UPDATE USING (public.can_edit_studio(auth.uid(), studio_id)) WITH CHECK (public.can_edit_studio(auth.uid(), studio_id));


--
-- Name: clients Studio editors delete clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors delete clients" ON public.clients FOR DELETE TO authenticated USING (public.can_edit_studio(auth.uid(), studio_id));


--
-- Name: client_contacts Studio editors delete contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors delete contacts" ON public.client_contacts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_contacts.client_id) AND public.can_edit_studio(auth.uid(), c.studio_id)))));


--
-- Name: clients Studio editors insert clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ((public.can_edit_studio(auth.uid(), studio_id) AND (created_by = auth.uid())));


--
-- Name: client_contacts Studio editors insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors insert contacts" ON public.client_contacts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_contacts.client_id) AND public.can_edit_studio(auth.uid(), c.studio_id)))));


--
-- Name: clients Studio editors update clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors update clients" ON public.clients FOR UPDATE TO authenticated USING (public.can_edit_studio(auth.uid(), studio_id)) WITH CHECK (public.can_edit_studio(auth.uid(), studio_id));


--
-- Name: client_contacts Studio editors update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors update contacts" ON public.client_contacts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_contacts.client_id) AND public.can_edit_studio(auth.uid(), c.studio_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_contacts.client_id) AND public.can_edit_studio(auth.uid(), c.studio_id)))));


--
-- Name: clients Studio editors view clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors view clients" ON public.clients FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_edit_studio(auth.uid(), studio_id)));


--
-- Name: client_contacts Studio editors view contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio editors view contacts" ON public.client_contacts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.clients c
  WHERE ((c.id = client_contacts.client_id) AND public.can_edit_studio(auth.uid(), c.studio_id)))));


--
-- Name: cad_documents Studio members can insert cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio members can insert cad documents" ON public.cad_documents FOR INSERT TO authenticated WITH CHECK (((uploaded_by = auth.uid()) AND (((studio_id IS NULL) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) OR ((studio_id IS NOT NULL) AND public.can_view_studio(auth.uid(), studio_id)))));


--
-- Name: cad_documents Studio members can view cad documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio members can view cad documents" ON public.cad_documents FOR SELECT TO authenticated USING ((((studio_id IS NOT NULL) AND public.can_view_studio(auth.uid(), studio_id)) OR (uploaded_by = auth.uid())));


--
-- Name: client_documents Studio members can view client documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio members can view client documents" ON public.client_documents FOR SELECT USING ((public.can_view_studio(auth.uid(), studio_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: studio_resale_certificates Studio members read resale certs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Studio members read resale certs" ON public.studio_resale_certificates FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_view_studio(auth.uid(), studio_id)));


--
-- Name: collectible_overrides Trade and admin can read collectible overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade and admin can read collectible overrides" ON public.collectible_overrides FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: descriptor_taxonomy Trade and admin can read descriptor taxonomy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade and admin can read descriptor taxonomy" ON public.descriptor_taxonomy FOR SELECT TO authenticated USING ((((is_active = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: material_taxonomy Trade and admin can read material taxonomy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade and admin can read material taxonomy" ON public.material_taxonomy FOR SELECT TO authenticated USING (((is_active = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: fabrics Trade users and admins can read active fabric pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users and admins can read active fabric pricing" ON public.fabrics FOR SELECT TO authenticated USING (((is_active = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));


--
-- Name: product_fabrics Trade users and admins can read product fabric pricing links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users and admins can read product fabric pricing links" ON public.product_fabrics FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: trade_product_glb_variants Trade users and admins can view GLB variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users and admins can view GLB variants" ON public.trade_product_glb_variants FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: brand_thumbnails Trade users and admins can view brand thumbnails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users and admins can view brand thumbnails" ON public.brand_thumbnails FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'trade_user'::public.app_role)));


--
-- Name: section_heroes Trade users and admins can view section heroes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users and admins can view section heroes" ON public.section_heroes FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'trade_user'::public.app_role)));


--
-- Name: axonometric_requests Trade users can manage own axonometric requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own axonometric requests" ON public.axonometric_requests TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: client_boards Trade users can manage own boards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own boards" ON public.client_boards TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: projects Trade users can manage own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own projects" ON public.projects TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_quote_items Trade users can manage own quote items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own quote items" ON public.trade_quote_items TO authenticated USING ((public.owns_trade_quote(auth.uid(), quote_id) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK ((public.owns_trade_quote(auth.uid(), quote_id) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_quotes Trade users can manage own quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own quotes" ON public.trade_quotes TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_sample_requests Trade users can manage own sample requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can manage own sample requests" ON public.trade_sample_requests TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_product_cad_assets Trade users can view active CAD assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view active CAD assets" ON public.trade_product_cad_assets FOR SELECT TO authenticated USING (((is_active = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: material_swatches Trade users can view active swatches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view active swatches" ON public.material_swatches FOR SELECT TO authenticated USING (((is_active = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: auction_benchmarks Trade users can view auction benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view auction benchmarks" ON public.auction_benchmarks FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: product_cad_asset_geometry Trade users can view cad geometry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view cad geometry" ON public.product_cad_asset_geometry FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_documents Trade users can view documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view documents" ON public.trade_documents FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: order_duration_templates Trade users can view duration templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view duration templates" ON public.order_duration_templates FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: order_timeline Trade users can view own order timelines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view own order timelines" ON public.order_timeline FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: cpd_events Trade users can view published CPD events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view published CPD events" ON public.cpd_events FOR SELECT TO authenticated USING (((is_published = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: axonometric_gallery Trade users can view published axonometric gallery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view published axonometric gallery" ON public.axonometric_gallery FOR SELECT TO authenticated USING (((is_published = true) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: designers Trade users can view published designers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users can view published designers" ON public.designers FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) AND (is_published = true)));


--
-- Name: shipping_quotes Trade users manage own shipping quotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users manage own shipping quotes" ON public.shipping_quotes TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: shipping_duty_rates Trade users read duty rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users read duty rates" ON public.shipping_duty_rates FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: shipping_rate_brackets Trade users read rate brackets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users read rate brackets" ON public.shipping_rate_brackets FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: shipping_lanes Trade users read shipping lanes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users read shipping lanes" ON public.shipping_lanes FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: shipping_surcharges Trade users read surcharges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users read surcharges" ON public.shipping_surcharges FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: brand_lead_times Trade users view brand lead times; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trade users view brand lead times" ON public.brand_lead_times FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: client_boards Update boards (editor+ on project or studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update boards (editor+ on project or studio)" ON public.client_boards FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: trade_custom_requests Update custom requests (editor+ on project or studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update custom requests (editor+ on project or studio)" ON public.trade_custom_requests FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: trade_quotes Update quotes (editor+ on project or studio, or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update quotes (editor+ on project or studio, or platform admin)" ON public.trade_quotes FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: order_timeline Update timelines (editor+ on project or studio); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update timelines (editor+ on project or studio)" ON public.order_timeline FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.can_edit_studio(auth.uid(), studio_id)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: shop_orders Users attach receipt to own order; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users attach receipt to own order" ON public.shop_orders FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: axonometric_gallery Users can delete own gallery drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own gallery drafts" ON public.axonometric_gallery FOR DELETE TO authenticated USING (((created_by = auth.uid()) AND (is_published = false) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: cad_asset_downloads Users can insert own CAD downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own CAD downloads" ON public.cad_asset_downloads FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_applications Users can insert own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own applications" ON public.trade_applications FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: document_downloads Users can insert own downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own downloads" ON public.document_downloads FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: axonometric_gallery Users can insert own gallery drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own gallery drafts" ON public.axonometric_gallery FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (is_published = false) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = id) AND (trade_tier IS NULL) AND (trade_tier_suggested IS NULL) AND (COALESCE(trade_tier_locked_by_admin, false) = false) AND (trade_tier_12mo_spend_cents IS NULL) AND (trade_tier_computed_at IS NULL) AND (COALESCE(trade_status, 'pending_review'::text) = 'pending_review'::text)));


--
-- Name: markup_annotations Users can manage own annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own annotations" ON public.markup_annotations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: cpd_attendance Users can manage own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own attendance" ON public.cpd_attendance TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: trade_favorites Users can manage own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own favorites" ON public.trade_favorites TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: room_planner_projects Users can manage own planner projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own planner projects" ON public.room_planner_projects TO authenticated USING (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((user_id = auth.uid()) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: trade_applications Users can read own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own applications" ON public.trade_applications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users can read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: client_taste_profiles Users can read own taste profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own taste profile" ON public.client_taste_profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: axonometric_gallery Users can update own gallery drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own gallery drafts" ON public.axonometric_gallery FOR UPDATE TO authenticated USING (((created_by = auth.uid()) AND (is_published = false) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)))) WITH CHECK (((created_by = auth.uid()) AND (is_published = false) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile (non-privileged columns only); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile (non-privileged columns only)" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND public.profile_privileged_fields_unchanged(id, trade_tier, trade_tier_suggested, trade_tier_locked_by_admin, trade_tier_12mo_spend_cents, trade_tier_computed_at, trade_status)));


--
-- Name: cad_asset_downloads Users can view own CAD downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own CAD downloads" ON public.cad_asset_downloads FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: trade_concierge_usage Users can view own concierge usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own concierge usage" ON public.trade_concierge_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: document_downloads Users can view own downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own downloads" ON public.document_downloads FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: axonometric_gallery Users can view own gallery drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own gallery drafts" ON public.axonometric_gallery FOR SELECT TO authenticated USING (((created_by = auth.uid()) AND (is_published = false)));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ((customer_email IS NOT NULL) AND (lower(customer_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: collector_applications Users create own collector application; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create own collector application" ON public.collector_applications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (status = 'pending'::text)));


--
-- Name: trade_custom_requests Users create their own custom requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create their own custom requests" ON public.trade_custom_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: brief_drafts Users delete own brief draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own brief draft" ON public.brief_drafts FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: trade_custom_requests Users delete their own custom requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete their own custom requests" ON public.trade_custom_requests FOR DELETE USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: brief_drafts Users insert own brief draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own brief draft" ON public.brief_drafts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_concierge_escalations Users insert own escalations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own escalations" ON public.trade_concierge_escalations FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: trade_concierge_actions Users insert their own concierge actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert their own concierge actions" ON public.trade_concierge_actions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));


--
-- Name: cad_fit_edit_audit Users insert their own fit edit audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert their own fit edit audit" ON public.cad_fit_edit_audit FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (public.has_role(auth.uid(), 'trade_user'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: concierge_threads Users manage own concierge threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own concierge threads" ON public.concierge_threads TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_recent_views Users manage own recent views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own recent views" ON public.trade_recent_views TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: concierge_sessions Users manage their own concierge session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own concierge session" ON public.concierge_sessions TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users manage their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own push subscriptions" ON public.push_subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: studio_alerts Users mark their own alerts read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users mark their own alerts read" ON public.studio_alerts FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: brief_drafts Users read own brief draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own brief draft" ON public.brief_drafts FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: trade_concierge_escalations Users read own escalations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own escalations" ON public.trade_concierge_escalations FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: studio_alerts Users read their own alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their own alerts" ON public.studio_alerts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: cad_fit_edit_audit Users read their own fit edit audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read their own fit edit audit" ON public.cad_fit_edit_audit FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: trade_concierge_actions Users see their own concierge actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see their own concierge actions" ON public.trade_concierge_actions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: brief_drafts Users update own brief draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own brief draft" ON public.brief_drafts FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_custom_requests Users update their own custom requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update their own custom requests" ON public.trade_custom_requests FOR UPDATE USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: collector_applications Users view own collector application; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own collector application" ON public.collector_applications FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: trade_custom_requests Users view their own custom requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view their own custom requests" ON public.trade_custom_requests FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: shop_order_items Users view their own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view their own order items" ON public.shop_order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.shop_orders o
  WHERE ((o.id = shop_order_items.order_id) AND ((o.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: shop_orders Users view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view their own orders" ON public.shop_orders FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: client_board_items View board items (studio + project access); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View board items (studio + project access)" ON public.client_board_items FOR SELECT TO authenticated USING (public.can_view_client_board(auth.uid(), board_id));


--
-- Name: client_boards View boards (studio + project access); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View boards (studio + project access)" ON public.client_boards FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.has_studio_role(auth.uid(), studio_id, 'editor'::public.studio_role)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: trade_custom_requests View custom requests (studio + project access); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View custom requests (studio + project access)" ON public.trade_custom_requests FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR ((project_id IS NOT NULL) AND public.can_view_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (studio_id IS NOT NULL) AND public.can_view_studio(auth.uid(), studio_id)) OR ((project_id IS NULL) AND (studio_id IS NULL) AND (user_id = auth.uid()))));


--
-- Name: projects View projects (studio members + admins); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View projects (studio members + admins)" ON public.projects FOR SELECT USING (public.can_view_project(auth.uid(), id));


--
-- Name: quote_email_log View quote email log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View quote email log" ON public.quote_email_log FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.trade_quotes q
  WHERE ((q.id = quote_email_log.quote_id) AND (q.user_id = auth.uid()))))));


--
-- Name: trade_quotes View quotes (owner, project editor, or admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View quotes (owner, project editor, or admin)" ON public.trade_quotes FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid()) OR ((project_id IS NOT NULL) AND public.can_edit_project(auth.uid(), project_id))));


--
-- Name: order_timeline View timelines (owner or platform admin); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View timelines (owner or platform admin)" ON public.order_timeline FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: abandoned_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_alert_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_alert_log ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_user_memory admins read all memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read all memory" ON public.trade_user_memory FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: favorite_folder_items admins read folder items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read folder items" ON public.favorite_folder_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: favorite_folders admins read folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read folders" ON public.favorite_folders FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_model_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_response_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_response_cache ai_response_cache_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_response_cache_admin_read ON public.ai_response_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_semantic_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_semantic_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_semantic_cache ai_semantic_cache_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_semantic_cache_admin_read ON public.ai_semantic_cache FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: auction_benchmarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auction_benchmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: axonometric_cad_qa axo_cad_qa admins read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "axo_cad_qa admins read all" ON public.axonometric_cad_qa FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: axonometric_cad_qa axo_cad_qa owner reads own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "axo_cad_qa owner reads own" ON public.axonometric_cad_qa FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: axonometric_cad_qa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.axonometric_cad_qa ENABLE ROW LEVEL SECURITY;

--
-- Name: axonometric_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.axonometric_gallery ENABLE ROW LEVEL SECURITY;

--
-- Name: axonometric_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.axonometric_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: board_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.board_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_lead_times; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_lead_times ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_thumbnails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_thumbnails ENABLE ROW LEVEL SECURITY;

--
-- Name: brief_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brief_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: cad_asset_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cad_asset_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: cad_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cad_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: cad_fit_edit_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cad_fit_edit_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: cad_fit_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cad_fit_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: client_board_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_board_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: client_board_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_board_items ENABLE ROW LEVEL SECURITY;

--
-- Name: client_boards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_boards ENABLE ROW LEVEL SECURITY;

--
-- Name: client_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: client_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: client_taste_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_taste_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: cn_director_briefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cn_director_briefs ENABLE ROW LEVEL SECURITY;

--
-- Name: collectible_atelier_gallery; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collectible_atelier_gallery ENABLE ROW LEVEL SECURITY;

--
-- Name: collectible_atelier_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collectible_atelier_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: collectible_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collectible_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: collector_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collector_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_designers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitor_designers ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_galleries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitor_galleries ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_traffic; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitor_traffic ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_rag_traces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_rag_traces ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_roster_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_roster_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_stream_frames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_stream_frames ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_stream_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_stream_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concierge_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: content_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: cpd_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cpd_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: cpd_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cpd_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_http_call_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_http_call_log ENABLE ROW LEVEL SECURITY;

--
-- Name: curated_drops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curated_drops ENABLE ROW LEVEL SECURITY;

--
-- Name: curated_drops curated_drops_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY curated_drops_admin_write ON public.curated_drops TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: curated_drops curated_drops_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY curated_drops_read ON public.curated_drops FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: currency_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: descriptor_taxonomy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.descriptor_taxonomy ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_curator_picks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_curator_picks ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_curator_picks_public; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_curator_picks_public ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_heritage_slides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_heritage_slides ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_instagram_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_instagram_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: designer_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designer_purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: designers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designers ENABLE ROW LEVEL SECURITY;

--
-- Name: document_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: email_click_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_click_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

--
-- Name: email_unsubscribe_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: fabrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fabrics ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_folder_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_folder_items ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorite_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_studios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.featured_studios ENABLE ROW LEVEL SECURITY;

--
-- Name: featured_studios_public; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.featured_studios_public ENABLE ROW LEVEL SECURITY;

--
-- Name: ffe_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ffe_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_card_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_card_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_reminder_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_reminder_log ENABLE ROW LEVEL SECURITY;

--
-- Name: funnel_reminder_pauses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funnel_reminder_pauses ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_hotspots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_hotspots ENABLE ROW LEVEL SECURITY;

--
-- Name: guardrail_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guardrail_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_views ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_job_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingestion_job_state ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingestion_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_pipeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_pipeline ENABLE ROW LEVEL SECURITY;

--
-- Name: magazine_badge_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.magazine_badge_events ENABLE ROW LEVEL SECURITY;

--
-- Name: markup_annotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.markup_annotations ENABLE ROW LEVEL SECURITY;

--
-- Name: material_swatches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_swatches ENABLE ROW LEVEL SECURITY;

--
-- Name: material_taxonomy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_taxonomy ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_click_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_click_log ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_query_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_query_log ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: og_rescrape_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.og_rescrape_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_flow_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_flow_config ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_tour_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_tour_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: order_duration_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_duration_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: order_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;

--
-- Name: order_timeline_commission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_timeline_commission ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_folder_items owner delete folder items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner delete folder items" ON public.favorite_folder_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.favorite_folders f
  WHERE ((f.id = favorite_folder_items.folder_id) AND (f.user_id = auth.uid())))));


--
-- Name: favorite_folders owner delete folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner delete folders" ON public.favorite_folders FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: favorite_folder_items owner insert folder items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner insert folder items" ON public.favorite_folder_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.favorite_folders f
  WHERE ((f.id = favorite_folder_items.folder_id) AND (f.user_id = auth.uid())))));


--
-- Name: favorite_folders owner insert folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner insert folders" ON public.favorite_folders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_credits owner read credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner read credits" ON public.trade_credits FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ffe_entitlements owner read entitlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner read entitlements" ON public.ffe_entitlements FOR SELECT USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: favorite_folder_items owner read folder items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner read folder items" ON public.favorite_folder_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.favorite_folders f
  WHERE ((f.id = favorite_folder_items.folder_id) AND (f.user_id = auth.uid())))));


--
-- Name: favorite_folders owner read folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner read folders" ON public.favorite_folders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: favorite_folder_items owner update folder items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner update folder items" ON public.favorite_folder_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.favorite_folders f
  WHERE ((f.id = favorite_folder_items.folder_id) AND (f.user_id = auth.uid())))));


--
-- Name: favorite_folders owner update folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner update folders" ON public.favorite_folders FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: trade_floor_plans owners delete floor plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners delete floor plans" ON public.trade_floor_plans FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_floor_plan_layouts owners delete layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners delete layouts" ON public.trade_floor_plan_layouts FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_floor_plans owners insert floor plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners insert floor plans" ON public.trade_floor_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_floor_plan_layouts owners insert layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners insert layouts" ON public.trade_floor_plan_layouts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_floor_plans owners update floor plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners update floor plans" ON public.trade_floor_plans FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_floor_plan_layouts owners update layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners update layouts" ON public.trade_floor_plan_layouts FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_floor_plans owners view floor plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners view floor plans" ON public.trade_floor_plans FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: trade_floor_plan_layouts owners view layouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners view layouts" ON public.trade_floor_plan_layouts FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: payment_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: personal_email_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personal_email_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: presentation_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presentation_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: presentation_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presentation_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: presentation_slides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presentation_slides ENABLE ROW LEVEL SECURITY;

--
-- Name: presentations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

--
-- Name: product_cad_asset_geometry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_cad_asset_geometry ENABLE ROW LEVEL SECURITY;

--
-- Name: product_descriptor_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_descriptor_links ENABLE ROW LEVEL SECURITY;

--
-- Name: product_fabric_swatches_public; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_fabric_swatches_public ENABLE ROW LEVEL SECURITY;

--
-- Name: product_fabrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_fabrics ENABLE ROW LEVEL SECURITY;

--
-- Name: product_material_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_material_links ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: provenance_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provenance_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: provenance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provenance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: public_download_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_download_events ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders_payable; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders_payable ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_payment_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_payment_links ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: reference_styles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reference_styles ENABLE ROW LEVEL SECURITY;

--
-- Name: regional_logistics_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regional_logistics_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: regional_logistics_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regional_logistics_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: regional_logistics_rules regional_rules_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_rules_admin_write ON public.regional_logistics_rules TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: regional_logistics_rules regional_rules_trade_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_rules_trade_admin_read ON public.regional_logistics_rules FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'trade_user'::public.app_role)));


--
-- Name: regional_logistics_tiers regional_tiers_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_tiers_admin_write ON public.regional_logistics_tiers TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: regional_logistics_tiers regional_tiers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY regional_tiers_read ON public.regional_logistics_tiers FOR SELECT TO authenticated USING (true);


--
-- Name: room_planner_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_planner_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: sample_request_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sample_request_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: scrape_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrape_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: scrape_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: section_heroes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.section_heroes ENABLE ROW LEVEL SECURITY;

--
-- Name: security_alert_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_alert_state ENABLE ROW LEVEL SECURITY;

--
-- Name: security_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: concierge_rate_limits service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_only ON public.concierge_rate_limits TO service_role USING (true) WITH CHECK (true);


--
-- Name: shipping_duty_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_duty_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_lanes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_lanes ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_rate_brackets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_rate_brackets ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_surcharges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_surcharges ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: sitemap_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sitemap_products ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_lead_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_lead_events ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_payout_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_payout_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_project_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_project_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_resale_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_resale_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: studios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppressed_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: tour_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tour_events ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_concierge_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_concierge_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_concierge_escalations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_concierge_escalations ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_concierge_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_concierge_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_custom_request_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_custom_request_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_custom_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_custom_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_fair_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_fair_events ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_floor_plan_layouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_floor_plan_layouts ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_floor_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_floor_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_product_cad_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_product_cad_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_product_glb_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_product_glb_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_product_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_product_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_products ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_program_signups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_program_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_quote_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_quote_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_quote_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_recent_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_recent_views ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_sample_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_sample_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_tier_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_tier_config ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_user_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_user_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_user_memory users delete own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own memory" ON public.trade_user_memory FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: trade_user_memory users insert own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own memory" ON public.trade_user_memory FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: trade_user_memory users read own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own memory" ON public.trade_user_memory FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trade_user_memory users update own memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own memory" ON public.trade_user_memory FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: verification_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_feedback_loops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_feedback_loops ENABLE ROW LEVEL SECURITY;

--
-- Name: video_watch_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_delivery_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_delivery_events ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION _hotspot_designer_public(_designer_id uuid, _designer_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._hotspot_designer_public(_designer_id uuid, _designer_name text) TO anon;
GRANT ALL ON FUNCTION public._hotspot_designer_public(_designer_id uuid, _designer_name text) TO authenticated;
GRANT ALL ON FUNCTION public._hotspot_designer_public(_designer_id uuid, _designer_name text) TO service_role;


--
-- Name: FUNCTION _hotspot_mapped_pick_public(_pick_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._hotspot_mapped_pick_public(_pick_id uuid) TO anon;
GRANT ALL ON FUNCTION public._hotspot_mapped_pick_public(_pick_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public._hotspot_mapped_pick_public(_pick_id uuid) TO service_role;


--
-- Name: FUNCTION _norm_designer_name(txt text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._norm_designer_name(txt text) TO anon;
GRANT ALL ON FUNCTION public._norm_designer_name(txt text) TO authenticated;
GRANT ALL ON FUNCTION public._norm_designer_name(txt text) TO service_role;


--
-- Name: FUNCTION accept_studio_invite(_invite_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_studio_invite(_invite_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_studio_invite(_invite_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_studio_invite(_invite_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_studio_invite(_invite_id uuid) TO service_role;


--
-- Name: FUNCTION acquire_ingestion_lease(_owner text, _minutes integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acquire_ingestion_lease(_owner text, _minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acquire_ingestion_lease(_owner text, _minutes integer) TO service_role;


--
-- Name: FUNCTION add_board_comment_by_token(_token text, _board_id uuid, _content text, _author_name text, _is_client boolean, _item_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_board_comment_by_token(_token text, _board_id uuid, _content text, _author_name text, _is_client boolean, _item_id uuid) TO anon;
GRANT ALL ON FUNCTION public.add_board_comment_by_token(_token text, _board_id uuid, _content text, _author_name text, _is_client boolean, _item_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.add_board_comment_by_token(_token text, _board_id uuid, _content text, _author_name text, _is_client boolean, _item_id uuid) TO service_role;


--
-- Name: FUNCTION add_gallery_product_to_quote(_user_id uuid, _quote_id uuid, _product_name text, _brand_name text, _category text, _image_url text, _dimensions text, _materials text, _quantity integer, _variant_label text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_gallery_product_to_quote(_user_id uuid, _quote_id uuid, _product_name text, _brand_name text, _category text, _image_url text, _dimensions text, _materials text, _quantity integer, _variant_label text) TO anon;
GRANT ALL ON FUNCTION public.add_gallery_product_to_quote(_user_id uuid, _quote_id uuid, _product_name text, _brand_name text, _category text, _image_url text, _dimensions text, _materials text, _quantity integer, _variant_label text) TO authenticated;
GRANT ALL ON FUNCTION public.add_gallery_product_to_quote(_user_id uuid, _quote_id uuid, _product_name text, _brand_name text, _category text, _image_url text, _dimensions text, _materials text, _quantity integer, _variant_label text) TO service_role;


--
-- Name: FUNCTION add_studio_creator_member(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_studio_creator_member() FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_studio_creator_member() TO service_role;


--
-- Name: FUNCTION admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.admin_ai_usage_summary(_from timestamp with time zone, _to timestamp with time zone) TO service_role;


--
-- Name: FUNCTION admin_onboarding_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_onboarding_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_onboarding_stats() TO service_role;


--
-- Name: FUNCTION admin_reset_onboarding_for_user(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_reset_onboarding_for_user(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_reset_onboarding_for_user(_user_id uuid) TO service_role;


--
-- Name: FUNCTION apply_available_credit_to_quote(_quote_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_available_credit_to_quote(_quote_id uuid) TO anon;
GRANT ALL ON FUNCTION public.apply_available_credit_to_quote(_quote_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.apply_available_credit_to_quote(_quote_id uuid) TO service_role;


--
-- Name: FUNCTION apply_regional_trade_multipliers(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_regional_trade_multipliers() TO anon;
GRANT ALL ON FUNCTION public.apply_regional_trade_multipliers() TO authenticated;
GRANT ALL ON FUNCTION public.apply_regional_trade_multipliers() TO service_role;


--
-- Name: FUNCTION auto_accept_studio_invites(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_accept_studio_invites() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_accept_studio_invites() TO service_role;


--
-- Name: FUNCTION auto_assign_admin_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_assign_admin_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_assign_admin_role() TO service_role;


--
-- Name: FUNCTION bridge_concierge_lead_to_inquiry(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.bridge_concierge_lead_to_inquiry() TO anon;
GRANT ALL ON FUNCTION public.bridge_concierge_lead_to_inquiry() TO authenticated;
GRANT ALL ON FUNCTION public.bridge_concierge_lead_to_inquiry() TO service_role;


--
-- Name: FUNCTION can_edit_project(_user_id uuid, _project_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid) TO service_role;


--
-- Name: FUNCTION can_edit_studio(_user_id uuid, _studio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid) TO anon;


--
-- Name: FUNCTION can_view_client_board(_user_id uuid, _board_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_view_client_board(_user_id uuid, _board_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_client_board(_user_id uuid, _board_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_client_board(_user_id uuid, _board_id uuid) TO service_role;


--
-- Name: FUNCTION can_view_project(_user_id uuid, _project_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_view_project(_user_id uuid, _project_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_project(_user_id uuid, _project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_project(_user_id uuid, _project_id uuid) TO service_role;


--
-- Name: FUNCTION can_view_studio(_user_id uuid, _studio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid) TO anon;


--
-- Name: TABLE webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.webhook_events TO anon;
GRANT ALL ON TABLE public.webhook_events TO authenticated;
GRANT ALL ON TABLE public.webhook_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.webhook_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.webhook_events TO sandbox_exec;


--
-- Name: FUNCTION claim_webhook_events(batch_size integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.claim_webhook_events(batch_size integer) TO anon;
GRANT ALL ON FUNCTION public.claim_webhook_events(batch_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_webhook_events(batch_size integer) TO service_role;


--
-- Name: FUNCTION cn_director_briefs_validate_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cn_director_briefs_validate_status() TO anon;
GRANT ALL ON FUNCTION public.cn_director_briefs_validate_status() TO authenticated;
GRANT ALL ON FUNCTION public.cn_director_briefs_validate_status() TO service_role;


--
-- Name: FUNCTION compute_curator_pick_slug(_title text, _subtitle text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_curator_pick_slug(_title text, _subtitle text) TO anon;
GRANT ALL ON FUNCTION public.compute_curator_pick_slug(_title text, _subtitle text) TO authenticated;
GRANT ALL ON FUNCTION public.compute_curator_pick_slug(_title text, _subtitle text) TO service_role;


--
-- Name: FUNCTION concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer) TO anon;
GRANT ALL ON FUNCTION public.concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer) TO authenticated;
GRANT ALL ON FUNCTION public.concierge_check_rate_limit(_key text, _limit integer, _window_seconds integer) TO service_role;


--
-- Name: FUNCTION current_trade_discount_pct(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_trade_discount_pct() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_trade_discount_pct() TO authenticated;
GRANT ALL ON FUNCTION public.current_trade_discount_pct() TO service_role;


--
-- Name: FUNCTION deactivate_orphaned_trade_product(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.deactivate_orphaned_trade_product() TO anon;
GRANT ALL ON FUNCTION public.deactivate_orphaned_trade_product() TO authenticated;
GRANT ALL ON FUNCTION public.deactivate_orphaned_trade_product() TO service_role;


--
-- Name: FUNCTION delete_email(queue_name text, message_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_email(queue_name text, message_id bigint) TO service_role;


--
-- Name: FUNCTION effective_product_availability(_product_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.effective_product_availability(_product_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.effective_product_availability(_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.effective_product_availability(_product_id uuid) TO service_role;


--
-- Name: FUNCTION effective_project_role(_user_id uuid, _project_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.effective_project_role(_user_id uuid, _project_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.effective_project_role(_user_id uuid, _project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.effective_project_role(_user_id uuid, _project_id uuid) TO service_role;


--
-- Name: FUNCTION email_queue_dispatch(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO anon;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO authenticated;
GRANT ALL ON FUNCTION public.email_queue_dispatch() TO service_role;


--
-- Name: FUNCTION email_queue_wake(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_queue_wake() TO anon;
GRANT ALL ON FUNCTION public.email_queue_wake() TO authenticated;
GRANT ALL ON FUNCTION public.email_queue_wake() TO service_role;


--
-- Name: FUNCTION enforce_analytics_rate_limit(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_analytics_rate_limit() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_analytics_rate_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_analytics_rate_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_analytics_rate_limit() TO service_role;


--
-- Name: FUNCTION enforce_concierge_lead_rate_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_concierge_lead_rate_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_concierge_lead_rate_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_concierge_lead_rate_limit() TO service_role;


--
-- Name: FUNCTION enqueue_email(queue_name text, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_email(queue_name text, payload jsonb) TO service_role;


--
-- Name: FUNCTION fanout_supply_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fanout_supply_change() TO anon;
GRANT ALL ON FUNCTION public.fanout_supply_change() TO authenticated;
GRANT ALL ON FUNCTION public.fanout_supply_change() TO service_role;


--
-- Name: FUNCTION flag_unexpected_storage_write(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.flag_unexpected_storage_write() TO anon;
GRANT ALL ON FUNCTION public.flag_unexpected_storage_write() TO authenticated;
GRANT ALL ON FUNCTION public.flag_unexpected_storage_write() TO service_role;


--
-- Name: FUNCTION gallery_hotspots_resolve_designer(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.gallery_hotspots_resolve_designer() TO anon;
GRANT ALL ON FUNCTION public.gallery_hotspots_resolve_designer() TO authenticated;
GRANT ALL ON FUNCTION public.gallery_hotspots_resolve_designer() TO service_role;


--
-- Name: FUNCTION get_admin_user_ids(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_user_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_user_ids() TO service_role;


--
-- Name: FUNCTION get_board_by_token(_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_board_by_token(_token text) TO anon;
GRANT ALL ON FUNCTION public.get_board_by_token(_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_board_by_token(_token text) TO service_role;


--
-- Name: FUNCTION get_board_client_email(_board_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_board_client_email(_board_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_board_client_email(_board_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_board_client_email(_board_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_board_client_email(_board_id uuid) TO service_role;


--
-- Name: FUNCTION get_board_comments_by_token(_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_board_comments_by_token(_token text) TO anon;
GRANT ALL ON FUNCTION public.get_board_comments_by_token(_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_board_comments_by_token(_token text) TO service_role;


--
-- Name: FUNCTION get_board_items_by_token(_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_board_items_by_token(_token text) TO anon;
GRANT ALL ON FUNCTION public.get_board_items_by_token(_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_board_items_by_token(_token text) TO service_role;


--
-- Name: FUNCTION get_brand_engagement_users(_brand_name text, _since timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_brand_engagement_users(_brand_name text, _since timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_brand_engagement_users(_brand_name text, _since timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_client_contacts_safe(_client_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_client_contacts_safe(_client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_client_contacts_safe(_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_contacts_safe(_client_id uuid) TO service_role;


--
-- Name: FUNCTION get_cron_jobs_summary(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_cron_jobs_summary() TO anon;
GRANT ALL ON FUNCTION public.get_cron_jobs_summary() TO authenticated;
GRANT ALL ON FUNCTION public.get_cron_jobs_summary() TO service_role;


--
-- Name: FUNCTION get_cron_run_history(_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_cron_run_history(_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_cron_run_history(_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_cron_run_history(_limit integer) TO service_role;


--
-- Name: FUNCTION get_currency_rate(_base text, _target text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_currency_rate(_base text, _target text) TO anon;
GRANT ALL ON FUNCTION public.get_currency_rate(_base text, _target text) TO authenticated;
GRANT ALL ON FUNCTION public.get_currency_rate(_base text, _target text) TO service_role;


--
-- Name: FUNCTION get_designer_engagement(_since timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_designer_engagement(_since timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_designer_engagement(_since timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_designer_for_upload(_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_designer_for_upload(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_designer_for_upload(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_designer_for_upload(_slug text) TO service_role;


--
-- Name: FUNCTION get_my_board_share_token(_board_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_board_share_token(_board_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_my_board_share_token(_board_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_board_share_token(_board_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_pending_invites(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_pending_invites() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_pending_invites() TO anon;
GRANT ALL ON FUNCTION public.get_my_pending_invites() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_pending_invites() TO service_role;


--
-- Name: FUNCTION get_my_phone(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_phone() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_phone() TO anon;
GRANT ALL ON FUNCTION public.get_my_phone() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_phone() TO service_role;


--
-- Name: FUNCTION get_recent_scrape_failures(since_minutes integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_recent_scrape_failures(since_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_recent_scrape_failures(since_minutes integer) TO anon;
GRANT ALL ON FUNCTION public.get_recent_scrape_failures(since_minutes integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_recent_scrape_failures(since_minutes integer) TO service_role;


--
-- Name: FUNCTION get_studio_contact_email(_studio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_studio_contact_email(_studio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_studio_contact_email(_studio_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_studio_contact_email(_studio_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_studio_contact_email(_studio_id uuid) TO service_role;


--
-- Name: FUNCTION get_studio_payout_accounts(_studio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_studio_payout_accounts(_studio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_studio_payout_accounts(_studio_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_studio_payout_accounts(_studio_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_studio_payout_accounts(_studio_id uuid) TO service_role;


--
-- Name: FUNCTION get_trade_only_collectible_slugs(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_trade_only_collectible_slugs() TO anon;
GRANT ALL ON FUNCTION public.get_trade_only_collectible_slugs() TO authenticated;
GRANT ALL ON FUNCTION public.get_trade_only_collectible_slugs() TO service_role;


--
-- Name: FUNCTION get_user_studio_ids(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_studio_ids(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_studio_ids(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_studio_ids(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_studio_ids(_user_id uuid) TO anon;


--
-- Name: FUNCTION grant_collector_role_on_approve(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.grant_collector_role_on_approve() TO anon;
GRANT ALL ON FUNCTION public.grant_collector_role_on_approve() TO authenticated;
GRANT ALL ON FUNCTION public.grant_collector_role_on_approve() TO service_role;


--
-- Name: FUNCTION guard_shop_order_buyer_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_shop_order_buyer_update() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_shop_order_buyer_update() TO service_role;


--
-- Name: FUNCTION handle_new_trade_signup(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_trade_signup() TO anon;
GRANT ALL ON FUNCTION public.handle_new_trade_signup() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_trade_signup() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;


--
-- Name: FUNCTION has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role) TO service_role;
GRANT ALL ON FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role) TO anon;


--
-- Name: FUNCTION has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role) TO anon;
GRANT ALL ON FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role public.studio_role) TO service_role;


--
-- Name: FUNCTION has_verified_access(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_verified_access(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_verified_access(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_verified_access(_user_id uuid) TO service_role;


--
-- Name: FUNCTION invoke_scrape_products_with_retry(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.invoke_scrape_products_with_retry() TO anon;
GRANT ALL ON FUNCTION public.invoke_scrape_products_with_retry() TO authenticated;
GRANT ALL ON FUNCTION public.invoke_scrape_products_with_retry() TO service_role;


--
-- Name: FUNCTION is_approved_trade_user(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_approved_trade_user(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_approved_trade_user(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_approved_trade_user(_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_client_trade_approved(_client_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_client_trade_approved(_client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_client_trade_approved(_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_client_trade_approved(_client_id uuid) TO service_role;


--
-- Name: FUNCTION is_personal_email_domain(_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_personal_email_domain(_email text) TO anon;
GRANT ALL ON FUNCTION public.is_personal_email_domain(_email text) TO authenticated;
GRANT ALL ON FUNCTION public.is_personal_email_domain(_email text) TO service_role;


--
-- Name: FUNCTION is_public_sitemap_product(_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_public_sitemap_product(_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_public_sitemap_product(_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_public_sitemap_product(_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_public_sitemap_product(_id uuid) TO service_role;


--
-- Name: FUNCTION is_studio_owner(_user_id uuid, _studio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_studio_owner(_user_id uuid, _studio_id uuid) TO service_role;


--
-- Name: FUNCTION items_recalc_financials(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.items_recalc_financials() TO anon;
GRANT ALL ON FUNCTION public.items_recalc_financials() TO authenticated;
GRANT ALL ON FUNCTION public.items_recalc_financials() TO service_role;


--
-- Name: FUNCTION log_curator_picks_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_curator_picks_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_curator_picks_change() TO service_role;


--
-- Name: FUNCTION log_custom_request_activity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_custom_request_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_custom_request_activity() TO service_role;


--
-- Name: FUNCTION log_designers_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_designers_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_designers_change() TO service_role;


--
-- Name: FUNCTION log_public_download_event(_document_id uuid, _document_label text, _country text, _source text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_public_download_event(_document_id uuid, _document_label text, _country text, _source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_public_download_event(_document_id uuid, _document_label text, _country text, _source text) TO anon;
GRANT ALL ON FUNCTION public.log_public_download_event(_document_id uuid, _document_label text, _country text, _source text) TO authenticated;
GRANT ALL ON FUNCTION public.log_public_download_event(_document_id uuid, _document_label text, _country text, _source text) TO service_role;


--
-- Name: FUNCTION log_sample_request_status_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_sample_request_status_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_sample_request_status_change() TO service_role;


--
-- Name: FUNCTION log_trade_documents_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_trade_documents_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_trade_documents_change() TO service_role;


--
-- Name: FUNCTION log_unauthorized_access(_route text, _details jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_unauthorized_access(_route text, _details jsonb) TO anon;
GRANT ALL ON FUNCTION public.log_unauthorized_access(_route text, _details jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_unauthorized_access(_route text, _details jsonb) TO service_role;


--
-- Name: FUNCTION map_country_to_region_tier(_country text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.map_country_to_region_tier(_country text) TO anon;
GRANT ALL ON FUNCTION public.map_country_to_region_tier(_country text) TO authenticated;
GRANT ALL ON FUNCTION public.map_country_to_region_tier(_country text) TO service_role;


--
-- Name: FUNCTION match_catalog(query_embedding public.vector, match_count integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.match_catalog(query_embedding public.vector, match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_catalog(query_embedding public.vector, match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_catalog(query_embedding public.vector, match_count integer) TO service_role;


--
-- Name: FUNCTION match_catalog_filtered(query_embedding public.vector, match_count integer, filter jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.match_catalog_filtered(query_embedding public.vector, match_count integer, filter jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_catalog_filtered(query_embedding public.vector, match_count integer, filter jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_catalog_filtered(query_embedding public.vector, match_count integer, filter jsonb) TO service_role;


--
-- Name: FUNCTION match_roster_public(query_embedding public.vector, match_count integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.match_roster_public(query_embedding public.vector, match_count integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.match_roster_public(query_embedding public.vector, match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_roster_public(query_embedding public.vector, match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_roster_public(query_embedding public.vector, match_count integer) TO service_role;


--
-- Name: FUNCTION match_semantic_cache(_feature text, _model text, _query_embedding public.vector, _threshold double precision, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.match_semantic_cache(_feature text, _model text, _query_embedding public.vector, _threshold double precision, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.match_semantic_cache(_feature text, _model text, _query_embedding public.vector, _threshold double precision, _limit integer) TO service_role;


--
-- Name: FUNCTION match_trade_products(query_embedding public.vector, match_threshold double precision, match_count integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.match_trade_products(query_embedding public.vector, match_threshold double precision, match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_trade_products(query_embedding public.vector, match_threshold double precision, match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_trade_products(query_embedding public.vector, match_threshold double precision, match_count integer) TO service_role;


--
-- Name: FUNCTION move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) TO service_role;


--
-- Name: FUNCTION next_designer_po_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.next_designer_po_number() TO anon;
GRANT ALL ON FUNCTION public.next_designer_po_number() TO authenticated;
GRANT ALL ON FUNCTION public.next_designer_po_number() TO service_role;


--
-- Name: FUNCTION notify_admins_custom_request(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_admins_custom_request() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_admins_custom_request() TO service_role;


--
-- Name: FUNCTION notify_admins_new_order(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_admins_new_order() TO anon;
GRANT ALL ON FUNCTION public.notify_admins_new_order() TO authenticated;
GRANT ALL ON FUNCTION public.notify_admins_new_order() TO service_role;


--
-- Name: FUNCTION notify_admins_new_registration(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_admins_new_registration() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_admins_new_registration() TO service_role;


--
-- Name: FUNCTION notify_admins_production_render(_render_title text, _engine text, _requester_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_admins_production_render(_render_title text, _engine text, _requester_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_admins_production_render(_render_title text, _engine text, _requester_name text) TO service_role;


--
-- Name: FUNCTION owns_client_board(_user_id uuid, _board_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.owns_client_board(_user_id uuid, _board_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_client_board(_user_id uuid, _board_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_client_board(_user_id uuid, _board_id uuid) TO service_role;


--
-- Name: FUNCTION owns_trade_quote(_user_id uuid, _quote_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.owns_trade_quote(_user_id uuid, _quote_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_trade_quote(_user_id uuid, _quote_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_trade_quote(_user_id uuid, _quote_id uuid) TO service_role;


--
-- Name: FUNCTION parse_dimensions_to_mm(dim_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.parse_dimensions_to_mm(dim_text text) TO anon;
GRANT ALL ON FUNCTION public.parse_dimensions_to_mm(dim_text text) TO authenticated;
GRANT ALL ON FUNCTION public.parse_dimensions_to_mm(dim_text text) TO service_role;


--
-- Name: FUNCTION parse_lead_weeks(p_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.parse_lead_weeks(p_text text) TO anon;
GRANT ALL ON FUNCTION public.parse_lead_weeks(p_text text) TO authenticated;
GRANT ALL ON FUNCTION public.parse_lead_weeks(p_text text) TO service_role;


--
-- Name: FUNCTION pick_is_publicly_visible(_pick_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pick_is_publicly_visible(_pick_id uuid) TO anon;
GRANT ALL ON FUNCTION public.pick_is_publicly_visible(_pick_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pick_is_publicly_visible(_pick_id uuid) TO service_role;


--
-- Name: FUNCTION prevent_profile_tier_self_escalation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_profile_tier_self_escalation() TO anon;
GRANT ALL ON FUNCTION public.prevent_profile_tier_self_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_profile_tier_self_escalation() TO service_role;


--
-- Name: FUNCTION prevent_profile_tier_self_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_profile_tier_self_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_profile_tier_self_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_profile_tier_self_update() TO service_role;


--
-- Name: FUNCTION prevent_quote_item_price_self_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_quote_item_price_self_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_quote_item_price_self_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_quote_item_price_self_update() TO service_role;


--
-- Name: FUNCTION prevent_quote_pricing_self_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_quote_pricing_self_update() TO anon;
GRANT ALL ON FUNCTION public.prevent_quote_pricing_self_update() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_quote_pricing_self_update() TO service_role;


--
-- Name: FUNCTION profile_privileged_fields_unchanged(_id uuid, _trade_tier public.trade_tier, _trade_tier_suggested public.trade_tier, _trade_tier_locked_by_admin boolean, _trade_tier_12mo_spend_cents bigint, _trade_tier_computed_at timestamp with time zone, _trade_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.profile_privileged_fields_unchanged(_id uuid, _trade_tier public.trade_tier, _trade_tier_suggested public.trade_tier, _trade_tier_locked_by_admin boolean, _trade_tier_12mo_spend_cents bigint, _trade_tier_computed_at timestamp with time zone, _trade_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.profile_privileged_fields_unchanged(_id uuid, _trade_tier public.trade_tier, _trade_tier_suggested public.trade_tier, _trade_tier_locked_by_admin boolean, _trade_tier_12mo_spend_cents bigint, _trade_tier_computed_at timestamp with time zone, _trade_status text) TO authenticated;
GRANT ALL ON FUNCTION public.profile_privileged_fields_unchanged(_id uuid, _trade_tier public.trade_tier, _trade_tier_suggested public.trade_tier, _trade_tier_locked_by_admin boolean, _trade_tier_12mo_spend_cents bigint, _trade_tier_computed_at timestamp with time zone, _trade_status text) TO service_role;


--
-- Name: FUNCTION protect_trade_application_privileged_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_trade_application_privileged_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_trade_application_privileged_fields() TO service_role;


--
-- Name: FUNCTION purge_stale_concierge_streams(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_stale_concierge_streams() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_stale_concierge_streams() TO anon;
GRANT ALL ON FUNCTION public.purge_stale_concierge_streams() TO authenticated;
GRANT ALL ON FUNCTION public.purge_stale_concierge_streams() TO service_role;


--
-- Name: FUNCTION read_email_batch(queue_name text, batch_size integer, vt integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) TO service_role;


--
-- Name: FUNCTION realtime_topic_allowed(_topic text, _uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid) TO anon;
GRANT ALL ON FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.realtime_topic_allowed(_topic text, _uid uuid) TO service_role;


--
-- Name: FUNCTION recompute_client_tier_eligibility(_client_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recompute_client_tier_eligibility(_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recompute_client_tier_eligibility(_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompute_client_tier_eligibility(_client_id uuid) TO service_role;


--
-- Name: FUNCTION recompute_trade_tier_suggestions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompute_trade_tier_suggestions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompute_trade_tier_suggestions() TO service_role;
GRANT ALL ON FUNCTION public.recompute_trade_tier_suggestions() TO authenticated;


--
-- Name: FUNCTION record_security_event(_event_type text, _source text, _user_id uuid, _ip text, _details jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_security_event(_event_type text, _source text, _user_id uuid, _ip text, _details jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_security_event(_event_type text, _source text, _user_id uuid, _ip text, _details jsonb) TO service_role;


--
-- Name: FUNCTION redeem_portal_invite(_code text, _corporate_id text, _ip inet, _user_agent text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet, _user_agent text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet, _user_agent text) TO anon;
GRANT ALL ON FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet, _user_agent text) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_portal_invite(_code text, _corporate_id text, _ip inet, _user_agent text) TO service_role;


--
-- Name: FUNCTION refresh_product_fabric_swatches_public(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refresh_product_fabric_swatches_public() FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_product_fabric_swatches_public() TO service_role;


--
-- Name: FUNCTION release_ingestion_lease(_owner text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_ingestion_lease(_owner text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_ingestion_lease(_owner text) TO service_role;


--
-- Name: FUNCTION remap_product_descriptors(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remap_product_descriptors() FROM PUBLIC;
GRANT ALL ON FUNCTION public.remap_product_descriptors() TO anon;
GRANT ALL ON FUNCTION public.remap_product_descriptors() TO authenticated;
GRANT ALL ON FUNCTION public.remap_product_descriptors() TO service_role;


--
-- Name: FUNCTION rotate_board_token(_board_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rotate_board_token(_board_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rotate_board_token(_board_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.rotate_board_token(_board_id uuid) TO service_role;


--
-- Name: FUNCTION route_cc_tapis_pick_to_collab(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.route_cc_tapis_pick_to_collab() FROM PUBLIC;
GRANT ALL ON FUNCTION public.route_cc_tapis_pick_to_collab() TO service_role;


--
-- Name: FUNCTION sanitize_biography_citations(input text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sanitize_biography_citations(input text) TO anon;
GRANT ALL ON FUNCTION public.sanitize_biography_citations(input text) TO authenticated;
GRANT ALL ON FUNCTION public.sanitize_biography_citations(input text) TO service_role;


--
-- Name: FUNCTION scan_sec_query(_sql text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.scan_sec_query(_sql text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.scan_sec_query(_sql text) TO service_role;


--
-- Name: FUNCTION set_curator_pick_slug(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_curator_pick_slug() TO anon;
GRANT ALL ON FUNCTION public.set_curator_pick_slug() TO authenticated;
GRANT ALL ON FUNCTION public.set_curator_pick_slug() TO service_role;


--
-- Name: FUNCTION set_region_tier_from_country(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_region_tier_from_country() TO anon;
GRANT ALL ON FUNCTION public.set_region_tier_from_country() TO authenticated;
GRANT ALL ON FUNCTION public.set_region_tier_from_country() TO service_role;


--
-- Name: FUNCTION slugify_text(input text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.slugify_text(input text) TO anon;
GRANT ALL ON FUNCTION public.slugify_text(input text) TO authenticated;
GRANT ALL ON FUNCTION public.slugify_text(input text) TO service_role;


--
-- Name: FUNCTION strip_public_variant_prices(_variants jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strip_public_variant_prices(_variants jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.strip_public_variant_prices(_variants jsonb) TO service_role;


--
-- Name: FUNCTION studio_has_resale_cert_for_state(_studio_id uuid, _state text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.studio_has_resale_cert_for_state(_studio_id uuid, _state text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.studio_has_resale_cert_for_state(_studio_id uuid, _state text) TO authenticated;
GRANT ALL ON FUNCTION public.studio_has_resale_cert_for_state(_studio_id uuid, _state text) TO service_role;


--
-- Name: FUNCTION sync_curator_pick_to_trade_product(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_curator_pick_to_trade_product() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_curator_pick_to_trade_product() TO service_role;


--
-- Name: FUNCTION sync_designer_curator_picks_public(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_designer_curator_picks_public() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_designer_curator_picks_public() TO service_role;


--
-- Name: FUNCTION sync_featured_studios_public(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_featured_studios_public() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_featured_studios_public() TO service_role;


--
-- Name: FUNCTION sync_inquiry_to_admin_directory(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_inquiry_to_admin_directory() TO anon;
GRANT ALL ON FUNCTION public.sync_inquiry_to_admin_directory() TO authenticated;
GRANT ALL ON FUNCTION public.sync_inquiry_to_admin_directory() TO service_role;


--
-- Name: FUNCTION sync_pick_crate_specs(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_pick_crate_specs() TO anon;
GRANT ALL ON FUNCTION public.sync_pick_crate_specs() TO authenticated;
GRANT ALL ON FUNCTION public.sync_pick_crate_specs() TO service_role;


--
-- Name: FUNCTION sync_sitemap_product(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_sitemap_product() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_sitemap_product() TO anon;
GRANT ALL ON FUNCTION public.sync_sitemap_product() TO authenticated;
GRANT ALL ON FUNCTION public.sync_sitemap_product() TO service_role;


--
-- Name: FUNCTION sync_trade_access_on_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_trade_access_on_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_trade_access_on_status() TO service_role;


--
-- Name: FUNCTION sync_trade_application_to_admin_directory(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_trade_application_to_admin_directory() TO anon;
GRANT ALL ON FUNCTION public.sync_trade_application_to_admin_directory() TO authenticated;
GRANT ALL ON FUNCTION public.sync_trade_application_to_admin_directory() TO service_role;


--
-- Name: FUNCTION sync_trade_product_default_glb(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_trade_product_default_glb() TO anon;
GRANT ALL ON FUNCTION public.sync_trade_product_default_glb() TO authenticated;
GRANT ALL ON FUNCTION public.sync_trade_product_default_glb() TO service_role;


--
-- Name: FUNCTION tg_guard_axonometric_request_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_axonometric_request_status() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_axonometric_request_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_axonometric_request_status() TO service_role;


--
-- Name: FUNCTION tg_guard_custom_request_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_custom_request_status() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_custom_request_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_custom_request_status() TO service_role;


--
-- Name: FUNCTION tg_guard_profile_tier_columns(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_profile_tier_columns() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_profile_tier_columns() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_profile_tier_columns() TO service_role;


--
-- Name: FUNCTION tg_guard_quote_item_pricing(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_quote_item_pricing() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_quote_item_pricing() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_quote_item_pricing() TO service_role;


--
-- Name: FUNCTION tg_guard_quote_pricing(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_quote_pricing() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_quote_pricing() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_quote_pricing() TO service_role;


--
-- Name: FUNCTION tg_guard_quote_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_quote_status() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_quote_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_quote_status() TO service_role;


--
-- Name: FUNCTION tg_guard_trade_application_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_guard_trade_application_status() TO anon;
GRANT ALL ON FUNCTION public.tg_guard_trade_application_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_guard_trade_application_status() TO service_role;


--
-- Name: FUNCTION tg_mirror_pricing_to_pick(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_mirror_pricing_to_pick() TO anon;
GRANT ALL ON FUNCTION public.tg_mirror_pricing_to_pick() TO authenticated;
GRANT ALL ON FUNCTION public.tg_mirror_pricing_to_pick() TO service_role;


--
-- Name: FUNCTION tg_order_timeline_guard_ship_to_pii(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_order_timeline_guard_ship_to_pii() TO anon;
GRANT ALL ON FUNCTION public.tg_order_timeline_guard_ship_to_pii() TO authenticated;
GRANT ALL ON FUNCTION public.tg_order_timeline_guard_ship_to_pii() TO service_role;


--
-- Name: FUNCTION tg_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tg_set_updated_at() TO service_role;


--
-- Name: FUNCTION tg_studio_submissions_rate_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_studio_submissions_rate_limit() TO anon;
GRANT ALL ON FUNCTION public.tg_studio_submissions_rate_limit() TO authenticated;
GRANT ALL ON FUNCTION public.tg_studio_submissions_rate_limit() TO service_role;


--
-- Name: FUNCTION tg_validate_trade_quote_billing(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tg_validate_trade_quote_billing() TO anon;
GRANT ALL ON FUNCTION public.tg_validate_trade_quote_billing() TO authenticated;
GRANT ALL ON FUNCTION public.tg_validate_trade_quote_billing() TO service_role;


--
-- Name: FUNCTION tier_discount_pct(_tier public.trade_tier); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tier_discount_pct(_tier public.trade_tier) TO anon;
GRANT ALL ON FUNCTION public.tier_discount_pct(_tier public.trade_tier) TO authenticated;
GRANT ALL ON FUNCTION public.tier_discount_pct(_tier public.trade_tier) TO service_role;


--
-- Name: FUNCTION tier_rank(_tier text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tier_rank(_tier text) TO anon;
GRANT ALL ON FUNCTION public.tier_rank(_tier text) TO authenticated;
GRANT ALL ON FUNCTION public.tier_rank(_tier text) TO service_role;


--
-- Name: FUNCTION tms_set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tms_set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tms_set_updated_at() TO service_role;


--
-- Name: FUNCTION trade_emit_delivery_escalation(p_item_id uuid, p_old_slack integer, p_new_slack integer, p_old_expected timestamp with time zone, p_new_expected timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trade_emit_delivery_escalation(p_item_id uuid, p_old_slack integer, p_new_slack integer, p_old_expected timestamp with time zone, p_new_expected timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.trade_emit_delivery_escalation(p_item_id uuid, p_old_slack integer, p_new_slack integer, p_old_expected timestamp with time zone, p_new_expected timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.trade_emit_delivery_escalation(p_item_id uuid, p_old_slack integer, p_new_slack integer, p_old_expected timestamp with time zone, p_new_expected timestamp with time zone) TO service_role;


--
-- Name: FUNCTION trade_expected_ready(p_actual timestamp with time zone, p_estimated timestamp with time zone, p_deposit timestamp with time zone, p_shipping_weeks integer, p_quote_created timestamp with time zone, p_lead_weeks integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trade_expected_ready(p_actual timestamp with time zone, p_estimated timestamp with time zone, p_deposit timestamp with time zone, p_shipping_weeks integer, p_quote_created timestamp with time zone, p_lead_weeks integer) TO anon;
GRANT ALL ON FUNCTION public.trade_expected_ready(p_actual timestamp with time zone, p_estimated timestamp with time zone, p_deposit timestamp with time zone, p_shipping_weeks integer, p_quote_created timestamp with time zone, p_lead_weeks integer) TO authenticated;
GRANT ALL ON FUNCTION public.trade_expected_ready(p_actual timestamp with time zone, p_estimated timestamp with time zone, p_deposit timestamp with time zone, p_shipping_weeks integer, p_quote_created timestamp with time zone, p_lead_weeks integer) TO service_role;


--
-- Name: FUNCTION trade_item_delivery_status(p_item_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trade_item_delivery_status(p_item_id uuid) TO anon;
GRANT ALL ON FUNCTION public.trade_item_delivery_status(p_item_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.trade_item_delivery_status(p_item_id uuid) TO service_role;


--
-- Name: FUNCTION trade_product_is_publicly_visible(_product_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trade_product_is_publicly_visible(_product_id uuid) TO anon;
GRANT ALL ON FUNCTION public.trade_product_is_publicly_visible(_product_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.trade_product_is_publicly_visible(_product_id uuid) TO service_role;


--
-- Name: FUNCTION trade_slack_days(p_required_by date, p_expected timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trade_slack_days(p_required_by date, p_expected timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.trade_slack_days(p_required_by date, p_expected timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.trade_slack_days(p_required_by date, p_expected timestamp with time zone) TO service_role;


--
-- Name: FUNCTION trg_order_timeline_delivery_escalation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_order_timeline_delivery_escalation() TO anon;
GRANT ALL ON FUNCTION public.trg_order_timeline_delivery_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.trg_order_timeline_delivery_escalation() TO service_role;


--
-- Name: FUNCTION trg_quote_item_delivery_escalation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_quote_item_delivery_escalation() TO anon;
GRANT ALL ON FUNCTION public.trg_quote_item_delivery_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.trg_quote_item_delivery_escalation() TO service_role;


--
-- Name: FUNCTION trg_recompute_client_tier(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_recompute_client_tier() TO anon;
GRANT ALL ON FUNCTION public.trg_recompute_client_tier() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recompute_client_tier() TO service_role;


--
-- Name: FUNCTION trg_recompute_client_tier_items(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_recompute_client_tier_items() TO anon;
GRANT ALL ON FUNCTION public.trg_recompute_client_tier_items() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recompute_client_tier_items() TO service_role;


--
-- Name: FUNCTION trim_meta_description(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trim_meta_description() TO anon;
GRANT ALL ON FUNCTION public.trim_meta_description() TO authenticated;
GRANT ALL ON FUNCTION public.trim_meta_description() TO service_role;


--
-- Name: FUNCTION update_item_approval_by_token(_token text, _item_id uuid, _approval_status text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_item_approval_by_token(_token text, _item_id uuid, _approval_status text) TO anon;
GRANT ALL ON FUNCTION public.update_item_approval_by_token(_token text, _item_id uuid, _approval_status text) TO authenticated;
GRANT ALL ON FUNCTION public.update_item_approval_by_token(_token text, _item_id uuid, _approval_status text) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION upsert_admin_directory_client(p_studio_id uuid, p_created_by uuid, p_company text, p_first_name text, p_last_name text, p_email text, p_phone text, p_role_title text, p_notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_admin_directory_client(p_studio_id uuid, p_created_by uuid, p_company text, p_first_name text, p_last_name text, p_email text, p_phone text, p_role_title text, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.upsert_admin_directory_client(p_studio_id uuid, p_created_by uuid, p_company text, p_first_name text, p_last_name text, p_email text, p_phone text, p_role_title text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_admin_directory_client(p_studio_id uuid, p_created_by uuid, p_company text, p_first_name text, p_last_name text, p_email text, p_phone text, p_role_title text, p_notes text) TO service_role;


--
-- Name: FUNCTION validate_portal_session(_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_portal_session(_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_portal_session(_token uuid) TO anon;
GRANT ALL ON FUNCTION public.validate_portal_session(_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.validate_portal_session(_token uuid) TO service_role;


--
-- Name: FUNCTION webhook_events_has_work(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.webhook_events_has_work() TO anon;
GRANT ALL ON FUNCTION public.webhook_events_has_work() TO authenticated;
GRANT ALL ON FUNCTION public.webhook_events_has_work() TO service_role;


--
-- Name: FUNCTION webhook_queue_dispatch(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.webhook_queue_dispatch() TO anon;
GRANT ALL ON FUNCTION public.webhook_queue_dispatch() TO authenticated;
GRANT ALL ON FUNCTION public.webhook_queue_dispatch() TO service_role;


--
-- Name: FUNCTION webhook_queue_wake(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.webhook_queue_wake() TO anon;
GRANT ALL ON FUNCTION public.webhook_queue_wake() TO authenticated;
GRANT ALL ON FUNCTION public.webhook_queue_wake() TO service_role;


--
-- Name: TABLE abandoned_carts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.abandoned_carts TO anon;
GRANT ALL ON TABLE public.abandoned_carts TO authenticated;
GRANT ALL ON TABLE public.abandoned_carts TO service_role;
GRANT SELECT,INSERT ON TABLE public.abandoned_carts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.abandoned_carts TO sandbox_exec;


--
-- Name: TABLE admin_alert_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_alert_log TO anon;
GRANT ALL ON TABLE public.admin_alert_log TO authenticated;
GRANT ALL ON TABLE public.admin_alert_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.admin_alert_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.admin_alert_log TO sandbox_exec;


--
-- Name: TABLE ai_model_pricing; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_model_pricing TO anon;
GRANT ALL ON TABLE public.ai_model_pricing TO authenticated;
GRANT ALL ON TABLE public.ai_model_pricing TO service_role;
GRANT SELECT,INSERT ON TABLE public.ai_model_pricing TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ai_model_pricing TO sandbox_exec;


--
-- Name: TABLE ai_response_cache; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_response_cache TO anon;
GRANT ALL ON TABLE public.ai_response_cache TO authenticated;
GRANT ALL ON TABLE public.ai_response_cache TO service_role;
GRANT SELECT,INSERT ON TABLE public.ai_response_cache TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ai_response_cache TO sandbox_exec;


--
-- Name: TABLE ai_semantic_cache; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ai_semantic_cache TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.ai_semantic_cache TO authenticated;
GRANT ALL ON TABLE public.ai_semantic_cache TO service_role;
GRANT SELECT,INSERT ON TABLE public.ai_semantic_cache TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ai_semantic_cache TO sandbox_exec;


--
-- Name: TABLE ai_usage_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_events TO anon;
GRANT ALL ON TABLE public.ai_usage_events TO authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.ai_usage_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ai_usage_events TO sandbox_exec;


--
-- Name: TABLE analytics_rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.analytics_rate_limits TO anon;
GRANT ALL ON TABLE public.analytics_rate_limits TO authenticated;
GRANT ALL ON TABLE public.analytics_rate_limits TO service_role;
GRANT SELECT,INSERT ON TABLE public.analytics_rate_limits TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.analytics_rate_limits TO sandbox_exec;


--
-- Name: TABLE auction_benchmarks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.auction_benchmarks TO anon;
GRANT ALL ON TABLE public.auction_benchmarks TO authenticated;
GRANT ALL ON TABLE public.auction_benchmarks TO service_role;
GRANT SELECT,INSERT ON TABLE public.auction_benchmarks TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.auction_benchmarks TO sandbox_exec;


--
-- Name: TABLE axonometric_cad_qa; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.axonometric_cad_qa TO anon;
GRANT ALL ON TABLE public.axonometric_cad_qa TO authenticated;
GRANT ALL ON TABLE public.axonometric_cad_qa TO service_role;
GRANT SELECT,INSERT ON TABLE public.axonometric_cad_qa TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.axonometric_cad_qa TO sandbox_exec;


--
-- Name: TABLE axonometric_gallery; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.axonometric_gallery TO anon;
GRANT ALL ON TABLE public.axonometric_gallery TO authenticated;
GRANT ALL ON TABLE public.axonometric_gallery TO service_role;
GRANT SELECT,INSERT ON TABLE public.axonometric_gallery TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.axonometric_gallery TO sandbox_exec;


--
-- Name: TABLE axonometric_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.axonometric_requests TO anon;
GRANT ALL ON TABLE public.axonometric_requests TO authenticated;
GRANT ALL ON TABLE public.axonometric_requests TO service_role;
GRANT SELECT,INSERT ON TABLE public.axonometric_requests TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.axonometric_requests TO sandbox_exec;


--
-- Name: TABLE board_recommendations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.board_recommendations TO anon;
GRANT ALL ON TABLE public.board_recommendations TO authenticated;
GRANT ALL ON TABLE public.board_recommendations TO service_role;
GRANT SELECT,INSERT ON TABLE public.board_recommendations TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.board_recommendations TO sandbox_exec;


--
-- Name: TABLE brand_lead_times; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brand_lead_times TO anon;
GRANT ALL ON TABLE public.brand_lead_times TO authenticated;
GRANT ALL ON TABLE public.brand_lead_times TO service_role;
GRANT SELECT,INSERT ON TABLE public.brand_lead_times TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.brand_lead_times TO sandbox_exec;


--
-- Name: TABLE brand_thumbnails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brand_thumbnails TO anon;
GRANT ALL ON TABLE public.brand_thumbnails TO authenticated;
GRANT ALL ON TABLE public.brand_thumbnails TO service_role;
GRANT SELECT,INSERT ON TABLE public.brand_thumbnails TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.brand_thumbnails TO sandbox_exec;


--
-- Name: TABLE brief_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brief_drafts TO anon;
GRANT ALL ON TABLE public.brief_drafts TO authenticated;
GRANT ALL ON TABLE public.brief_drafts TO service_role;
GRANT SELECT,INSERT ON TABLE public.brief_drafts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.brief_drafts TO sandbox_exec;


--
-- Name: TABLE cad_asset_downloads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cad_asset_downloads TO anon;
GRANT ALL ON TABLE public.cad_asset_downloads TO authenticated;
GRANT ALL ON TABLE public.cad_asset_downloads TO service_role;
GRANT SELECT,INSERT ON TABLE public.cad_asset_downloads TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cad_asset_downloads TO sandbox_exec;


--
-- Name: TABLE cad_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cad_documents TO anon;
GRANT ALL ON TABLE public.cad_documents TO authenticated;
GRANT ALL ON TABLE public.cad_documents TO service_role;
GRANT SELECT,INSERT ON TABLE public.cad_documents TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cad_documents TO sandbox_exec;


--
-- Name: TABLE cad_fit_edit_audit; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cad_fit_edit_audit TO anon;
GRANT ALL ON TABLE public.cad_fit_edit_audit TO authenticated;
GRANT ALL ON TABLE public.cad_fit_edit_audit TO service_role;
GRANT SELECT,INSERT ON TABLE public.cad_fit_edit_audit TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cad_fit_edit_audit TO sandbox_exec;


--
-- Name: TABLE cad_fit_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cad_fit_reports TO anon;
GRANT ALL ON TABLE public.cad_fit_reports TO authenticated;
GRANT ALL ON TABLE public.cad_fit_reports TO service_role;
GRANT SELECT,INSERT ON TABLE public.cad_fit_reports TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cad_fit_reports TO sandbox_exec;


--
-- Name: TABLE client_board_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_board_comments TO anon;
GRANT ALL ON TABLE public.client_board_comments TO authenticated;
GRANT ALL ON TABLE public.client_board_comments TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_board_comments TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_board_comments TO sandbox_exec;


--
-- Name: TABLE client_board_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_board_items TO anon;
GRANT ALL ON TABLE public.client_board_items TO authenticated;
GRANT ALL ON TABLE public.client_board_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_board_items TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_board_items TO sandbox_exec;


--
-- Name: TABLE client_boards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_boards TO anon;
GRANT ALL ON TABLE public.client_boards TO authenticated;
GRANT ALL ON TABLE public.client_boards TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_boards TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_boards TO sandbox_exec;


--
-- Name: COLUMN client_boards.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(user_id) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.client_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(client_name) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.token_expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(token_expires_at) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.token_rotated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(token_rotated_at) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.project_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(project_id) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.studio_logo_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(studio_logo_url) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.studio_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(studio_name) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.hide_maison_branding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hide_maison_branding) ON TABLE public.client_boards TO authenticated;


--
-- Name: COLUMN client_boards.studio_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(studio_id) ON TABLE public.client_boards TO authenticated;


--
-- Name: TABLE client_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_contacts TO anon;
GRANT ALL ON TABLE public.client_contacts TO authenticated;
GRANT ALL ON TABLE public.client_contacts TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_contacts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_contacts TO sandbox_exec;


--
-- Name: TABLE client_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_documents TO anon;
GRANT ALL ON TABLE public.client_documents TO authenticated;
GRANT ALL ON TABLE public.client_documents TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_documents TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_documents TO sandbox_exec;


--
-- Name: TABLE client_taste_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_taste_profiles TO anon;
GRANT ALL ON TABLE public.client_taste_profiles TO authenticated;
GRANT ALL ON TABLE public.client_taste_profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_taste_profiles TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.client_taste_profiles TO sandbox_exec;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;
GRANT SELECT,INSERT ON TABLE public.clients TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.clients TO sandbox_exec;


--
-- Name: TABLE cn_director_briefs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cn_director_briefs TO anon;
GRANT ALL ON TABLE public.cn_director_briefs TO authenticated;
GRANT ALL ON TABLE public.cn_director_briefs TO service_role;
GRANT SELECT,INSERT ON TABLE public.cn_director_briefs TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cn_director_briefs TO sandbox_exec;


--
-- Name: TABLE collectible_atelier_gallery; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collectible_atelier_gallery TO anon;
GRANT ALL ON TABLE public.collectible_atelier_gallery TO authenticated;
GRANT ALL ON TABLE public.collectible_atelier_gallery TO service_role;
GRANT SELECT,INSERT ON TABLE public.collectible_atelier_gallery TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.collectible_atelier_gallery TO sandbox_exec;


--
-- Name: TABLE collectible_atelier_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collectible_atelier_overrides TO anon;
GRANT ALL ON TABLE public.collectible_atelier_overrides TO authenticated;
GRANT ALL ON TABLE public.collectible_atelier_overrides TO service_role;
GRANT SELECT,INSERT ON TABLE public.collectible_atelier_overrides TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.collectible_atelier_overrides TO sandbox_exec;


--
-- Name: TABLE collectible_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.collectible_overrides TO anon;
GRANT ALL ON TABLE public.collectible_overrides TO authenticated;
GRANT ALL ON TABLE public.collectible_overrides TO service_role;
GRANT SELECT,INSERT ON TABLE public.collectible_overrides TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.collectible_overrides TO sandbox_exec;


--
-- Name: TABLE collector_applications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.collector_applications TO anon;
GRANT ALL ON TABLE public.collector_applications TO authenticated;
GRANT ALL ON TABLE public.collector_applications TO service_role;
GRANT SELECT,INSERT ON TABLE public.collector_applications TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.collector_applications TO sandbox_exec;


--
-- Name: TABLE competitor_designers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.competitor_designers TO anon;
GRANT ALL ON TABLE public.competitor_designers TO authenticated;
GRANT ALL ON TABLE public.competitor_designers TO service_role;
GRANT SELECT,INSERT ON TABLE public.competitor_designers TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.competitor_designers TO sandbox_exec;


--
-- Name: TABLE competitor_galleries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.competitor_galleries TO anon;
GRANT ALL ON TABLE public.competitor_galleries TO authenticated;
GRANT ALL ON TABLE public.competitor_galleries TO service_role;
GRANT SELECT,INSERT ON TABLE public.competitor_galleries TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.competitor_galleries TO sandbox_exec;


--
-- Name: TABLE competitor_traffic; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.competitor_traffic TO anon;
GRANT ALL ON TABLE public.competitor_traffic TO authenticated;
GRANT ALL ON TABLE public.competitor_traffic TO service_role;
GRANT SELECT,INSERT ON TABLE public.competitor_traffic TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.competitor_traffic TO sandbox_exec;


--
-- Name: TABLE concierge_leads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_leads TO anon;
GRANT ALL ON TABLE public.concierge_leads TO authenticated;
GRANT ALL ON TABLE public.concierge_leads TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_leads TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_leads TO sandbox_exec;


--
-- Name: TABLE concierge_rag_traces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_rag_traces TO anon;
GRANT ALL ON TABLE public.concierge_rag_traces TO authenticated;
GRANT ALL ON TABLE public.concierge_rag_traces TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_rag_traces TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_rag_traces TO sandbox_exec;


--
-- Name: TABLE concierge_rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_rate_limits TO anon;
GRANT ALL ON TABLE public.concierge_rate_limits TO authenticated;
GRANT ALL ON TABLE public.concierge_rate_limits TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_rate_limits TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_rate_limits TO sandbox_exec;


--
-- Name: TABLE concierge_roster_embeddings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_roster_embeddings TO anon;
GRANT ALL ON TABLE public.concierge_roster_embeddings TO authenticated;
GRANT ALL ON TABLE public.concierge_roster_embeddings TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_roster_embeddings TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_roster_embeddings TO sandbox_exec;


--
-- Name: TABLE concierge_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_sessions TO anon;
GRANT ALL ON TABLE public.concierge_sessions TO authenticated;
GRANT ALL ON TABLE public.concierge_sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_sessions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_sessions TO sandbox_exec;


--
-- Name: TABLE concierge_stream_frames; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_stream_frames TO anon;
GRANT ALL ON TABLE public.concierge_stream_frames TO authenticated;
GRANT ALL ON TABLE public.concierge_stream_frames TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_stream_frames TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_stream_frames TO sandbox_exec;


--
-- Name: TABLE concierge_stream_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_stream_sessions TO anon;
GRANT ALL ON TABLE public.concierge_stream_sessions TO authenticated;
GRANT ALL ON TABLE public.concierge_stream_sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_stream_sessions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_stream_sessions TO sandbox_exec;


--
-- Name: TABLE concierge_threads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concierge_threads TO anon;
GRANT ALL ON TABLE public.concierge_threads TO authenticated;
GRANT ALL ON TABLE public.concierge_threads TO service_role;
GRANT SELECT,INSERT ON TABLE public.concierge_threads TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.concierge_threads TO sandbox_exec;


--
-- Name: TABLE content_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.content_audit_log TO anon;
GRANT ALL ON TABLE public.content_audit_log TO authenticated;
GRANT ALL ON TABLE public.content_audit_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.content_audit_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.content_audit_log TO sandbox_exec;


--
-- Name: TABLE cpd_attendance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cpd_attendance TO anon;
GRANT ALL ON TABLE public.cpd_attendance TO authenticated;
GRANT ALL ON TABLE public.cpd_attendance TO service_role;
GRANT SELECT,INSERT ON TABLE public.cpd_attendance TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cpd_attendance TO sandbox_exec;


--
-- Name: TABLE cpd_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cpd_events TO anon;
GRANT ALL ON TABLE public.cpd_events TO authenticated;
GRANT ALL ON TABLE public.cpd_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.cpd_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cpd_events TO sandbox_exec;


--
-- Name: TABLE cron_http_call_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cron_http_call_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.cron_http_call_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.cron_http_call_log TO sandbox_exec;
GRANT SELECT ON TABLE public.cron_http_call_log TO authenticated;


--
-- Name: TABLE curated_drops; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.curated_drops TO anon;
GRANT ALL ON TABLE public.curated_drops TO authenticated;
GRANT ALL ON TABLE public.curated_drops TO service_role;
GRANT SELECT,INSERT ON TABLE public.curated_drops TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.curated_drops TO sandbox_exec;


--
-- Name: TABLE currency_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.currency_rates TO anon;
GRANT ALL ON TABLE public.currency_rates TO authenticated;
GRANT ALL ON TABLE public.currency_rates TO service_role;
GRANT SELECT,INSERT ON TABLE public.currency_rates TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.currency_rates TO sandbox_exec;


--
-- Name: TABLE custom_inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_inquiries TO anon;
GRANT ALL ON TABLE public.custom_inquiries TO authenticated;
GRANT ALL ON TABLE public.custom_inquiries TO service_role;
GRANT SELECT,INSERT ON TABLE public.custom_inquiries TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.custom_inquiries TO sandbox_exec;


--
-- Name: TABLE descriptor_taxonomy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.descriptor_taxonomy TO anon;
GRANT ALL ON TABLE public.descriptor_taxonomy TO authenticated;
GRANT ALL ON TABLE public.descriptor_taxonomy TO service_role;
GRANT SELECT,INSERT ON TABLE public.descriptor_taxonomy TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.descriptor_taxonomy TO sandbox_exec;


--
-- Name: TABLE designer_curator_picks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_curator_picks TO authenticated;
GRANT ALL ON TABLE public.designer_curator_picks TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_curator_picks TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_curator_picks TO sandbox_exec;


--
-- Name: COLUMN designer_curator_picks.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.designer_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(designer_id) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.image_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(image_url) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.hover_image_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hover_image_url) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.subtitle; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(subtitle) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.category; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(category) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.subcategory; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(subcategory) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.tags; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tags) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.materials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(materials) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.dimensions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(dimensions) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(description) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.edition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(edition) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.photo_credit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(photo_credit) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pdf_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pdf_url) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pdf_filename; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pdf_filename) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pdf_urls; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pdf_urls) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.currency; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(currency) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.lead_time; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(lead_time) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.price_prefix; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(price_prefix) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.gallery_images; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(gallery_images) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.origin; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(origin) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.size_variants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(size_variants) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.variant_placeholder; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(variant_placeholder) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.base_axis_label; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(base_axis_label) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.top_axis_label; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(top_axis_label) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.variant_image_map; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(variant_image_map) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.is_hidden; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_hidden) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.edition_number; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(edition_number) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.edition_signing; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(edition_signing) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pack_cbm; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pack_cbm) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pack_weight_kg; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pack_weight_kg) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pack_carton_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pack_carton_count) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.default_ship_mode; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(default_ship_mode) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pickup_country; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pickup_country) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pickup_postcode; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pickup_postcode) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.pickup_address; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pickup_address) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: COLUMN designer_curator_picks.materials_description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(materials_description) ON TABLE public.designer_curator_picks TO authenticated;


--
-- Name: TABLE designer_curator_picks_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_curator_picks_public TO anon;
GRANT ALL ON TABLE public.designer_curator_picks_public TO authenticated;
GRANT ALL ON TABLE public.designer_curator_picks_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_curator_picks_public TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_curator_picks_public TO sandbox_exec;


--
-- Name: TABLE designer_heritage_slides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_heritage_slides TO anon;
GRANT ALL ON TABLE public.designer_heritage_slides TO authenticated;
GRANT ALL ON TABLE public.designer_heritage_slides TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_heritage_slides TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_heritage_slides TO sandbox_exec;


--
-- Name: TABLE designer_instagram_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_instagram_posts TO anon;
GRANT ALL ON TABLE public.designer_instagram_posts TO authenticated;
GRANT ALL ON TABLE public.designer_instagram_posts TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_instagram_posts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_instagram_posts TO sandbox_exec;


--
-- Name: TABLE designer_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_payouts TO anon;
GRANT ALL ON TABLE public.designer_payouts TO authenticated;
GRANT ALL ON TABLE public.designer_payouts TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_payouts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_payouts TO sandbox_exec;


--
-- Name: TABLE designer_purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designer_purchase_orders TO anon;
GRANT ALL ON TABLE public.designer_purchase_orders TO authenticated;
GRANT ALL ON TABLE public.designer_purchase_orders TO service_role;
GRANT SELECT,INSERT ON TABLE public.designer_purchase_orders TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designer_purchase_orders TO sandbox_exec;


--
-- Name: TABLE designers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.designers TO anon;
GRANT ALL ON TABLE public.designers TO authenticated;
GRANT ALL ON TABLE public.designers TO service_role;
GRANT SELECT,INSERT ON TABLE public.designers TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.designers TO sandbox_exec;


--
-- Name: TABLE document_downloads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_downloads TO anon;
GRANT ALL ON TABLE public.document_downloads TO authenticated;
GRANT ALL ON TABLE public.document_downloads TO service_role;
GRANT SELECT,INSERT ON TABLE public.document_downloads TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.document_downloads TO sandbox_exec;


--
-- Name: TABLE email_click_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_click_log TO anon;
GRANT ALL ON TABLE public.email_click_log TO authenticated;
GRANT ALL ON TABLE public.email_click_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_click_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.email_click_log TO sandbox_exec;


--
-- Name: TABLE email_send_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_log TO anon;
GRANT ALL ON TABLE public.email_send_log TO authenticated;
GRANT ALL ON TABLE public.email_send_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_send_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.email_send_log TO sandbox_exec;


--
-- Name: TABLE email_send_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_state TO anon;
GRANT ALL ON TABLE public.email_send_state TO authenticated;
GRANT ALL ON TABLE public.email_send_state TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_send_state TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.email_send_state TO sandbox_exec;


--
-- Name: TABLE email_unsubscribe_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_unsubscribe_tokens TO anon;
GRANT ALL ON TABLE public.email_unsubscribe_tokens TO authenticated;
GRANT ALL ON TABLE public.email_unsubscribe_tokens TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_unsubscribe_tokens TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.email_unsubscribe_tokens TO sandbox_exec;


--
-- Name: TABLE fabrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fabrics TO authenticated;
GRANT ALL ON TABLE public.fabrics TO service_role;
GRANT SELECT,INSERT ON TABLE public.fabrics TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.fabrics TO sandbox_exec;


--
-- Name: TABLE fabrics_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fabrics_public TO anon;
GRANT ALL ON TABLE public.fabrics_public TO authenticated;
GRANT ALL ON TABLE public.fabrics_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.fabrics_public TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.fabrics_public TO sandbox_exec;


--
-- Name: TABLE favorite_folder_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.favorite_folder_items TO anon;
GRANT ALL ON TABLE public.favorite_folder_items TO authenticated;
GRANT ALL ON TABLE public.favorite_folder_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.favorite_folder_items TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.favorite_folder_items TO sandbox_exec;


--
-- Name: TABLE favorite_folders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.favorite_folders TO anon;
GRANT ALL ON TABLE public.favorite_folders TO authenticated;
GRANT ALL ON TABLE public.favorite_folders TO service_role;
GRANT SELECT,INSERT ON TABLE public.favorite_folders TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.favorite_folders TO sandbox_exec;


--
-- Name: TABLE featured_studios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.featured_studios TO service_role;
GRANT SELECT,INSERT ON TABLE public.featured_studios TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.featured_studios TO sandbox_exec;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(slug) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.tagline; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tagline) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.bio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(bio) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.founded_year; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(founded_year) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.team_size; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(team_size) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(location) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.country; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(country) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.website_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(website_url) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.contact_email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(contact_email) ON TABLE public.featured_studios TO service_role;


--
-- Name: COLUMN featured_studios.instagram_handle; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(instagram_handle) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.logo_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(logo_url) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.hero_image_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hero_image_url) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.gallery_images; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(gallery_images) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.disciplines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(disciplines) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.project_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(project_types) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.notable_projects; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(notable_projects) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.is_featured; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_featured) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.is_published; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_published) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.featured_studios TO authenticated;


--
-- Name: COLUMN featured_studios.owner_user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(owner_user_id) ON TABLE public.featured_studios TO authenticated;


--
-- Name: TABLE featured_studios_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.featured_studios_public TO anon;
GRANT ALL ON TABLE public.featured_studios_public TO authenticated;
GRANT ALL ON TABLE public.featured_studios_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.featured_studios_public TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.featured_studios_public TO sandbox_exec;


--
-- Name: TABLE ffe_entitlements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ffe_entitlements TO anon;
GRANT ALL ON TABLE public.ffe_entitlements TO authenticated;
GRANT ALL ON TABLE public.ffe_entitlements TO service_role;
GRANT SELECT,INSERT ON TABLE public.ffe_entitlements TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ffe_entitlements TO sandbox_exec;


--
-- Name: TABLE funnel_card_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.funnel_card_payments TO anon;
GRANT ALL ON TABLE public.funnel_card_payments TO authenticated;
GRANT ALL ON TABLE public.funnel_card_payments TO service_role;
GRANT SELECT,INSERT ON TABLE public.funnel_card_payments TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.funnel_card_payments TO sandbox_exec;


--
-- Name: TABLE funnel_reminder_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.funnel_reminder_log TO anon;
GRANT ALL ON TABLE public.funnel_reminder_log TO authenticated;
GRANT ALL ON TABLE public.funnel_reminder_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.funnel_reminder_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.funnel_reminder_log TO sandbox_exec;


--
-- Name: TABLE funnel_reminder_pauses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.funnel_reminder_pauses TO anon;
GRANT ALL ON TABLE public.funnel_reminder_pauses TO authenticated;
GRANT ALL ON TABLE public.funnel_reminder_pauses TO service_role;
GRANT SELECT,INSERT ON TABLE public.funnel_reminder_pauses TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.funnel_reminder_pauses TO sandbox_exec;


--
-- Name: TABLE gallery_hotspots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gallery_hotspots TO anon;
GRANT ALL ON TABLE public.gallery_hotspots TO authenticated;
GRANT ALL ON TABLE public.gallery_hotspots TO service_role;
GRANT SELECT,INSERT ON TABLE public.gallery_hotspots TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.gallery_hotspots TO sandbox_exec;


--
-- Name: TABLE guardrail_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.guardrail_logs TO anon;
GRANT ALL ON TABLE public.guardrail_logs TO authenticated;
GRANT ALL ON TABLE public.guardrail_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.guardrail_logs TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.guardrail_logs TO sandbox_exec;


--
-- Name: TABLE guide_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.guide_views TO anon;
GRANT ALL ON TABLE public.guide_views TO authenticated;
GRANT ALL ON TABLE public.guide_views TO service_role;
GRANT SELECT,INSERT ON TABLE public.guide_views TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.guide_views TO sandbox_exec;


--
-- Name: TABLE ingestion_job_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ingestion_job_state TO anon;
GRANT ALL ON TABLE public.ingestion_job_state TO authenticated;
GRANT ALL ON TABLE public.ingestion_job_state TO service_role;
GRANT SELECT,INSERT ON TABLE public.ingestion_job_state TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ingestion_job_state TO sandbox_exec;


--
-- Name: TABLE ingestion_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ingestion_queue TO anon;
GRANT ALL ON TABLE public.ingestion_queue TO authenticated;
GRANT ALL ON TABLE public.ingestion_queue TO service_role;
GRANT SELECT,INSERT ON TABLE public.ingestion_queue TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.ingestion_queue TO sandbox_exec;


--
-- Name: TABLE inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inquiries TO anon;
GRANT ALL ON TABLE public.inquiries TO authenticated;
GRANT ALL ON TABLE public.inquiries TO service_role;
GRANT SELECT,INSERT ON TABLE public.inquiries TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.inquiries TO sandbox_exec;


--
-- Name: TABLE items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.items TO anon;
GRANT ALL ON TABLE public.items TO authenticated;
GRANT ALL ON TABLE public.items TO service_role;
GRANT SELECT,INSERT ON TABLE public.items TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.items TO sandbox_exec;


--
-- Name: TABLE journal_articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.journal_articles TO anon;
GRANT ALL ON TABLE public.journal_articles TO authenticated;
GRANT ALL ON TABLE public.journal_articles TO service_role;
GRANT SELECT,INSERT ON TABLE public.journal_articles TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.journal_articles TO sandbox_exec;


--
-- Name: TABLE journal_pipeline; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.journal_pipeline TO anon;
GRANT ALL ON TABLE public.journal_pipeline TO authenticated;
GRANT ALL ON TABLE public.journal_pipeline TO service_role;
GRANT SELECT,INSERT ON TABLE public.journal_pipeline TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.journal_pipeline TO sandbox_exec;


--
-- Name: TABLE magazine_badge_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.magazine_badge_events TO anon;
GRANT ALL ON TABLE public.magazine_badge_events TO authenticated;
GRANT ALL ON TABLE public.magazine_badge_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.magazine_badge_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.magazine_badge_events TO sandbox_exec;


--
-- Name: TABLE markup_annotations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.markup_annotations TO anon;
GRANT ALL ON TABLE public.markup_annotations TO authenticated;
GRANT ALL ON TABLE public.markup_annotations TO service_role;
GRANT SELECT,INSERT ON TABLE public.markup_annotations TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.markup_annotations TO sandbox_exec;


--
-- Name: TABLE material_swatches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.material_swatches TO anon;
GRANT ALL ON TABLE public.material_swatches TO authenticated;
GRANT ALL ON TABLE public.material_swatches TO service_role;
GRANT SELECT,INSERT ON TABLE public.material_swatches TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.material_swatches TO sandbox_exec;


--
-- Name: TABLE material_taxonomy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.material_taxonomy TO anon;
GRANT ALL ON TABLE public.material_taxonomy TO authenticated;
GRANT ALL ON TABLE public.material_taxonomy TO service_role;
GRANT SELECT,INSERT ON TABLE public.material_taxonomy TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.material_taxonomy TO sandbox_exec;


--
-- Name: COLUMN material_taxonomy.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.material_taxonomy TO anon;


--
-- Name: COLUMN material_taxonomy.slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(slug) ON TABLE public.material_taxonomy TO anon;


--
-- Name: COLUMN material_taxonomy.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name) ON TABLE public.material_taxonomy TO anon;


--
-- Name: COLUMN material_taxonomy.family; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(family) ON TABLE public.material_taxonomy TO anon;


--
-- Name: COLUMN material_taxonomy.is_active; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_active) ON TABLE public.material_taxonomy TO anon;


--
-- Name: TABLE mcp_click_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mcp_click_log TO anon;
GRANT ALL ON TABLE public.mcp_click_log TO authenticated;
GRANT ALL ON TABLE public.mcp_click_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.mcp_click_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.mcp_click_log TO sandbox_exec;


--
-- Name: TABLE mcp_query_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mcp_query_log TO anon;
GRANT ALL ON TABLE public.mcp_query_log TO authenticated;
GRANT ALL ON TABLE public.mcp_query_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.mcp_query_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.mcp_query_log TO sandbox_exec;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.notifications TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.notifications TO sandbox_exec;


--
-- Name: TABLE og_rescrape_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.og_rescrape_runs TO anon;
GRANT ALL ON TABLE public.og_rescrape_runs TO authenticated;
GRANT ALL ON TABLE public.og_rescrape_runs TO service_role;
GRANT SELECT,INSERT ON TABLE public.og_rescrape_runs TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.og_rescrape_runs TO sandbox_exec;


--
-- Name: TABLE onboarding_flow_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.onboarding_flow_config TO anon;
GRANT ALL ON TABLE public.onboarding_flow_config TO authenticated;
GRANT ALL ON TABLE public.onboarding_flow_config TO service_role;
GRANT SELECT,INSERT ON TABLE public.onboarding_flow_config TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.onboarding_flow_config TO sandbox_exec;


--
-- Name: TABLE onboarding_tour_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.onboarding_tour_steps TO anon;
GRANT ALL ON TABLE public.onboarding_tour_steps TO authenticated;
GRANT ALL ON TABLE public.onboarding_tour_steps TO service_role;
GRANT SELECT,INSERT ON TABLE public.onboarding_tour_steps TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.onboarding_tour_steps TO sandbox_exec;


--
-- Name: TABLE order_duration_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_duration_templates TO anon;
GRANT ALL ON TABLE public.order_duration_templates TO authenticated;
GRANT ALL ON TABLE public.order_duration_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.order_duration_templates TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.order_duration_templates TO sandbox_exec;


--
-- Name: TABLE order_timeline; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_timeline TO anon;
GRANT ALL ON TABLE public.order_timeline TO authenticated;
GRANT ALL ON TABLE public.order_timeline TO service_role;
GRANT SELECT,INSERT ON TABLE public.order_timeline TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.order_timeline TO sandbox_exec;


--
-- Name: TABLE order_timeline_commission; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_timeline_commission TO anon;
GRANT ALL ON TABLE public.order_timeline_commission TO authenticated;
GRANT ALL ON TABLE public.order_timeline_commission TO service_role;
GRANT SELECT,INSERT ON TABLE public.order_timeline_commission TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.order_timeline_commission TO sandbox_exec;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT SELECT,INSERT ON TABLE public.orders TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.orders TO sandbox_exec;


--
-- Name: TABLE payment_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_credentials TO anon;
GRANT ALL ON TABLE public.payment_credentials TO authenticated;
GRANT ALL ON TABLE public.payment_credentials TO service_role;
GRANT SELECT,INSERT ON TABLE public.payment_credentials TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.payment_credentials TO sandbox_exec;


--
-- Name: TABLE personal_email_domains; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.personal_email_domains TO anon;
GRANT ALL ON TABLE public.personal_email_domains TO authenticated;
GRANT ALL ON TABLE public.personal_email_domains TO service_role;
GRANT SELECT,INSERT ON TABLE public.personal_email_domains TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.personal_email_domains TO sandbox_exec;


--
-- Name: TABLE portal_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.portal_invites TO anon;
GRANT ALL ON TABLE public.portal_invites TO authenticated;
GRANT ALL ON TABLE public.portal_invites TO service_role;
GRANT SELECT,INSERT ON TABLE public.portal_invites TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.portal_invites TO sandbox_exec;


--
-- Name: TABLE portal_redemptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.portal_redemptions TO anon;
GRANT ALL ON TABLE public.portal_redemptions TO authenticated;
GRANT ALL ON TABLE public.portal_redemptions TO service_role;
GRANT SELECT,INSERT ON TABLE public.portal_redemptions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.portal_redemptions TO sandbox_exec;


--
-- Name: TABLE portal_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.portal_sessions TO anon;
GRANT ALL ON TABLE public.portal_sessions TO authenticated;
GRANT ALL ON TABLE public.portal_sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.portal_sessions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.portal_sessions TO sandbox_exec;


--
-- Name: TABLE presentation_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presentation_comments TO anon;
GRANT ALL ON TABLE public.presentation_comments TO authenticated;
GRANT ALL ON TABLE public.presentation_comments TO service_role;
GRANT SELECT,INSERT ON TABLE public.presentation_comments TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.presentation_comments TO sandbox_exec;


--
-- Name: TABLE presentation_shares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presentation_shares TO anon;
GRANT ALL ON TABLE public.presentation_shares TO authenticated;
GRANT ALL ON TABLE public.presentation_shares TO service_role;
GRANT SELECT,INSERT ON TABLE public.presentation_shares TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.presentation_shares TO sandbox_exec;


--
-- Name: TABLE presentation_slides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presentation_slides TO anon;
GRANT ALL ON TABLE public.presentation_slides TO authenticated;
GRANT ALL ON TABLE public.presentation_slides TO service_role;
GRANT SELECT,INSERT ON TABLE public.presentation_slides TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.presentation_slides TO sandbox_exec;


--
-- Name: TABLE presentations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presentations TO anon;
GRANT ALL ON TABLE public.presentations TO authenticated;
GRANT ALL ON TABLE public.presentations TO service_role;
GRANT SELECT,INSERT ON TABLE public.presentations TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.presentations TO sandbox_exec;


--
-- Name: TABLE product_cad_asset_geometry; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_cad_asset_geometry TO anon;
GRANT ALL ON TABLE public.product_cad_asset_geometry TO authenticated;
GRANT ALL ON TABLE public.product_cad_asset_geometry TO service_role;
GRANT SELECT,INSERT ON TABLE public.product_cad_asset_geometry TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.product_cad_asset_geometry TO sandbox_exec;


--
-- Name: TABLE product_descriptor_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_descriptor_links TO anon;
GRANT ALL ON TABLE public.product_descriptor_links TO authenticated;
GRANT ALL ON TABLE public.product_descriptor_links TO service_role;
GRANT SELECT,INSERT ON TABLE public.product_descriptor_links TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.product_descriptor_links TO sandbox_exec;


--
-- Name: TABLE product_fabric_swatches_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_fabric_swatches_public TO anon;
GRANT ALL ON TABLE public.product_fabric_swatches_public TO authenticated;
GRANT ALL ON TABLE public.product_fabric_swatches_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.product_fabric_swatches_public TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.product_fabric_swatches_public TO sandbox_exec;


--
-- Name: TABLE product_fabrics; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.product_fabrics TO anon;
GRANT ALL ON TABLE public.product_fabrics TO authenticated;
GRANT ALL ON TABLE public.product_fabrics TO service_role;
GRANT SELECT,INSERT ON TABLE public.product_fabrics TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.product_fabrics TO sandbox_exec;


--
-- Name: TABLE product_material_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_material_links TO anon;
GRANT ALL ON TABLE public.product_material_links TO authenticated;
GRANT ALL ON TABLE public.product_material_links TO service_role;
GRANT SELECT,INSERT ON TABLE public.product_material_links TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.product_material_links TO sandbox_exec;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email),UPDATE(email) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.first_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(first_name),UPDATE(first_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.last_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(last_name),UPDATE(last_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.company; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(company),UPDATE(company) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.phone; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(phone) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url),UPDATE(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_tier; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_tier) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_tier_suggested; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_tier_suggested) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_tier_locked_by_admin; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_tier_locked_by_admin) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_tier_12mo_spend_cents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_tier_12mo_spend_cents) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_tier_computed_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_tier_computed_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.country; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(country),UPDATE(country) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.concierge_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(concierge_name),UPDATE(concierge_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.has_seen_trade_intro; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(has_seen_trade_intro),UPDATE(has_seen_trade_intro) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.trade_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(trade_status),UPDATE(trade_status) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;
GRANT SELECT,INSERT ON TABLE public.projects TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.projects TO sandbox_exec;


--
-- Name: TABLE provenance_certificates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.provenance_certificates TO anon;
GRANT ALL ON TABLE public.provenance_certificates TO authenticated;
GRANT ALL ON TABLE public.provenance_certificates TO service_role;
GRANT SELECT,INSERT ON TABLE public.provenance_certificates TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.provenance_certificates TO sandbox_exec;


--
-- Name: TABLE provenance_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.provenance_events TO anon;
GRANT ALL ON TABLE public.provenance_events TO authenticated;
GRANT ALL ON TABLE public.provenance_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.provenance_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.provenance_events TO sandbox_exec;


--
-- Name: TABLE public_download_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.public_download_events TO anon;
GRANT ALL ON TABLE public.public_download_events TO authenticated;
GRANT ALL ON TABLE public.public_download_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.public_download_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.public_download_events TO sandbox_exec;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;
GRANT SELECT,INSERT ON TABLE public.purchase_orders TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.purchase_orders TO sandbox_exec;


--
-- Name: TABLE purchase_orders_payable; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchase_orders_payable TO anon;
GRANT ALL ON TABLE public.purchase_orders_payable TO authenticated;
GRANT ALL ON TABLE public.purchase_orders_payable TO service_role;
GRANT SELECT,INSERT ON TABLE public.purchase_orders_payable TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.purchase_orders_payable TO sandbox_exec;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT SELECT,INSERT ON TABLE public.push_subscriptions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.push_subscriptions TO sandbox_exec;


--
-- Name: TABLE quote_email_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote_email_log TO anon;
GRANT ALL ON TABLE public.quote_email_log TO authenticated;
GRANT ALL ON TABLE public.quote_email_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.quote_email_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.quote_email_log TO sandbox_exec;


--
-- Name: TABLE quote_payment_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quote_payment_links TO anon;
GRANT ALL ON TABLE public.quote_payment_links TO authenticated;
GRANT ALL ON TABLE public.quote_payment_links TO service_role;
GRANT SELECT,INSERT ON TABLE public.quote_payment_links TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.quote_payment_links TO sandbox_exec;


--
-- Name: TABLE quotes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quotes TO anon;
GRANT ALL ON TABLE public.quotes TO authenticated;
GRANT ALL ON TABLE public.quotes TO service_role;
GRANT SELECT,INSERT ON TABLE public.quotes TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.quotes TO sandbox_exec;


--
-- Name: TABLE reference_styles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reference_styles TO anon;
GRANT ALL ON TABLE public.reference_styles TO authenticated;
GRANT ALL ON TABLE public.reference_styles TO service_role;
GRANT SELECT,INSERT ON TABLE public.reference_styles TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.reference_styles TO sandbox_exec;


--
-- Name: TABLE regional_logistics_rules; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.regional_logistics_rules TO anon;
GRANT ALL ON TABLE public.regional_logistics_rules TO authenticated;
GRANT ALL ON TABLE public.regional_logistics_rules TO service_role;
GRANT SELECT,INSERT ON TABLE public.regional_logistics_rules TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.regional_logistics_rules TO sandbox_exec;


--
-- Name: SEQUENCE regional_logistics_rules_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.regional_logistics_rules_id_seq TO anon;
GRANT ALL ON SEQUENCE public.regional_logistics_rules_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.regional_logistics_rules_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.regional_logistics_rules_id_seq TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,USAGE ON SEQUENCE public.regional_logistics_rules_id_seq TO sandbox_exec;


--
-- Name: TABLE regional_logistics_tiers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.regional_logistics_tiers TO anon;
GRANT ALL ON TABLE public.regional_logistics_tiers TO authenticated;
GRANT ALL ON TABLE public.regional_logistics_tiers TO service_role;
GRANT SELECT,INSERT ON TABLE public.regional_logistics_tiers TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.regional_logistics_tiers TO sandbox_exec;


--
-- Name: TABLE room_planner_projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.room_planner_projects TO anon;
GRANT ALL ON TABLE public.room_planner_projects TO authenticated;
GRANT ALL ON TABLE public.room_planner_projects TO service_role;
GRANT SELECT,INSERT ON TABLE public.room_planner_projects TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.room_planner_projects TO sandbox_exec;


--
-- Name: TABLE sample_request_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sample_request_audit_log TO anon;
GRANT ALL ON TABLE public.sample_request_audit_log TO authenticated;
GRANT ALL ON TABLE public.sample_request_audit_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.sample_request_audit_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.sample_request_audit_log TO sandbox_exec;


--
-- Name: TABLE scrape_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scrape_configs TO anon;
GRANT ALL ON TABLE public.scrape_configs TO authenticated;
GRANT ALL ON TABLE public.scrape_configs TO service_role;
GRANT SELECT,INSERT ON TABLE public.scrape_configs TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.scrape_configs TO sandbox_exec;


--
-- Name: TABLE scrape_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scrape_runs TO anon;
GRANT ALL ON TABLE public.scrape_runs TO authenticated;
GRANT ALL ON TABLE public.scrape_runs TO service_role;
GRANT SELECT,INSERT ON TABLE public.scrape_runs TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.scrape_runs TO sandbox_exec;


--
-- Name: TABLE section_heroes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.section_heroes TO anon;
GRANT ALL ON TABLE public.section_heroes TO authenticated;
GRANT ALL ON TABLE public.section_heroes TO service_role;
GRANT SELECT,INSERT ON TABLE public.section_heroes TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.section_heroes TO sandbox_exec;


--
-- Name: TABLE security_alert_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.security_alert_state TO anon;
GRANT ALL ON TABLE public.security_alert_state TO authenticated;
GRANT ALL ON TABLE public.security_alert_state TO service_role;
GRANT SELECT,INSERT ON TABLE public.security_alert_state TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.security_alert_state TO sandbox_exec;


--
-- Name: TABLE security_audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.security_audit_events TO anon;
GRANT ALL ON TABLE public.security_audit_events TO authenticated;
GRANT ALL ON TABLE public.security_audit_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.security_audit_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.security_audit_events TO sandbox_exec;


--
-- Name: TABLE shipping_duty_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_duty_rates TO anon;
GRANT ALL ON TABLE public.shipping_duty_rates TO authenticated;
GRANT ALL ON TABLE public.shipping_duty_rates TO service_role;
GRANT SELECT,INSERT ON TABLE public.shipping_duty_rates TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shipping_duty_rates TO sandbox_exec;


--
-- Name: TABLE shipping_lanes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_lanes TO anon;
GRANT ALL ON TABLE public.shipping_lanes TO authenticated;
GRANT ALL ON TABLE public.shipping_lanes TO service_role;
GRANT SELECT,INSERT ON TABLE public.shipping_lanes TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shipping_lanes TO sandbox_exec;


--
-- Name: TABLE shipping_quotes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_quotes TO anon;
GRANT ALL ON TABLE public.shipping_quotes TO authenticated;
GRANT ALL ON TABLE public.shipping_quotes TO service_role;
GRANT SELECT,INSERT ON TABLE public.shipping_quotes TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shipping_quotes TO sandbox_exec;


--
-- Name: TABLE shipping_rate_brackets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_rate_brackets TO anon;
GRANT ALL ON TABLE public.shipping_rate_brackets TO authenticated;
GRANT ALL ON TABLE public.shipping_rate_brackets TO service_role;
GRANT SELECT,INSERT ON TABLE public.shipping_rate_brackets TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shipping_rate_brackets TO sandbox_exec;


--
-- Name: TABLE shipping_surcharges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_surcharges TO anon;
GRANT ALL ON TABLE public.shipping_surcharges TO authenticated;
GRANT ALL ON TABLE public.shipping_surcharges TO service_role;
GRANT SELECT,INSERT ON TABLE public.shipping_surcharges TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shipping_surcharges TO sandbox_exec;


--
-- Name: TABLE shop_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shop_order_items TO anon;
GRANT ALL ON TABLE public.shop_order_items TO authenticated;
GRANT ALL ON TABLE public.shop_order_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.shop_order_items TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shop_order_items TO sandbox_exec;


--
-- Name: TABLE shop_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shop_orders TO anon;
GRANT ALL ON TABLE public.shop_orders TO authenticated;
GRANT ALL ON TABLE public.shop_orders TO service_role;
GRANT SELECT,INSERT ON TABLE public.shop_orders TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.shop_orders TO sandbox_exec;


--
-- Name: TABLE sitemap_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sitemap_products TO anon;
GRANT ALL ON TABLE public.sitemap_products TO authenticated;
GRANT ALL ON TABLE public.sitemap_products TO service_role;
GRANT SELECT,INSERT ON TABLE public.sitemap_products TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.sitemap_products TO sandbox_exec;


--
-- Name: TABLE studio_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_alerts TO anon;
GRANT ALL ON TABLE public.studio_alerts TO authenticated;
GRANT ALL ON TABLE public.studio_alerts TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_alerts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_alerts TO sandbox_exec;


--
-- Name: TABLE studio_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_invites TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_invites TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_invites TO sandbox_exec;
GRANT INSERT,DELETE,UPDATE ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.studio_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(studio_id) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(role) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.invited_by; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(invited_by) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.accepted_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(accepted_at) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.accepted_by; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(accepted_by) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(expires_at) ON TABLE public.studio_invites TO authenticated;


--
-- Name: COLUMN studio_invites.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.studio_invites TO authenticated;


--
-- Name: TABLE studio_lead_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_lead_events TO anon;
GRANT ALL ON TABLE public.studio_lead_events TO authenticated;
GRANT ALL ON TABLE public.studio_lead_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_lead_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_lead_events TO sandbox_exec;


--
-- Name: TABLE studio_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_members TO anon;
GRANT ALL ON TABLE public.studio_members TO authenticated;
GRANT ALL ON TABLE public.studio_members TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_members TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_members TO sandbox_exec;


--
-- Name: TABLE studio_payout_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_payout_accounts TO anon;
GRANT ALL ON TABLE public.studio_payout_accounts TO authenticated;
GRANT ALL ON TABLE public.studio_payout_accounts TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_payout_accounts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_payout_accounts TO sandbox_exec;


--
-- Name: TABLE studio_project_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_project_overrides TO anon;
GRANT ALL ON TABLE public.studio_project_overrides TO authenticated;
GRANT ALL ON TABLE public.studio_project_overrides TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_project_overrides TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_project_overrides TO sandbox_exec;


--
-- Name: TABLE studio_resale_certificates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_resale_certificates TO anon;
GRANT ALL ON TABLE public.studio_resale_certificates TO authenticated;
GRANT ALL ON TABLE public.studio_resale_certificates TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_resale_certificates TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_resale_certificates TO sandbox_exec;


--
-- Name: TABLE studio_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_submissions TO anon;
GRANT ALL ON TABLE public.studio_submissions TO authenticated;
GRANT ALL ON TABLE public.studio_submissions TO service_role;
GRANT SELECT,INSERT ON TABLE public.studio_submissions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studio_submissions TO sandbox_exec;


--
-- Name: TABLE studios; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.studios TO anon;
GRANT ALL ON TABLE public.studios TO authenticated;
GRANT ALL ON TABLE public.studios TO service_role;
GRANT SELECT,INSERT ON TABLE public.studios TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.studios TO sandbox_exec;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;
GRANT SELECT,INSERT ON TABLE public.suppliers TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.suppliers TO sandbox_exec;


--
-- Name: TABLE suppressed_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppressed_emails TO anon;
GRANT ALL ON TABLE public.suppressed_emails TO authenticated;
GRANT ALL ON TABLE public.suppressed_emails TO service_role;
GRANT SELECT,INSERT ON TABLE public.suppressed_emails TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.suppressed_emails TO sandbox_exec;


--
-- Name: TABLE tour_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tour_events TO anon;
GRANT ALL ON TABLE public.tour_events TO authenticated;
GRANT ALL ON TABLE public.tour_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.tour_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.tour_events TO sandbox_exec;


--
-- Name: TABLE trade_applications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_applications TO anon;
GRANT ALL ON TABLE public.trade_applications TO authenticated;
GRANT ALL ON TABLE public.trade_applications TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_applications TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_applications TO sandbox_exec;


--
-- Name: TABLE trade_concierge_actions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_concierge_actions TO anon;
GRANT ALL ON TABLE public.trade_concierge_actions TO authenticated;
GRANT ALL ON TABLE public.trade_concierge_actions TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_actions TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_actions TO sandbox_exec;


--
-- Name: TABLE trade_concierge_escalations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_concierge_escalations TO anon;
GRANT ALL ON TABLE public.trade_concierge_escalations TO authenticated;
GRANT ALL ON TABLE public.trade_concierge_escalations TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_escalations TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_escalations TO sandbox_exec;


--
-- Name: TABLE trade_concierge_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_concierge_usage TO anon;
GRANT ALL ON TABLE public.trade_concierge_usage TO authenticated;
GRANT ALL ON TABLE public.trade_concierge_usage TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_usage TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_concierge_usage TO sandbox_exec;


--
-- Name: TABLE trade_credits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_credits TO anon;
GRANT ALL ON TABLE public.trade_credits TO authenticated;
GRANT ALL ON TABLE public.trade_credits TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_credits TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_credits TO sandbox_exec;


--
-- Name: TABLE trade_custom_request_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_custom_request_activity TO anon;
GRANT ALL ON TABLE public.trade_custom_request_activity TO authenticated;
GRANT ALL ON TABLE public.trade_custom_request_activity TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_custom_request_activity TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_custom_request_activity TO sandbox_exec;


--
-- Name: TABLE trade_custom_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_custom_requests TO anon;
GRANT ALL ON TABLE public.trade_custom_requests TO authenticated;
GRANT ALL ON TABLE public.trade_custom_requests TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_custom_requests TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_custom_requests TO sandbox_exec;


--
-- Name: TABLE trade_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_documents TO anon;
GRANT ALL ON TABLE public.trade_documents TO authenticated;
GRANT ALL ON TABLE public.trade_documents TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_documents TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_documents TO sandbox_exec;


--
-- Name: TABLE trade_fair_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_fair_events TO anon;
GRANT ALL ON TABLE public.trade_fair_events TO authenticated;
GRANT ALL ON TABLE public.trade_fair_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_fair_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_fair_events TO sandbox_exec;


--
-- Name: TABLE trade_favorites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_favorites TO anon;
GRANT ALL ON TABLE public.trade_favorites TO authenticated;
GRANT ALL ON TABLE public.trade_favorites TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_favorites TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_favorites TO sandbox_exec;


--
-- Name: TABLE trade_floor_plan_layouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_floor_plan_layouts TO anon;
GRANT ALL ON TABLE public.trade_floor_plan_layouts TO authenticated;
GRANT ALL ON TABLE public.trade_floor_plan_layouts TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_floor_plan_layouts TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_floor_plan_layouts TO sandbox_exec;


--
-- Name: TABLE trade_floor_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_floor_plans TO anon;
GRANT ALL ON TABLE public.trade_floor_plans TO authenticated;
GRANT ALL ON TABLE public.trade_floor_plans TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_floor_plans TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_floor_plans TO sandbox_exec;


--
-- Name: TABLE trade_product_cad_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_product_cad_assets TO anon;
GRANT ALL ON TABLE public.trade_product_cad_assets TO authenticated;
GRANT ALL ON TABLE public.trade_product_cad_assets TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_product_cad_assets TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_product_cad_assets TO sandbox_exec;


--
-- Name: TABLE trade_product_glb_variants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_product_glb_variants TO anon;
GRANT ALL ON TABLE public.trade_product_glb_variants TO authenticated;
GRANT ALL ON TABLE public.trade_product_glb_variants TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_product_glb_variants TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_product_glb_variants TO sandbox_exec;


--
-- Name: TABLE trade_product_pricing; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_product_pricing TO anon;
GRANT ALL ON TABLE public.trade_product_pricing TO authenticated;
GRANT ALL ON TABLE public.trade_product_pricing TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_product_pricing TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_product_pricing TO sandbox_exec;


--
-- Name: TABLE trade_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_products TO anon;
GRANT ALL ON TABLE public.trade_products TO authenticated;
GRANT ALL ON TABLE public.trade_products TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_products TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_products TO sandbox_exec;


--
-- Name: TABLE trade_products_public_rrp; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_products_public_rrp TO anon;
GRANT ALL ON TABLE public.trade_products_public_rrp TO authenticated;
GRANT ALL ON TABLE public.trade_products_public_rrp TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_products_public_rrp TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_products_public_rrp TO sandbox_exec;


--
-- Name: TABLE trade_program_signups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_program_signups TO anon;
GRANT ALL ON TABLE public.trade_program_signups TO authenticated;
GRANT ALL ON TABLE public.trade_program_signups TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_program_signups TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_program_signups TO sandbox_exec;


--
-- Name: TABLE trade_quote_extras; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_quote_extras TO anon;
GRANT ALL ON TABLE public.trade_quote_extras TO authenticated;
GRANT ALL ON TABLE public.trade_quote_extras TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_quote_extras TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_quote_extras TO sandbox_exec;


--
-- Name: TABLE trade_quote_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_quote_items TO anon;
GRANT ALL ON TABLE public.trade_quote_items TO authenticated;
GRANT ALL ON TABLE public.trade_quote_items TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_quote_items TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_quote_items TO sandbox_exec;


--
-- Name: TABLE trade_quotes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_quotes TO anon;
GRANT ALL ON TABLE public.trade_quotes TO authenticated;
GRANT ALL ON TABLE public.trade_quotes TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_quotes TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_quotes TO sandbox_exec;


--
-- Name: TABLE trade_recent_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_recent_views TO anon;
GRANT ALL ON TABLE public.trade_recent_views TO authenticated;
GRANT ALL ON TABLE public.trade_recent_views TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_recent_views TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_recent_views TO sandbox_exec;


--
-- Name: TABLE trade_sample_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_sample_requests TO anon;
GRANT ALL ON TABLE public.trade_sample_requests TO authenticated;
GRANT ALL ON TABLE public.trade_sample_requests TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_sample_requests TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_sample_requests TO sandbox_exec;


--
-- Name: TABLE trade_tier_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_tier_config TO anon;
GRANT ALL ON TABLE public.trade_tier_config TO authenticated;
GRANT ALL ON TABLE public.trade_tier_config TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_tier_config TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_tier_config TO sandbox_exec;


--
-- Name: TABLE trade_user_memory; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trade_user_memory TO anon;
GRANT ALL ON TABLE public.trade_user_memory TO authenticated;
GRANT ALL ON TABLE public.trade_user_memory TO service_role;
GRANT SELECT,INSERT ON TABLE public.trade_user_memory TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.trade_user_memory TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE verification_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verification_audit_log TO anon;
GRANT ALL ON TABLE public.verification_audit_log TO authenticated;
GRANT ALL ON TABLE public.verification_audit_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.verification_audit_log TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.verification_audit_log TO sandbox_exec;


--
-- Name: TABLE verification_feedback_loops; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verification_feedback_loops TO anon;
GRANT ALL ON TABLE public.verification_feedback_loops TO authenticated;
GRANT ALL ON TABLE public.verification_feedback_loops TO service_role;
GRANT SELECT,INSERT ON TABLE public.verification_feedback_loops TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.verification_feedback_loops TO sandbox_exec;


--
-- Name: TABLE video_watch_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.video_watch_events TO anon;
GRANT ALL ON TABLE public.video_watch_events TO authenticated;
GRANT ALL ON TABLE public.video_watch_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.video_watch_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.video_watch_events TO sandbox_exec;


--
-- Name: TABLE whatsapp_delivery_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_delivery_events TO anon;
GRANT ALL ON TABLE public.whatsapp_delivery_events TO authenticated;
GRANT ALL ON TABLE public.whatsapp_delivery_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.whatsapp_delivery_events TO sandbox_exec_dcrauiygaezoduwdjmsm;
GRANT SELECT,INSERT ON TABLE public.whatsapp_delivery_events TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec_dcrauiygaezoduwdjmsm;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec_dcrauiygaezoduwdjmsm;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict vifwVNYbdjDJW6cfDZyaKe32jlKoxtb856oeYYQat0BOULbUxq2hILvju9Wxyke

