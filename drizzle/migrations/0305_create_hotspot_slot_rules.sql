CREATE TABLE public.hotspot_slot_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_studio_item_id uuid REFERENCES public.project_studio_items(id) ON DELETE CASCADE,
 is_swappable boolean DEFAULT true,
 allow_finish_customization boolean DEFAULT true,
 selection_mode text DEFAULT 'auto_footprint',
 pinned_alternative_ids uuid[],
 max_price_delta_pct int DEFAULT 25
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotspot_slot_rules TO authenticated;
GRANT ALL ON public.hotspot_slot_rules TO service_role;
ALTER TABLE public.hotspot_slot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY hotspot_slot_rules_read ON public.hotspot_slot_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.project_studio_items i WHERE i.id = project_studio_item_id AND public.can_view_project(auth.uid(), i.project_id)));
CREATE POLICY hotspot_slot_rules_insert ON public.hotspot_slot_rules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.project_studio_items i WHERE i.id = project_studio_item_id AND public.can_edit_project(auth.uid(), i.project_id)));
CREATE POLICY hotspot_slot_rules_update ON public.hotspot_slot_rules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.project_studio_items i WHERE i.id = project_studio_item_id AND public.can_edit_project(auth.uid(), i.project_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.project_studio_items i WHERE i.id = project_studio_item_id AND public.can_edit_project(auth.uid(), i.project_id)));
CREATE POLICY hotspot_slot_rules_delete ON public.hotspot_slot_rules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.project_studio_items i WHERE i.id = project_studio_item_id AND public.can_edit_project(auth.uid(), i.project_id)));
CREATE INDEX hotspot_slot_rules_item_idx ON public.hotspot_slot_rules(project_studio_item_id);