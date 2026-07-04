## Current state (already built, keep as-is)

- Row **locks** (🔒), **skips**, and **title rename** exist in `TearsheetProposalCard`.
- Buttons already present: **Validate Changes (N)**, **Critique My Edits**, **Regenerate Unlocked**.
- Existing behavior: all three send a prose prompt into chat; the model replies as plain text. `handleRegenerateUnlocked` replaces the whole card with a new proposal.

## What's missing (this plan)

1. Validation returns **prose only** — no traffic lights, no per-row verdict.
2. Regeneration **overwrites** unlocked rows silently — no diff, no per-line accept, no "Your Edits vs AI Suggestions" view.

## Deliverables

### A. Structured Validation (traffic-light per row)

- New edge tool `validate_tearsheet_edits` in `supabase/functions/trade-concierge/index.ts`.
  - Input: `{ tearsheet_id, kept_ids[], skipped_ids[], locked_ids[], title_from?, title_to? }`.
  - Output: `{ overall: "green"|"yellow"|"red", summary: string, per_row: [{ pick_id, status: "green"|"yellow"|"red", reason: string }], global_warnings: string[] }`.
  - Grounded on the same catalog rows the original proposal used (brief coverage, palette clash, scale imbalance, budget posture).
- New SSE event `event: validation` streamed alongside `event: proposal`.
- Client: on **Validate Changes** click, call the tool and render results **inline in the card** as small pills next to each row + a header banner (overall + summary). Replaces today's chat-message prose fallback for this button only. Critique button remains prose.

### B. Cascading Re-align with diff UI

- New edge tool `realign_unlocked_picks`.
  - Input: `{ tearsheet_id, locked_ids[], excluded_ids[], unlocked_ids[], title }`.
  - Output: `{ replacements: [{ old_pick_id, new_pick_id, reason }], additions: [{ new_pick_id, reason }], removals: [{ pick_id, reason }] }` — a **delta**, not a whole new list. Never touches locked or excluded ids.
- New SSE event `event: realignment` carrying the delta + hydrated preview rows for any new pick_ids.
- Client: replace the current "wholesale replace" flow with a **RealignmentDiffPanel** rendered inside the card:
  - Two columns: **Your Edits** (locked + kept) vs **AI Suggested Re-alignments** (replacements/additions/removals with reasons).
  - Per-row **Accept** / **Reject** buttons + **Accept All** at the top.
  - Accepted deltas mutate the local proposal (swap old→new, add, remove). Locked rows are never in the delta.
- Keep the "regenerate from scratch" option available as a secondary menu item.

### C. Row-lock enforcement (server-side)

- Both new tools receive `locked_ids` and MUST NOT include any locked id in outputs. Add server assertion + one log line if violated (fail-closed: drop that entry, don't crash).
- Add unit tests in `supabase/functions/trade-concierge/` for both tools' lock enforcement.

## Files

**New**
- `src/components/trade/concierge/RealignmentDiffPanel.tsx` — split-view diff + accept controls.
- `src/components/trade/concierge/ValidationSummary.tsx` — banner + per-row pill renderer.
- `supabase/functions/trade-concierge/_realign.ts` — tool schema, catalog query, lock-guard, unit test target.
- `supabase/functions/trade-concierge/_realign_test.ts` — lock-enforcement tests.
- `supabase/functions/trade-concierge/_validate.ts` + `_validate_test.ts`.

**Edited**
- `src/components/trade/concierge/TearsheetProposalCard.tsx` — wire new panels; keep locks/skips/rename UI intact; rewire Validate + Regenerate Unlocked buttons.
- `src/lib/tradeConciergeStream.ts` — add `onValidation`, `onRealignment` callbacks + SSE frame parsing.
- `src/components/trade/AIConcierge.tsx` — plumb new callbacks to the active card.
- `supabase/functions/trade-concierge/index.ts` — register tools, emit new SSE frames, plumb into tool loop.

**Untouched**
- Existing critique/seed extraction, lock UI, chat transport, discovery gate (already fixed).

## Out of scope

- Persisting validation history to DB (in-memory per card session for now).
- Locks that survive tearsheet approval (locks live in the draft card only).
- Auto-triggering validation on every edit (stays manual — "Validate Changes (N)" button).

## Verification

1. Type-check + build.
2. New edge-function unit tests pass (lock enforcement).
3. Manual: skip 1, lock 2, rename title → click Validate → see per-row pills + banner. Click Regenerate Unlocked → see diff panel with locked pieces on left, deltas on right → Accept per-line → card updates only those rows → locked rows are provably identical.
