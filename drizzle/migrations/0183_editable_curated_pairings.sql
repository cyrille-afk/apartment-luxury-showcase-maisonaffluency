CREATE TABLE public.curated_pairing_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_category text NOT NULL,
 target_category text NOT NULL,
 preferred_pick_id uuid REFERENCES public.designer_curator_picks(id) ON DELETE SET NULL,
 sort_order integer NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT true,
 CONSTRAINT curated_pairing_source_valid CHECK (source_category IN ('ceiling','wall','table-light','seating','tables','decor','storage')),
 CONSTRAINT curated_pairing_target_valid CHECK (target_category IN ('ceiling','wall','table-light','seating','tables','decor','storage')),
 CONSTRAINT curated_pairing_cross_category CHECK (source_category <> target_category),
 CONSTRAINT curated_pairing_order_valid CHECK (sort_order BETWEEN 0 AND 999)
);
GRANT SELECT ON public.curated_pairing_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curated_pairing_rules TO authenticated;
GRANT ALL ON public.curated_pairing_rules TO service_role;
ALTER TABLE public.curated_pairing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published pairing rules" ON public.curated_pairing_rules FOR SELECT TO anon, authenticated USING (enabled OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage pairing rules" ON public.curated_pairing_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX curated_pairing_rules_source_order ON public.curated_pairing_rules(source_category, sort_order);
COMMENT ON TABLE public.curated_pairing_rules IS 'Editorial cross-category private-client cart recommendations; optional preferred pick must still be publicly published and match the target category.';