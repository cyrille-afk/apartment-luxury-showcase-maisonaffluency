# Roadmap — Real Visual Search

- [ ] 1. Migration: product_image_embeddings table (vector 3072, gemini-embedding-2) + match_product_images RPC
- [ ] 2. Edge function embed-product-images (admin-gated batch backfill of catalogue image embeddings)
- [ ] 3. Edge function visual-search (auth; embeds uploaded photo, returns top matches)
- [ ] 4. Rewire VisualSearchPanel to real matching; re-enable tab in TradeShowroom
- [ ] 5. Backfill all catalogue image embeddings
- [ ] 6. Live verification: two different room photos return different, plausible matches
