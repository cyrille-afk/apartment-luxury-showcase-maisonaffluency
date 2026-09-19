
-- Step 6 — extend ai_usage_events with cache + fingerprint + tier columns.
ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS cached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prompt_hash TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT;

CREATE INDEX IF NOT EXISTS ai_usage_events_prompt_hash_idx
  ON public.ai_usage_events (prompt_hash)
  WHERE prompt_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_usage_events_feature_tier_idx
  ON public.ai_usage_events (feature, tier, created_at DESC);

-- Step 7 — response cache table.
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  hits INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (feature, model, prompt_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_response_cache TO authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Admins-only read; writes happen through service_role from edge functions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_response_cache' AND policyname = 'ai_response_cache_admin_read'
  ) THEN
    CREATE POLICY ai_response_cache_admin_read
      ON public.ai_response_cache
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx
  ON public.ai_response_cache (expires_at);
