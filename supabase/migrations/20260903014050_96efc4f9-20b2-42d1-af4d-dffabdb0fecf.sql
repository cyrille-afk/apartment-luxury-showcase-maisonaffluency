GRANT SELECT (
  id, email, first_name, last_name, company, avatar_url, created_at,
  country, concierge_name, has_seen_trade_intro, trade_status,
  trade_tier, trade_tier_suggested, trade_tier_locked_by_admin,
  trade_tier_12mo_spend_cents, trade_tier_computed_at
) ON public.profiles TO authenticated;