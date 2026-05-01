# Orchestrated Concierge — Tool-Calling with Human Approval Gate

**Goal:** Evolve the read-only `trade-concierge` into an *agentic* assistant that can **draft** tearsheets and **pre-fill** quote drafts on the user's behalf, while keeping a strict human-in-the-loop approval before anything persists or is sent.

Scope: trade portal only. Public site unaffected.

---

## 1. Principles

1. **Catalog-grounded** — every tool call references real `designer_curator_picks` / `trade_products` IDs already known to the concierge context. No invented items.
2. **Draft, never commit** — the AI produces *proposals*. Persisting to `trade_tearsheets` / `trade_quotes` requires an explicit user click.
3. **One approval gate per side-effect** — tearsheet creation, item additions, and quote drafting each surface their own confirmation card in the chat.
4. **Reversible** — every approved action returns a deep link (`/trade/tearsheets/:id`, `/trade/quotes/:id`) so the user can review and edit in the existing UI.
5. **Auditable** — log every proposed + approved tool call to a new `trade_concierge_actions` table for support and analytics.

---

## 2. Tool schema (sent to the model)

Three tools, all *intent-only* — they return a proposal payload, not a DB write.

```ts
tools: [
  {
    name: "propose_tearsheet",
    description: "Draft a new tearsheet from a list of curator pick IDs.",
    parameters: {
      title: string,         // suggested title, user can edit
      pick_ids: string[],    // must be IDs from CATALOG PIECES context
      note?: string,         // optional intro/rationale
    },
  },
  {
    name: "propose_add_to_tearsheet",
    description: "Add picks to an existing tearsheet the user owns.",
    parameters: {
      tearsheet_id: string,  // resolved from user's recent tearsheets list
      pick_ids: string[],
    },
  },
  {
    name: "propose_quote_draft",
    description: "Pre-fill a quote draft with selected trade products.",
    parameters: {
      project_name?: string,
      client_name?: string,
      items: Array<{
        trade_product_id: string,
        quantity: number,
        variant_label?: string,    // matches size_variants
        notes?: string,
      }>,
    },
  },
]
```

The system prompt is extended with:
- The user's **5 most recent tearsheets** (id + title) so `propose_add_to_tearsheet` can resolve "add to my Lemaire board".
- The user's **active project folders** (id + name) so quotes can be associated.

---

## 3. Edge function changes — `supabase/functions/trade-concierge/index.ts`

- Switch to **non-streaming** when `tool_choice` is auto and the response includes `tool_calls`. (Streaming continues to work for plain chat replies.)
- After receiving `tool_calls`, the function does **not** execute them. It serialises the proposal back to the client as a structured SSE event:
  ```
  event: proposal
  data: { "tool": "propose_tearsheet", "args": {...}, "preview": {...} }
  ```
  `preview` is hydrated server-side: pick titles, hero images, prices in the user's display currency — so the client can render a rich approval card without re-fetching.
- Add a **`POST /trade-concierge/commit`** sub-route (or a new `trade-concierge-commit` function) that:
  1. Validates the user's JWT (`supabase.auth.getClaims`).
  2. Re-validates every `pick_id` / `trade_product_id` exists and is visible to this trade user.
  3. Performs the actual insert into `trade_tearsheets` / `trade_tearsheet_items` / `trade_quotes` / `trade_quote_items`.
  4. Logs to `trade_concierge_actions`.
  5. Returns `{ id, url }` for the new resource.

---

## 4. Client UX — `src/components/trade/AIConcierge.tsx`

New message type: **ProposalCard** (rendered between regular bubbles).

Layout per proposal:

```
┌────────────────────────────────────────────────┐
│ ✨ Concierge proposes:                          │
│ NEW TEARSHEET — "Lemaire study, oak palette"   │
│                                                │
│ [img] Bond Street Stool — Man of Parts         │
│ [img] Madison Avenue Cocktail Table — MoP      │
│ [img] Praia da Granja Coffee Table — MoP       │
│                                                │
│ Note: "Three pieces in fumed oak …"            │
│                                                │
│ [ Edit ]  [ Discard ]   [ Approve & create ]  │
└────────────────────────────────────────────────┘
```

Behaviours:
- **Edit** → opens an inline form letting the user rename the title, untick picks, edit the note. State stays local; no DB write.
- **Discard** → posts an assistant-visible "User declined" turn so the model can adapt.
- **Approve & create** → calls the commit endpoint, replaces the card with a success state + deep link, and posts a confirmation turn back into the conversation so follow-ups stay coherent.

Quote-draft card variant adds a per-line quantity stepper and a variant dropdown (populated from `size_variants`).

---

## 5. Database — new audit table

```sql
create table public.trade_concierge_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  conversation_id uuid,                       -- optional, for future threading
  tool text not null,                         -- 'propose_tearsheet' | …
  args jsonb not null,
  status text not null,                       -- 'proposed' | 'approved' | 'discarded' | 'edited_then_approved'
  resulting_resource_id uuid,                 -- tearsheet or quote id once committed
  created_at timestamptz not null default now()
);

alter table public.trade_concierge_actions enable row level security;

create policy "Users see their own concierge actions"
  on public.trade_concierge_actions for select
  using (auth.uid() = user_id);

create policy "Users insert their own concierge actions"
  on public.trade_concierge_actions for insert
  with check (auth.uid() = user_id);
```

No `update`/`delete` policies — the table is append-only.

---

## 6. Guardrails

- **Per-conversation cap**: max 3 commits per session to prevent runaway tool use.
- **Idempotency key** on commit (`tool` + hash of `args` + `user_id`) → re-clicking "Approve" twice never duplicates.
- **Visibility check**: the commit endpoint re-verifies each `pick_id` against the trade user's allowed brands (mirrors `useHiddenTradeProductIds`).
- **Currency safety**: proposed quote items store *no* prices; pricing is resolved at commit time using the existing trade-pricing pipeline (manual override → trade_price_cents → FX). The proposal preview shows indicative prices only, labelled "indicative".

---

## 7. Files to touch

```
supabase/functions/trade-concierge/index.ts        # tool schema + proposal SSE event
supabase/functions/trade-concierge-commit/index.ts # NEW — validated writes
supabase/migrations/<ts>_concierge_actions.sql     # NEW — audit table + RLS
src/components/trade/AIConcierge.tsx               # ProposalCard rendering, approve/discard
src/components/trade/concierge/ProposalCard.tsx    # NEW — tearsheet & quote variants
src/lib/tradeConciergeStream.ts                    # parse `event: proposal` SSE frames
src/lib/conciergeCommit.ts                         # NEW — typed client for the commit endpoint
```

No changes to public surfaces, OG bridges, or the existing quote / tearsheet UIs — the concierge plugs into them, doesn't replace them.

---

## 8. Phased delivery

1. **Phase 1 — Tearsheet drafts only** (1 tool, smallest surface). Proves the proposal/commit/approval loop end-to-end.
2. **Phase 2 — Add-to-existing-tearsheet**, once context-passing of recent tearsheets is solid.
3. **Phase 3 — Quote drafts**, gated behind Phase 1 + 2 because pricing & variants add complexity.
4. **Phase 4 — Multi-step orchestration** (e.g. "build a tearsheet then turn it into a quote") via chained proposals.

Each phase is independently shippable and the audit table makes it easy to measure approval vs discard rates before widening scope.
