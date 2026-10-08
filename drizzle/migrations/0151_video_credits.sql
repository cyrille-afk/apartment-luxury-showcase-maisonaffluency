CREATE TABLE public.video_credits (
  user_id uuid PRIMARY KEY,
  video_tokens_balance integer NOT NULL DEFAULT 0 CHECK (video_tokens_balance >= 0),
  gold_month text,
  gold_month_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_credits TO authenticated;
GRANT ALL ON public.video_credits TO service_role;
ALTER TABLE public.video_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own video credits" ON public.video_credits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.video_pass_purchases (
  stripe_session_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  credits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_pass_purchases TO authenticated;
GRANT ALL ON public.video_pass_purchases TO service_role;
ALTER TABLE public.video_pass_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own video passes" ON public.video_pass_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atomic consume: kind = 'gold_monthly' or 'token'. Returns the source used or null.
CREATE OR REPLACE FUNCTION public.consume_video_credit(_user uuid, _gold boolean, _month text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.video_credits;
BEGIN
  INSERT INTO public.video_credits(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.video_credits WHERE user_id = _user FOR UPDATE;
  IF _gold AND (r.gold_month IS DISTINCT FROM _month OR r.gold_month_used < 1) THEN
    UPDATE public.video_credits SET gold_month = _month,
      gold_month_used = CASE WHEN r.gold_month IS DISTINCT FROM _month THEN 1 ELSE r.gold_month_used + 1 END,
      updated_at = now() WHERE user_id = _user;
    RETURN 'gold_monthly';
  END IF;
  IF r.video_tokens_balance > 0 THEN
    UPDATE public.video_credits SET video_tokens_balance = video_tokens_balance - 1, updated_at = now() WHERE user_id = _user;
    RETURN 'token';
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.refund_video_credit(_user uuid, _source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _source = 'token' THEN
    UPDATE public.video_credits SET video_tokens_balance = video_tokens_balance + 1, updated_at = now() WHERE user_id = _user;
  ELSIF _source = 'gold_monthly' THEN
    UPDATE public.video_credits SET gold_month_used = GREATEST(0, gold_month_used - 1), updated_at = now() WHERE user_id = _user;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.grant_video_pass(_session text, _user uuid, _credits integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.video_pass_purchases(stripe_session_id, user_id, credits) VALUES (_session, _user, _credits) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.video_credits(user_id, video_tokens_balance) VALUES (_user, _credits)
    ON CONFLICT (user_id) DO UPDATE SET video_tokens_balance = video_credits.video_tokens_balance + _credits, updated_at = now();
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.consume_video_credit(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_video_credit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_video_pass(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_video_credit(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_video_credit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_video_pass(text, uuid, integer) TO service_role;