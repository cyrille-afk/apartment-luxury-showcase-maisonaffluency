# AI Usage Dashboard

Track every Lovable AI Gateway call across the app, then surface tokens, requests, and estimated cost per feature/day in the admin dashboard.

## 1. Database

New table `public.ai_usage_events` (admin-read only):
- `feature` text — logical name (e.g. `trade-concierge`, `product-description-writer`, `board-recommendations`, `axonometric-generate`, `suggest-ffe-layout`, `translate-text`, `compute-taste-profiles`, `parse-shipment-document`)
- `model` text (e.g. `google/gemini-3-flash-preview`)
- `prompt_tokens`, `completion_tokens`, `total_tokens` int
- `estimated_cost_usd` numeric(12,6) — computed from a static price map per model (input/output per 1M tokens)
- `user_id` uuid nullable, `status` text (`ok` / `error`), `error_code` text nullable, `latency_ms` int
- `created_at` timestamptz default now()

RLS: insert allowed by `service_role` only; select restricted to `has_role(auth.uid(),'admin')`. GRANTs accordingly. Index on `(created_at desc)` and `(feature, created_at)`.

## 2. Shared logger

Add `supabase/functions/_shared/aiUsage.ts` exporting `logAiUsage({ feature, model, usage, status, userId, latencyMs, errorCode })`. It:
- reads token counts from the OpenAI-style `usage` field returned by the AI Gateway,
- looks up per-1M-token prices in a small in-file `MODEL_PRICING` map (covers gemini-3-flash, gemini-2.5-flash, gemini-2.5-pro, gpt-5-mini, gpt-5, image models flat per-call),
- inserts a row via the service-role Supabase client.
Failures are swallowed (logging must never break the feature).

## 3. Instrument edge functions

Wrap every Lovable AI call in the 9 functions identified (`trade-concierge`, `product-description-writer`, `board-recommendations`, `axonometric-generate`, `suggest-ffe-layout`, `translate-text`, `compute-taste-profiles`, `parse-shipment-document`, `auth-email-hook` if it calls AI) so each one calls `logAiUsage` after success/failure with its `feature` name and the resolved user from `auth.getClaims`.

## 4. Admin dashboard

New route section on `/trade/admin-dashboard` → `AiUsagePanel.tsx`:
- Date-range picker (default last 30 days).
- KPI cards: total requests, total tokens, total estimated cost USD, error rate.
- Bar chart (recharts) — daily tokens stacked by feature.
- Line chart — daily estimated cost.
- Table — per-feature: requests, total tokens, avg tokens/request, total cost, last call.
- Powered by a single Supabase RPC `admin_ai_usage_summary(_from, _to)` returning daily + per-feature aggregates (admin-gated via `has_role`).

## 5. Notes

- Prices are static estimates kept in one place (`MODEL_PRICING` in the shared logger and mirrored in the SQL function for cost recompute). Documented in code so they can be updated when Lovable changes pricing.
- No changes to user-facing AI behavior; logging is fire-and-forget.

Approve and I'll implement.
