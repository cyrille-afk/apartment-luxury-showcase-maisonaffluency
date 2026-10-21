ALTER TABLE public.trade_product_glb_variants
  ADD COLUMN original_upload_format text,
  ADD COLUMN original_upload_filenames text[];
COMMENT ON COLUMN public.trade_product_glb_variants.original_upload_format IS 'Primary geometry format selected before conversion (glb, gltf, obj, 3ds). NULL means historical provenance was not recorded; never infer from the stored GLB URL.';
COMMENT ON COLUMN public.trade_product_glb_variants.original_upload_filenames IS 'Original selected geometry and companion filenames before conversion; not source-file storage URLs.';