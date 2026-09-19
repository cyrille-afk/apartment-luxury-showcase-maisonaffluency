-- Hot Path: Quote & Board Line Items
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_product_id ON public.trade_quote_items(product_id);
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_supplier_id ON public.trade_quote_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_client_board_items_product_id ON public.client_board_items(product_id);

-- Hot Path: Favorites, Inquiries & Shipping
CREATE INDEX IF NOT EXISTS idx_trade_favorites_product_id ON public.trade_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_linked_quote_id ON public.inquiries(linked_quote_id);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_selected_lane_id ON public.shipping_quotes(selected_lane_id);