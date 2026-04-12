

# Project-Aware Proactive Recommendations

## Overview
Build a recommendation engine that analyzes the contents of a designer's client boards (projects) and suggests complementary products from the catalog. Recommendations surface on the **Dashboard**, inline in the **Gallery**, and in **weekly email digests**.

## Architecture

```text
┌──────────────────────┐
│  client_board_items   │──→ board's product IDs
│  designer_curator_picks│──→ product attributes (category, materials, brand, tags)
└──────────┬───────────┘
           │
     Edge Function: board-recommendations
     (Lovable AI: gemini-3-flash-preview)
           │
           ▼
┌──────────────────────┐
│ board_recommendations │  ← cached ranked suggestions per board
└──────────────────────┘
           │
     ┌─────┼──────────┐
     ▼     ▼          ▼
 Dashboard  Gallery   Weekly Digest
  widget    inline    email section
```

## Steps

### 1. Database migration — `board_recommendations` table
Create a cache table storing AI-generated recommendations per board:
- `id`, `board_id` (ref client_boards), `product_id` (ref designer_curator_picks), `score` (numeric), `reason` (text — one-line explanation like "Complements the bronze palette"), `created_at`
- RLS: board owners can SELECT their own; admins can manage all
- Unique constraint on `(board_id, product_id)`

### 2. Edge function — `board-recommendations`
- Accepts `{ board_id }`, authenticates the caller
- Fetches board items + their product attributes (category, materials, brand, tags, title)
- Fetches the full catalog (designer_curator_picks) excluding items already on the board
- Builds a prompt asking Lovable AI (gemini-3-flash-preview) to pick the top 8 complementary products with reasons, using tool calling for structured output
- Upserts results into `board_recommendations`
- Returns the recommendations as JSON

### 3. Dashboard widget — "Suggested for [Board Name]"
- New component `BoardRecommendations` below MostPopularProducts on TradeDashboard
- Fetches the user's most recently updated board that has items
- Calls the edge function if no cached recommendations exist (or cache is older than 24h)
- Displays a horizontal scroll of 4-6 product cards with the AI reason as a subtitle
- Each card links to the product in the gallery; a "Refresh" button re-triggers the edge function

### 4. Gallery inline suggestions
- When browsing the gallery, if the user has an active board with recommendations, show a subtle banner: "Suggested for *[Board Name]*" with 3 product cards inline between search results
- Only appears if at least 3 recommendations exist for the user's most recent board

### 5. Weekly digest integration
- Extend the existing `send-weekly-digest` edge function to include a "Picks for your project" section
- Pull cached `board_recommendations` for each recipient's most active board
- Add 2-3 recommended products to the email template

## Technical Details

**Edge function prompt strategy**: The prompt includes the board's product attributes as context and instructs the model to find complementary (not duplicate) products considering material harmony, stylistic coherence, and functional completeness (e.g., if the board has seating but no lighting, suggest lighting).

**Caching**: Recommendations are cached in the database. They're refreshed when: (a) user clicks "Refresh", (b) a board item is added/removed (via a trigger or client-side call), or (c) cache is >24h old.

**Cost control**: Each recommendation call processes ~one board at a time using gemini-3-flash-preview (fast, cheap). No batch processing of all users — recommendations are generated on-demand per board.

