CREATE TABLE public.viewing_room_invite_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_project_id uuid NOT NULL REFERENCES public.developer_projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('attempt','sent','validation_error','send_failed')),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX viewing_room_invite_activity_dev_time ON public.viewing_room_invite_activity (developer_project_id, created_at DESC);
GRANT SELECT, INSERT ON public.viewing_room_invite_activity TO authenticated;
GRANT ALL ON public.viewing_room_invite_activity TO service_role;
ALTER TABLE public.viewing_room_invite_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY vr_invite_activity_admin_read ON public.viewing_room_invite_activity FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY vr_invite_activity_admin_insert ON public.viewing_room_invite_activity FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());