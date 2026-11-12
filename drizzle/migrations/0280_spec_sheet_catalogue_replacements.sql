CREATE TABLE public.spec_sheet_catalogue_replacements (
 user_id uuid NOT NULL,
 source_product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
 replacement_product_id uuid NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
 PRIMARY KEY (user_id, source_product_id),
 CHECK (source_product_id <> replacement_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_sheet_catalogue_replacements TO authenticated;
GRANT ALL ON public.spec_sheet_catalogue_replacements TO service_role;
ALTER TABLE public.spec_sheet_catalogue_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage spec sheet replacements" ON public.spec_sheet_catalogue_replacements FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));