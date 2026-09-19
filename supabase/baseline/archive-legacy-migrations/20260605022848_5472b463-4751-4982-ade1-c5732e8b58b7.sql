GRANT SELECT ON public.trade_product_cad_assets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.cad_asset_downloads TO authenticated;
GRANT ALL ON public.trade_product_cad_assets TO service_role;
GRANT ALL ON public.cad_asset_downloads TO service_role;