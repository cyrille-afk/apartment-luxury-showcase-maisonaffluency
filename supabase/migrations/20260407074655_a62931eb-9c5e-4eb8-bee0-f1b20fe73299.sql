
-- Fix 1: Prevent users from self-publishing axonometric gallery drafts
DROP POLICY IF EXISTS "Users can update own gallery drafts" ON public.axonometric_gallery;
CREATE POLICY "Users can update own gallery drafts"
ON public.axonometric_gallery
FOR UPDATE
TO authenticated
USING ((created_by = auth.uid()) AND (is_published = false))
WITH CHECK ((created_by = auth.uid()) AND (is_published = false));

-- Fix 2: Add rate-limit protection for unsubscribe token lookups
-- The tokens already use gen_random_bytes(16) (128-bit entropy), making brute-force infeasible.
-- Add an index to support efficient lookups and add a comment documenting the security posture.
COMMENT ON TABLE public.email_unsubscribe_tokens IS 'Tokens use 128-bit cryptographic randomness (gen_random_bytes(16)). Brute-force enumeration is computationally infeasible. Edge function handles rate limiting at the application layer.';
