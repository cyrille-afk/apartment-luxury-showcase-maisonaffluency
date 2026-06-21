-- Table-level SELECT was overriding the column-level REVOKE on `token`.
-- Drop the blanket SELECT, then grant SELECT explicitly on the non-secret columns.
REVOKE SELECT ON public.studio_invites FROM authenticated;
REVOKE SELECT ON public.studio_invites FROM anon;

GRANT SELECT (id, studio_id, email, role, invited_by, created_at, expires_at, accepted_at)
  ON public.studio_invites TO authenticated;
-- anon has no RLS policy granting reads, so no column grants needed there.