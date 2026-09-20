-- Human-gate status: the AI may screen an application, never approve it.
ALTER TYPE public.trade_application_status ADD VALUE IF NOT EXISTS 'pending_human_review';