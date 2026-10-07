CREATE TABLE public.ai_curated_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled layout',
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  scene jsonb NOT NULL,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_curated_layouts TO authenticated;
GRANT ALL ON public.ai_curated_layouts TO service_role;
ALTER TABLE public.ai_curated_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their layouts" ON public.ai_curated_layouts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_approved_trade_user(auth.uid()));
CREATE INDEX ai_curated_layouts_user_idx ON public.ai_curated_layouts(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.ai_curated_layouts_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER ai_curated_layouts_touch BEFORE UPDATE ON public.ai_curated_layouts FOR EACH ROW EXECUTE FUNCTION public.ai_curated_layouts_touch();

-- Read-only client access by unguessable token; only shared layouts, no owner identity.
CREATE OR REPLACE FUNCTION public.get_shared_ai_layout(_token text)
RETURNS TABLE(title text, scene jsonb, products jsonb, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.title, l.scene, l.products, l.updated_at FROM public.ai_curated_layouts l
  WHERE l.share_token = _token AND l.is_shared AND length(_token) >= 32 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_shared_ai_layout(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_ai_layout(text) TO anon, authenticated;