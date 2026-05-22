# Concierge Multi-Step Orchestration — Implementation Plan

Goal: evolve the Trade AI Concierge from a single-tool recommender into a brief-aware orchestrator that can draft quotes, FF&E rows, custom requests, sample requests and presentations — all behind a unified human-approval gate. Mirrors the roadmap in `concierge-multi-step-orchestration.pdf`.

## Build order (each step is independently shippable)

### Step 1 — Project + studio grounding
- Pass active `project_id`, project name, studio name, and the studio's `clients` list into the `trade-concierge` system prompt.
- Frontend (`AIConcierge` / wherever `streamConcierge` is called) reads active project from existing `useProjectFilter` / route context and forwards it in the request body.
- Edge function injects this into the system message so existing `propose_tearsheet` calls become project-aware (no new tools yet).

### Step 2 — Richer grounding payload
- Extend the catalog block sent to the model with: `trade_price_cents`, `currency`, `lead_time_weeks`, `stock_status`, applicable trade-tier discount %, and variant axes (size_variants summary).
- Reuse `useTradeDisplayCurrency` + `useTradeDiscount` server-side equivalents inside the edge function (read from `profiles` / `studios`).
- No UX change; unblocks pricing-aware tools.

### Step 3 — `draft_quote` + `add_to_quote` + Quote review card
- New tools registered in `trade-concierge/index.ts`:
  - `draft_quote(project_id, currency, lines[{pick_id, qty, variant?, lead_weeks?, note?}])`
  - `add_to_quote(quote_id, lines[...])`
- Stream emits `event: proposal` with `tool: "draft_quote"` payload + line preview (title, image, unit price, line total, discount, currency).
- New `QuoteProposalCard` component (mirrors existing tearsheet proposal card) with inline qty/variant edit, Approve / Discard.
- New edge function `trade-concierge-commit-quote` — validates studio + project ownership via `auth.getClaims`, inserts into `trade_quotes` + `trade_quote_items`, returns `{quote_id, url}`.
- Audit row in `concierge_commits` (created in this step) with `who/what/when/source='concierge'`.

### Step 4 — Brief extractor + inner multi-tool loop
- Add a planner pass: before the main stream, run a cheap structured-extraction call (`gemini-2.5-flash-lite`) to derive `{project, room, style, budget_band, lead_time_ceiling, qty_hints, client}` from the latest user turn + conversation.
- Persist the brief on the conversation (sessionStorage client-side + `concierge_briefs` table for cross-turn memory keyed by `conversation_id`).
- Inner loop in the edge function: after the first tool call resolves, feed the tool result back to the model and let it emit additional tool calls in the same turn (cap at 4 tools / turn). Stream a single combined `event: plan` payload listing all proposed drafts.
- Frontend renders a **Plan card** that contains N child proposal cards (tearsheet + quote + future FF&E etc.) with a single **Approve all** + per-item toggle.

### Step 5 — `propose_ffe_rows` + unified Drafts tray
- New tool `propose_ffe_rows(project_id, room, rows[{category, spec, qty, lead_weeks, budget_band, pick_id?}])`.
- New `FfeProposalCard` + commit endpoint `trade-concierge-commit-ffe` writing to existing FF&E tables, gated by `useFfeEntitlement`.
- New `ConciergeDraftsTray` (slide-over from `ConciergeHeaderButton`) listing all pending proposals across the conversation, grouped by plan, with selective approve/discard. Backed by `concierge_drafts` table (status: pending/approved/discarded).

### Step 6 — Long-tail tools
- `draft_custom_request` → `trade_custom_requests`
- `request_samples` → existing samples flow
- `draft_presentation` → assembles a tearsheet into a white-label PDF via existing presentation builder, respecting studio branding settings.
- Each gets its own proposal card + commit endpoint, all surfaced in the unified Drafts tray.

## Technical notes

- **Auth**: every new commit endpoint uses `supabase.auth.getClaims(token)` (per Core memory), validates `studio_id` ownership of `project_id` and every `pick_id`.
- **Tools registration**: extend the existing tools array in `supabase/functions/trade-concierge/index.ts`; keep the OpenAI-compatible function schema.
- **Streaming**: extend `tradeConciergeStream.ts` with new proposal types via a discriminated union; add `event: plan` for combined plans.
- **DB migrations**:
  - `concierge_briefs(id, conversation_id, user_id, studio_id, brief jsonb, created_at)`
  - `concierge_drafts(id, conversation_id, user_id, studio_id, tool text, args jsonb, status text default 'pending', commit_ref text null, created_at, decided_at)`
  - `concierge_commits(id, draft_id, user_id, studio_id, tool, target_table, target_id, created_at)`
  - All with RLS scoped to `auth.uid()` + studio membership via `has_role`/studio helper.
- **Grounding**: cap catalog payload at ~30 picks ranked by relevance to brief to keep token budget sane.
- **Variants**: when a pick has `size_variants`, agent must pick a specific variant before drafting a line item; enforce via JSON schema `required: ["variant"]` when applicable.
- **Currency**: drafted line totals computed server-side at commit time using live FX (existing `useTradeDisplayCurrency` logic ported into a shared `_shared/pricing.ts`).
- **No autocommit ever** — every write goes through an Approve click.

## Out of scope for this pass
- Replacing manual quote/FF&E UIs (the orchestrator pre-fills, humans still drive).
- Voice / multi-modal input.
- Cross-conversation memory beyond the current thread.

## Order of work in this loop
I'll ship **Steps 1–3** end-to-end in this iteration (project grounding, pricing-aware payload, `draft_quote` + commit + review card + `concierge_commits` audit). Steps 4–6 will follow as separate loops so each is reviewable on its own.
