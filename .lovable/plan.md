## Goal

Close the last two gaps in the concierge stack:

1. **Grounding for `concierge-public-stream`** — today the public endpoint has zero retrieval and relies entirely on the system prompt to keep the model on-brand. It can and does invent designer names, ateliers, and product details. Add a grounding layer so every reply is anchored to a small, curated slice of real Maison Affluency content.
2. **Bidirectional handoff on the SSE stream** — today the server → client direction runs on SSE and the client → server direction runs on fresh POSTs. There is no live back-channel for "user just locked a brief / picked a product / dismissed a proposal". Add a Supabase Realtime broadcast channel keyed by `stream_id` so both directions share one addressable session.

Scope is deliberately narrow: no changes to `trade-concierge` (already has RAG + resume), no schema-breaking migrations, no UI redesign.

---

## Part 1 — Grounding for `concierge-public-stream`

### Approach: hard scripted grounding first, RAG second (behind the same interface)

The public endpoint currently ships **11 named entities** in its system prompt (Andrée Putman, Yovanovitch, Man of Parts, Mahdavi, Alexander Lamont, plus "many others"). The model then extrapolates freely from there. We replace that with a two-tier grounding pipeline invoked before the upstream chat call:

**Tier A — deterministic roster grounding (scripted)**
- New file `supabase/functions/concierge-public-stream/_grounding.ts` exports a curated roster: `{ designers: [...], ateliers: [...], hero_pieces: [...] }`.
- Roster is generated at deploy time by a small script from the `designers`, `featured_studios_public`, and `designer_curator_picks_public` tables (public rows only, no pricing). Kept inline in the function bundle so there is zero DB latency on the hot path.
- Each entry is 1–2 sentences (name, discipline, one anchor fact) — the model quotes from this snippet, not from its training data.

**Tier B — semantic retrieval (optional, gated)**
- When the trimmed user turn is > 20 chars and mentions a discipline/room/style token, embed the query via `openai/text-embedding-3-small` and call the existing `match_catalog` RPC with a **public-safe projection** (a new `match_catalog_public` RPC — same body, restricted columns: `id, title, designer_name, category, subcategory, hero_image_url` — never pricing, lead times, or stock).
- Top-8 rows appended to the grounding block. Falls back silently to Tier A only on error or < 3 rows.

**Prompt injection shape**

```
[Verified Maison Affluency roster — quote only from this list; do not invent names]
Designers:
- Andrée Putman — French interior designer known for minimalist luxury (b.1925).
- ...
Ateliers we currently represent:
- Pouénat — Parisian ferronnerie house, AD100 (2025).
- ...
Sample of pieces referenced publicly:
- "Rift Cabinet" by Man of Parts (case goods).
- ...
[End roster]
```

System prompt gains one hard rule: *"Never mention a designer, atelier, or piece that is not in the roster above. If asked about someone outside it, say the gallery may still be able to source them and offer to note the enquiry."*

### Guard rails
- Roster block capped at ~2 kB so cache prefixes stay warm on Gemini.
- `logAiUsage({ feature: "public-concierge-rag", ... })` for the embed call, same pattern as `trade-concierge-rag`.
- Ship Tier A on day 1; Tier B behind a `PUBLIC_RAG_ENABLED` env flag so we can dark-launch.

### Files touched
- `supabase/functions/concierge-public-stream/index.ts` — assemble grounding block, inject into `messages`, tighten SYSTEM_PROMPT.
- `supabase/functions/concierge-public-stream/_grounding.ts` (new) — roster snippet + `buildGroundingBlock({ query, useRag })`.
- `supabase/migrations/<ts>_match_catalog_public.sql` (new) — `match_catalog_public` RPC + `GRANT EXECUTE TO authenticated` (endpoint requires auth).
- `scripts/build-public-concierge-roster.ts` (new, one-shot regeneration script that writes `_grounding.roster.json` into the function dir).

### Verification
- Add a unit test `concierge-public-stream/grounding_test.ts`: given a query "Do you carry Pierre Chareau?" the grounding block must include Chareau if on-roster, and the response must not invent a fake designer when asked "Do you carry Foobar Studios?" — deterministic check on the injected roster contents, not the model output.
- Manual: 5 canned adversarial prompts ("recommend a chandelier by X" where X is off-roster) run through `supabase--curl_edge_functions` and eyeball the reply for hallucination.

---

## Part 2 — Bidirectional handoff on `stream_session`

### Approach: Supabase Realtime broadcast channel named `concierge:<stream_id>`

`installFramePersistence` already mints `stream_id` (UUID) and writes `concierge_stream_sessions`. Reuse that id as the Realtime channel name. Both sides publish and subscribe.

**Server → client events** (already covered by SSE; broadcast is additive for multi-tab / late-joiner cases):
- `proposal_ready` — a tearsheet/quote/FFE card is available on the timeline.
- `stream_completed` — turn finished, safe to release the composer.

**Client → server events** (this is the new bit, and it's the missing side of #6):
- `brief_locked` — the Brief Builder was completed; payload = structured brief. Server persists to `brief_drafts` and, if the isolate is still alive on this stream, injects the brief into the next model turn without requiring a fresh POST.
- `product_selected` — user picked a product from the PickAssetDrawer / tearsheet.
- `finishes_locked` — wood + fabric picks committed.
- `proposal_dismissed` — user rejected a card; server logs to `trade_concierge_actions` for future preference learning.

**Why broadcast (not `postgres_changes`)**: no write amplification on hot tables, sub-100ms fan-out, and the channel dies when the last subscriber leaves. RLS is handled by requiring the channel name to include the `stream_id` (a UUID the requester already proved ownership of at POST time).

### Wire-up

Server side (`_resume.ts`, additions):
- New `openHandoffChannel({ streamId, userId })` helper — creates the channel with the service-role client and returns `{ emit(event, payload), close() }`.
- `installFramePersistence` opens the channel and hands the emitter back to the caller.
- `finalize()` broadcasts `stream_completed` before closing.
- New handler in `index.ts` for `POST /concierge-handoff` (same function, new subpath) that accepts `{ stream_id, event, payload }`, verifies the caller's JWT `sub` matches `concierge_stream_sessions.user_id`, and broadcasts on the channel — plus persists `brief_locked` / `finishes_locked` into their respective tables.

Client side (`src/lib/tradeConciergeStream.ts`, `src/components/trade/AIConcierge.tsx`, `src/hooks/useConciergeSession.ts`):
- On `stream_start`, subscribe to `supabase.channel(\`concierge:${stream_id}\`)`.
- `useConciergeSession` gains `emit(event, payload)` that both updates local state AND posts to `/concierge-handoff`.
- Existing brief-builder submit / product-pick handlers call `emit()` instead of (or in addition to) creating a brand-new turn POST.
- Channel torn down on `stream_completed` or component unmount.

### Files touched
- `supabase/functions/trade-concierge/_resume.ts` — add `openHandoffChannel` + broadcast in `finalize`.
- `supabase/functions/trade-concierge/index.ts` — add `/concierge-handoff` subpath handler, thread the channel emitter through the streaming turn so mid-turn client events can influence the next tool call.
- `supabase/functions/concierge-public-stream/index.ts` — same handoff subpath, so public visitors also get the bidirectional channel (server → client only for the public surface; brief/product events aren't relevant there).
- `src/lib/tradeConciergeStream.ts` — parse `stream_start`, expose `streamId` in `streamConcierge` callbacks.
- `src/hooks/useConciergeSession.ts` — add `emit` method + realtime subscription hook.
- `src/components/trade/AIConcierge.tsx` — replace ad-hoc `dispatchEvent(new Event(...))` handoffs with `emit()` calls where appropriate.
- New migration granting `authenticated` role realtime access to the specific channel namespace via `realtime.set_config` — no new tables.

### Verification
- Playwright e2e: open two tabs on `/trade` for the same user, start a concierge turn in tab A, lock the brief in tab B, confirm tab A's UI receives `brief_locked` and the next assistant turn cites the brief without a fresh page load.
- Server-side unit test in `_resume.ts` companion test file: mock supabase client, assert `openHandoffChannel().emit("proposal_ready", ...)` calls `channel.send` with the expected shape.
- Manual: kill the tab mid-turn, reopen, verify `serveResume` still terminates cleanly (no channel leak) — the finalize path must broadcast + close in one atomic block.

---

## Non-goals for this change
- No changes to the RAG pipeline in `trade-concierge` (already mature).
- No new tables; both parts reuse existing infra (`concierge_stream_sessions`, `brief_drafts`, `trade_concierge_actions`).
- No changes to auth model — the public endpoint stays behind its member-only JWT gate.
- No LLM model swap.

## Rollout order
1. Ship Part 1 Tier A (scripted roster) — smallest surface, immediate hallucination reduction.
2. Ship Part 2 server side + client subscription (server → client redundancy), verify no regressions on the SSE path.
3. Turn on Part 2 client → server events (brief_locked first, others behind a feature flag).
4. Ship Part 1 Tier B (semantic retrieval) once the public RPC is reviewed.