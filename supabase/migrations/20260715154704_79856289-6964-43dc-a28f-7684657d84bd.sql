-- MCP analytics: query log (tool invocations) and click log (product/signup redirect clicks)

CREATE TABLE public.mcp_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  args jsonb,
  result_count integer,
  is_error boolean NOT NULL DEFAULT false,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcp_query_log_created_at ON public.mcp_query_log (created_at DESC);
CREATE INDEX idx_mcp_query_log_tool ON public.mcp_query_log (tool_name, created_at DESC);

GRANT INSERT ON public.mcp_query_log TO anon, authenticated;
GRANT ALL ON public.mcp_query_log TO service_role;
ALTER TABLE public.mcp_query_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may insert MCP query events"
  ON public.mcp_query_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins may read MCP query log"
  ON public.mcp_query_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.mcp_click_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  click_type text NOT NULL CHECK (click_type IN ('product', 'signup', 'designer')),
  pick_id uuid,
  designer_slug text,
  ip_hash text,
  user_agent text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcp_click_log_created_at ON public.mcp_click_log (created_at DESC);
CREATE INDEX idx_mcp_click_log_type ON public.mcp_click_log (click_type, created_at DESC);
CREATE INDEX idx_mcp_click_log_pick ON public.mcp_click_log (pick_id) WHERE pick_id IS NOT NULL;

GRANT INSERT ON public.mcp_click_log TO anon, authenticated;
GRANT ALL ON public.mcp_click_log TO service_role;
ALTER TABLE public.mcp_click_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may insert MCP click events"
  ON public.mcp_click_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins may read MCP click log"
  ON public.mcp_click_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));