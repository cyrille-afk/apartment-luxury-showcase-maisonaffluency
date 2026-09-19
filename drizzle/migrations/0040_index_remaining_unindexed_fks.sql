-- Operational Performance: Boards & Presentations
CREATE INDEX IF NOT EXISTS idx_axonometric_gallery_request_id ON public.axonometric_gallery(request_id);
CREATE INDEX IF NOT EXISTS idx_board_recommendations_product_id ON public.board_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_client_board_comments_item_id ON public.client_board_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_presentation_comments_slide_id ON public.presentation_comments(slide_id);
CREATE INDEX IF NOT EXISTS idx_presentation_slides_gallery_item_id ON public.presentation_slides(gallery_item_id);

-- Operational Performance: Clients & Documents
CREATE INDEX IF NOT EXISTS idx_client_documents_created_by ON public.client_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_collectible_overrides_updated_by ON public.collectible_overrides(updated_by);

-- Operational Performance: Collector & Guide Engagement
CREATE INDEX IF NOT EXISTS idx_collector_applications_reviewed_by ON public.collector_applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_guide_views_user_id ON public.guide_views(user_id);
CREATE INDEX IF NOT EXISTS idx_magazine_badge_events_user_id ON public.magazine_badge_events(user_id);

-- Operational Performance: Designers & Journal
CREATE INDEX IF NOT EXISTS idx_designer_heritage_slides_designer_id ON public.designer_heritage_slides(designer_id);
CREATE INDEX IF NOT EXISTS idx_journal_pipeline_article_id ON public.journal_pipeline(article_id);

-- Operational Performance: Favorites & Funnel
CREATE INDEX IF NOT EXISTS idx_favorite_folder_items_favorite_id ON public.favorite_folder_items(favorite_id);
CREATE INDEX IF NOT EXISTS idx_funnel_reminder_pauses_updated_by ON public.funnel_reminder_pauses(updated_by);

-- Operational Performance: Markup & Provenance
CREATE INDEX IF NOT EXISTS idx_markup_annotations_user_id ON public.markup_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_provenance_certificates_created_by ON public.provenance_certificates(created_by);

-- Operational Performance: Client Portal Access
CREATE INDEX IF NOT EXISTS idx_portal_invites_created_by ON public.portal_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_portal_redemptions_invite_id ON public.portal_redemptions(invite_id);
CREATE INDEX IF NOT EXISTS idx_portal_redemptions_session_id ON public.portal_redemptions(session_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_invite_id ON public.portal_sessions(invite_id);

-- Operational Performance: Notifications & Payments
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_payment_links_created_by ON public.quote_payment_links(created_by);

-- Operational Performance: Scraping & Shipping
CREATE INDEX IF NOT EXISTS idx_scrape_configs_created_by ON public.scrape_configs(created_by);
CREATE INDEX IF NOT EXISTS idx_shipping_surcharges_lane_id ON public.shipping_surcharges(lane_id);

-- Operational Performance: Studios & Payouts
CREATE INDEX IF NOT EXISTS idx_studio_lead_events_user_id ON public.studio_lead_events(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_payout_accounts_created_by ON public.studio_payout_accounts(created_by);
CREATE INDEX IF NOT EXISTS idx_studio_resale_certificates_uploaded_by ON public.studio_resale_certificates(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_studio_resale_certificates_verified_by ON public.studio_resale_certificates(verified_by);

-- Operational Performance: Trade Requests & Quotes
CREATE INDEX IF NOT EXISTS idx_trade_custom_requests_product_id ON public.trade_custom_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_trade_custom_requests_project_id ON public.trade_custom_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_trade_product_glb_variants_created_by ON public.trade_product_glb_variants(created_by);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_designer_payout_account_id ON public.trade_quotes(designer_payout_account_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_resale_certificate_id ON public.trade_quotes(resale_certificate_id);