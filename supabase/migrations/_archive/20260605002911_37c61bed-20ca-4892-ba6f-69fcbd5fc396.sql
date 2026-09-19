
-- Phase 1: CAD spatial-fit foundation

-- 1) cad_documents: user-uploaded floor plans (studio-shared from day 1)
CREATE TABLE public.cad_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_path text NOT NULL,          -- storage object path in cad-uploads bucket
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('dxf','dwg','obj','fbx','skp','step','iges','3ds','rfa')),
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parsing','ready','failed','unsupported')),
  parsed_geometry jsonb,            -- { rooms:[{label,bbox_mm,area_m2,polygon}], openings:[], units, bbox_mm }
  error text,
  parsed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cad_documents_studio ON public.cad_documents(studio_id);
CREATE INDEX idx_cad_documents_uploader ON public.cad_documents(uploaded_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cad_documents TO authenticated;
GRANT ALL ON public.cad_documents TO service_role;

ALTER TABLE public.cad_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can view cad documents"
ON public.cad_documents FOR SELECT TO authenticated
USING (
  studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id)
  OR uploaded_by = auth.uid()
);

CREATE POLICY "Studio members can insert cad documents"
ON public.cad_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (studio_id IS NULL OR public.can_view_studio(auth.uid(), studio_id))
);

CREATE POLICY "Studio members can update cad documents"
ON public.cad_documents FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR (studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR (studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
);

CREATE POLICY "Studio members can delete cad documents"
ON public.cad_documents FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR (studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
);

CREATE TRIGGER trg_cad_documents_updated_at
BEFORE UPDATE ON public.cad_documents
FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- 2) product_cad_asset_geometry: cached parsed geometry per trade_product_cad_assets row
CREATE TABLE public.product_cad_asset_geometry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cad_asset_id uuid NOT NULL REFERENCES public.trade_product_cad_assets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  variant_label text,
  file_format text NOT NULL,
  bbox_mm jsonb,                    -- { w, d, h, min:[x,y,z], max:[x,y,z] }
  units text,                       -- 'mm' | 'm' | 'in' | 'ft' | 'unknown'
  metrics jsonb,                    -- { vertex_count, face_count, layers, ... }
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parsing','ready','failed','unsupported')),
  error text,
  parsed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cad_asset_id)
);
CREATE INDEX idx_cad_geometry_product ON public.product_cad_asset_geometry(product_id);

GRANT SELECT ON public.product_cad_asset_geometry TO authenticated;
GRANT ALL ON public.product_cad_asset_geometry TO service_role;

ALTER TABLE public.product_cad_asset_geometry ENABLE ROW LEVEL SECURITY;

-- Trade users can read geometry (same rule as the underlying asset)
CREATE POLICY "Trade users can view cad geometry"
ON public.product_cad_asset_geometry FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'trade_user'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER trg_cad_geometry_updated_at
BEFORE UPDATE ON public.product_cad_asset_geometry
FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();

-- 3) cad_fit_reports: per (cad_document, room, product) fit verdicts
CREATE TABLE public.cad_fit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cad_document_id uuid NOT NULL REFERENCES public.cad_documents(id) ON DELETE CASCADE,
  room_label text,
  product_id uuid NOT NULL,
  variant_label text,
  verdict text NOT NULL CHECK (verdict IN ('pass','warn','fail','unknown')),
  reasons jsonb,                    -- [{ code, message, severity, detail? }]
  product_bbox_mm jsonb,
  room_bbox_mm jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cad_fit_doc ON public.cad_fit_reports(cad_document_id);
CREATE INDEX idx_cad_fit_product ON public.cad_fit_reports(product_id);

GRANT SELECT, INSERT, DELETE ON public.cad_fit_reports TO authenticated;
GRANT ALL ON public.cad_fit_reports TO service_role;

ALTER TABLE public.cad_fit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fit reports for their cad documents"
ON public.cad_fit_reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cad_documents d
    WHERE d.id = cad_fit_reports.cad_document_id
      AND (
        d.uploaded_by = auth.uid()
        OR (d.studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), d.studio_id))
      )
  )
);

CREATE POLICY "Members can insert fit reports for their cad documents"
ON public.cad_fit_reports FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.cad_documents d
    WHERE d.id = cad_fit_reports.cad_document_id
      AND (
        d.uploaded_by = auth.uid()
        OR (d.studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), d.studio_id))
      )
  )
);

CREATE POLICY "Members can delete their fit reports"
ON public.cad_fit_reports FOR DELETE TO authenticated
USING (created_by = auth.uid());
