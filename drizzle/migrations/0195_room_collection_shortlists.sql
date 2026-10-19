ALTER TABLE public.comparator_shortlists ADD COLUMN IF NOT EXISTS room_slug text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comparator_shortlists TO authenticated;
GRANT ALL ON public.comparator_shortlists TO service_role;
ALTER TABLE public.comparator_shortlists ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS comparator_shortlists_owner_room_idx ON public.comparator_shortlists(user_id, room_slug, created_at DESC);