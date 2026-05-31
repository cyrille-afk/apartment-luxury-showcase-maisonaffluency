# LLM Cost Optimization Rollout

Goal: apply the 12 techniques to every AI surface in the app (`trade-concierge`, `product-description-writer`, `board-recommendations`, `axonometric-generate`, `suggest-ffe-layout`, `translate-text`, `compute-taste-profiles`, `parse-shipment-document`). Build incrementally — one technique per step, each independently shippable and verifiable via the existing AI Usage Dashboard.

## Implementation order

Sequenced so cheap wins land first, infrastructure (cache, RAG, monitoring) lands mid-rollout, and orchestration (tiered routing, batching) lands last on top of measurement.

### Step 1 — Choose the Right Model
Audit current model per function. Downgrade defaults to `google/gemini-3-flash-preview` (or `-flash-lite-preview`) unless reasoning depth is required. Add a single `MODEL_TIERS` map in `supabase/functions/_shared/aiModels.ts` (`cheap`, `balanced`, `strong`, `image`). Each function imports from this map — no more hardcoded model IDs.

### Step 2 — Limit Output Tokens
Add explicit `max_tokens` to every AI call. Defaults: classification 256, extraction 512, descriptions 600, concierge replies 1200. Add to `aiModels.ts` as `OUTPUT_LIMITS`.

### Step 3 — Reduce Input Tokens
Pass through each function's system prompt: strip redundant examples, collapse whitespace, replace verbose instructions with terse imperatives. Add `compressContext()` helper that trims catalog JSON to essential fields (id, title, brand, category, materials) before injection.

### Step 4 — Function Calling / Structured Output
Migrate any function that currently parses free-text JSON to the AI SDK `Output.object` API with Zod schemas. Targets: `parse-shipment-document`, `compute-taste-profiles`, `board-recommendations` tool args. Removes "return JSON" prompt boilerplate.

### Step 5 — Prompt Reuse and Templates
Move all system prompts to `supabase/functions/_shared/prompts.ts` exporting `buildPrompt(template, vars)`. One source of truth, parameterized.

### Step 6 — Monitor, Measure, Optimize
Extend existing `ai_usage_events` with `cached` boolean, `prompt_hash` text, `tier` text. Update AI Usage Dashboard with: cache hit rate KPI, per-feature avg input/output tokens, top-10 most expensive prompt hashes.

### Step 7 — Use Caching
New `ai_response_cache` table keyed by `(feature, model, prompt_hash)` with `response_json`, `expires_at`. Shared `withCache(key, ttl, fn)` wrapper. Apply to deterministic features: `translate-text`, `product-description-writer`, `parse-shipment-document`.

### Step 8 — Optimize Embeddings Usage
For step 9 prep: build `embeddings_batch.ts` that dedupes by SHA-256 of normalized text, batches up to 100 inputs per `/v1/embeddings` call, skips items already embedded.

### Step 9 — RAG Done Right
Enable `pgvector`. Add `embedding vector(1536)` to `trade_products` + `designer_curator_picks` (model: `openai/text-embedding-3-small` for cost). Backfill via one-shot edge function `embed-catalog` using the batch helper from step 8. Create `match_catalog(query_embedding, k, filters)` RPC. Rewrite `trade-concierge` to embed the user turn, retrieve top-12, inject only those (≈80% input-token reduction vs current full-catalog stuffing). Chunks: one row = title + brand + category + materials + short description, ~120 tokens each.

### Step 10 — Tiered / Two-Step Approach
In `trade-concierge`: first pass with `cheap` model classifies intent (chitchat / search / proposal). Only `proposal` escalates to `balanced`. In `board-recommendations`: cheap model drafts shortlist, strong model only ranks final 5.

### Step 11 — Batch Requests
For `compute-taste-profiles` (currently one call per user): batch up to 20 user signal sets in a single prompt returning a JSON array via `Output.array`. Same pattern for any nightly job processing N items.

### Step 12 — Use the Right Pricing and Providers
Document in `supabase/functions/_shared/aiModels.ts` the current per-1M-token prices alongside each model. Add a quarterly review note. Surface in dashboard as static reference table so model choice is auditable against current rates. (No provider switch — Lovable AI Gateway is the only path.)

## Technical details

- **No breaking changes** to user-facing AI behavior — every step is an internal refactor or additive infra.
- **Shared module**: `supabase/functions/_shared/{aiModels.ts, prompts.ts, cache.ts, embeddings.ts}` — imported by all 8+ functions.
- **Migrations**: 3 total — (a) extend `ai_usage_events`, (b) create `ai_response_cache`, (c) enable pgvector + add embedding columns + `match_catalog` RPC.
- **New edge function**: `embed-catalog` (admin-triggered, idempotent, resumable via `embedding IS NULL` filter).
- **Dashboard updates**: extend `TradeAiUsageDashboard.tsx` with cache + tier columns and top-prompts table.
- **Verification per step**: ship, watch AI Usage Dashboard for 24h, confirm cost/req drops without error-rate increase before moving to next step.

## Out of scope

- No provider migration (stays on Lovable AI Gateway).
- No client-side AI calls — all changes server-side.
- No changes to image-generation functions (`axonometric-generate`) beyond model selection in step 1.

## Confirm

Reply "go" to start with Step 1 (model audit + `MODEL_TIERS` map). Or name a step to start from.
