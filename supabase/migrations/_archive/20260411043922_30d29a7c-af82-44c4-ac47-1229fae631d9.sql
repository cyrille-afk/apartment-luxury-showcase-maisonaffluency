ALTER TABLE public.axonometric_requests
  ADD COLUMN IF NOT EXISTS room_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS style_direction text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lighting_mood text DEFAULT '',
  ADD COLUMN IF NOT EXISTS render_engine text DEFAULT 'no_preference',
  ADD COLUMN IF NOT EXISTS resolution text DEFAULT '4k',
  ADD COLUMN IF NOT EXISTS camera_angles text DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_formats text DEFAULT '';