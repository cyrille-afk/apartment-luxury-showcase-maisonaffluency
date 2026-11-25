CREATE TABLE public.ai_render_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text,
  proposal_id uuid REFERENCES public.viewing_room_proposal_requests(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.axonometric_requests(id) ON DELETE SET NULL,
  source_image_url text,
  result_image_url text NOT NULL,
  mode text NOT NULL,
  style_preset text,
  style_prompt text,
  quality_tier text NOT NULL DEFAULT 'standard' CHECK (quality_tier IN ('draft', 'standard', 'premium')),
  prompt_note text,
  kind text NOT NULL DEFAULT 'generation' CHECK (kind IN ('generation', 'ai_edit', 'scene_edit')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_render_history TO authenticated;
GRANT ALL ON public.ai_render_history TO service_role;

ALTER TABLE public.ai_render_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai render history"
  ON public.ai_render_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_ai_render_history_project_created
  ON public.ai_render_history (project_id, created_at DESC);

CREATE INDEX idx_ai_render_history_proposal_created
  ON public.ai_render_history (proposal_id, created_at DESC)
  WHERE proposal_id IS NOT NULL;

CREATE INDEX idx_ai_render_history_created
  ON public.ai_render_history (created_at DESC);