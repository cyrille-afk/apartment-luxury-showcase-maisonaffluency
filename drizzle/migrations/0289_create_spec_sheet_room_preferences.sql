CREATE TABLE public.spec_sheet_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name)),
  budget_cents integer CHECK (budget_cents IS NULL OR budget_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = upper(currency) AND char_length(currency) = 3),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX spec_sheet_rooms_scope_name_unique ON public.spec_sheet_rooms (user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX spec_sheet_rooms_scope_idx ON public.spec_sheet_rooms (user_id, project_id, position, name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_sheet_rooms TO authenticated;
GRANT ALL ON public.spec_sheet_rooms TO service_role;
ALTER TABLE public.spec_sheet_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage specification rooms" ON public.spec_sheet_rooms FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE public.spec_sheet_item_rooms (
  user_id uuid NOT NULL,
  quote_item_id uuid NOT NULL REFERENCES public.trade_quote_items(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.spec_sheet_rooms(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quote_item_id)
);
CREATE INDEX spec_sheet_item_rooms_room_idx ON public.spec_sheet_item_rooms(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_sheet_item_rooms TO authenticated;
GRANT ALL ON public.spec_sheet_item_rooms TO service_role;
ALTER TABLE public.spec_sheet_item_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage specification item rooms" ON public.spec_sheet_item_rooms FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.spec_sheet_rooms r
      WHERE r.id = room_id AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.trade_quote_items qi
      JOIN public.trade_quotes q ON q.id = qi.quote_id
      WHERE qi.id = quote_item_id AND q.user_id = (SELECT auth.uid())
    )
  );
COMMENT ON TABLE public.spec_sheet_rooms IS 'Account/project-scoped presentation rooms and optional client-price budgets; never alters quote records.';
COMMENT ON TABLE public.spec_sheet_item_rooms IS 'Account-owned quote-line room overrides for specification presentations; inherited project folder names remain the default.';