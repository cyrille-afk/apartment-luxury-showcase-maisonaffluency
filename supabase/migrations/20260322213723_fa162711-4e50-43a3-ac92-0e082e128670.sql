-- RLS SUBQUERY ACCELERATION INDEXES
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_curator_picks_designer_id ON public.designer_curator_picks (designer_id);
CREATE INDEX IF NOT EXISTS idx_trade_favorites_user_id ON public.trade_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_user_id ON public.trade_quotes (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_quote_items_quote_id ON public.trade_quote_items (quote_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_axo_requests_user_id ON public.axonometric_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_client_boards_user_id ON public.client_boards (user_id);
CREATE INDEX IF NOT EXISTS idx_client_board_items_board_id ON public.client_board_items (board_id);
CREATE INDEX IF NOT EXISTS idx_client_board_comments_board_id ON public.client_board_comments (board_id);
CREATE INDEX IF NOT EXISTS idx_pres_shares_user_id ON public.presentation_shares (shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_pres_slides_presentation_id ON public.presentation_slides (presentation_id);
CREATE INDEX IF NOT EXISTS idx_pres_comments_presentation_id ON public.presentation_comments (presentation_id);
CREATE INDEX IF NOT EXISTS idx_trade_applications_user_id ON public.trade_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_sample_requests_user_id ON public.trade_sample_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_provenance_events_cert_id ON public.provenance_events (certificate_id);
CREATE INDEX IF NOT EXISTS idx_sample_audit_request_id ON public.sample_request_audit_log (request_id);

-- FREQUENT QUERY FILTER INDEXES
CREATE INDEX IF NOT EXISTS idx_designers_is_published ON public.designers (is_published);
CREATE INDEX IF NOT EXISTS idx_designers_founder ON public.designers (founder);
CREATE INDEX IF NOT EXISTS idx_journal_published ON public.journal_articles (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_products_brand ON public.trade_products (brand_name);
CREATE INDEX IF NOT EXISTS idx_trade_products_active ON public.trade_products (is_active);
CREATE INDEX IF NOT EXISTS idx_axo_gallery_created_by ON public.axonometric_gallery (created_by);
CREATE INDEX IF NOT EXISTS idx_journal_pipeline_status ON public.journal_pipeline (status);
CREATE INDEX IF NOT EXISTS idx_competitor_designers_gallery ON public.competitor_designers (gallery_id);
CREATE INDEX IF NOT EXISTS idx_competitor_traffic_gallery ON public.competitor_traffic (gallery_id);