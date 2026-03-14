-- Drop the overly permissive policies on gallery_hotspots
DROP POLICY IF EXISTS "Anyone can delete gallery hotspots" ON public.gallery_hotspots;
DROP POLICY IF EXISTS "Anyone can insert gallery hotspots" ON public.gallery_hotspots;
DROP POLICY IF EXISTS "Anyone can update gallery hotspots" ON public.gallery_hotspots;

-- Replace with admin-only write policies
CREATE POLICY "Admins can insert gallery hotspots"
ON public.gallery_hotspots FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gallery hotspots"
ON public.gallery_hotspots FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery hotspots"
ON public.gallery_hotspots FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));