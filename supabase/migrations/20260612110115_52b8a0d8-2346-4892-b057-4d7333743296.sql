
CREATE TABLE public.concierge_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concierge_rate_limits_reset_at ON public.concierge_rate_limits(reset_at);

GRANT ALL ON public.concierge_rate_limits TO service_role;

ALTER TABLE public.concierge_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.concierge_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.concierge_check_rate_limit(
  _key TEXT,
  _limit INTEGER,
  _window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, retry_in INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.concierge_check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.concierge_check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
