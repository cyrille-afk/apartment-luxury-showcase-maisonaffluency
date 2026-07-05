# Multimodal Concierge — Vector + SQL Hybrid Search

Extends the trade concierge to accept mood boards, floor plans, product photos, and PDF tearsheets, extract structured metadata with a multimodal LLM, and retrieve products using **both** aesthetic similarity (pgvector) and strict structural filters (SQL), then output the spec-sheet block already built.

## Flow

```text
Upload (image / PDF) ─┐
Text prompt ──────────┤─► Gemini 2.5 Pro (vision)
                      │      extracts JSON:
                      │      { style, palette, materials,
                      │        room_type, dims_cm, categories,
                      │        designer_hints, budget }
                      ▼
        ┌─────────────────────────────┐
        │  Hybrid retrieval           │
        │  • pgvector cosine on       │
        │    product embedding        │
        │    (name+desc+materials+    │
        │     designer+style tags)    │
        │  • SQL WHERE on category,   │
        │    dims fit, lead-time,     │
        │    price band, in-stock     │
        └─────────────┬───────────────┘
                      ▼
       Gemini formats reply +
       compileSpecSheetBlock() footer
                      ▼
                 User output
```

## Database changes (one migration)

1. `create extension if not exists vector;`
2. Add `embedding vector(3072)` + `embedding_model text` + `embedding_updated_at timestamptz` to `trade_products`.
3. HNSW index: `create index trade_products_embedding_idx on trade_products using hnsw (embedding vector_cosine_ops);`
4. RPC `match_trade_products(query_embedding vector(3072), match_count int, filter jsonb)` — returns id, name, designer, similarity, applying optional SQL filters (category, max_width_cm, max_depth_cm, max_height_cm, max_lead_weeks, price_band) inside the function. `security definer`, `search_path = public`, granted to `authenticated` + `service_role`.
5. Backfill job runs via a new edge function `embed-trade-products` (batched, idempotent on `embedding_updated_at`).

Model: `google/gemini-embedding-001` (3072-dim, default per Lovable AI embeddings guidance). Column sized to match; re-embed if we ever change model.

## New edge functions

- **`embed-trade-products`** — service-role. Iterates `trade_products` where `embedding is null or updated_at > embedding_updated_at`, builds an embedding text (`name • designer • materials • primary_category • short description`), calls Lovable AI `/v1/embeddings`, upserts vector. Invocable manually and via nightly cron.
- **`concierge-vision-extract`** — accepts `{ imageUrl | pdfBase64, kind: 'mood_board'|'floor_plan'|'product_photo'|'tearsheet' }`, calls Gemini 2.5 Pro with a schema-locked prompt per `kind`, returns structured JSON. Reused by concierge and future upload UIs.

## trade-concierge changes

- When the incoming message contains an attachment, first call `concierge-vision-extract` to get structured params.
- Merge extracted params with the user's text prompt into a **retrieval query**: text → embedding via `/v1/embeddings`; structural params → `filter` jsonb.
- Call `match_trade_products` (top 12), then hydrate with `designer`, `lead_time_weeks`, `sku`, dims, materials.
- Feed the hydrated list into the existing answer prompt; `compileSpecSheetBlock()` (already shipped) renders the footer.
- Floor-plan branch uses `strong` tier (Gemini 2.5 Pro) with a spatial-reasoning prompt returning zones + max dims per zone; those become per-zone filters.

## Frontend

- Trade concierge input gets an existing-style attach button accepting images (jpg/png/webp ≤10 MB) and PDFs (≤10 MB). Uploads go to a private `concierge-uploads` bucket; a 60s signed URL is passed to the edge function. No changes to public views.

## Rollout

1. Migration (pgvector + column + RPC).
2. Deploy `embed-trade-products`; run once to backfill.
3. Deploy `concierge-vision-extract`.
4. Wire trade-concierge to hybrid retrieval + vision extract.
5. Add attach UI in trade concierge.
6. Extend eval battery with 3 vision cases (mood board, floor plan, tearsheet) and 3 hybrid-search cases (style-only, dims-only, style+dims+lead-time).

## Technical notes

- Hybrid ranking: rank = `0.7 * cosine_sim + 0.3 * structural_fit_score` (structural_fit_score = fraction of active filters satisfied); computed in the RPC so pagination is stable.
- Embedding text stays under 2048 tokens (Gemini embedding-001 cap); chunk long descriptions.
- Re-embed trigger on `AFTER UPDATE OF name, materials, primary_category, description ON trade_products` sets `embedding = null` to force refresh on next cron run.
- Vision extraction JSON is validated with Zod; failures degrade to text-only retrieval, never crash the reply.
- Costs: embedding backfill is one-time (~4k products); per-request adds 1 embedding + optionally 1 vision call. Both go through Lovable AI Gateway, no new secrets.
- Respects existing rules: English only, no French-market assumptions, trade-only pricing paths untouched, public views unaffected.

Approve to proceed with the migration first.
