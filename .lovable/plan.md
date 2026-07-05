# `/spec-schedule` opt-in spec-sheet export

## Goal

Let a trade user type `/spec-schedule` in the concierge composer and get a markdown SPECIFICATION SCHEDULE for the pieces already in their active tearsheet — without changing the default tearsheet-card contract, without touching the eval battery, and without any risk of model hallucination.

## Approach: pure client-side command, no LLM call

The command is intercepted in the composer BEFORE the message reaches the concierge edge function. The client resolves the active tearsheet, pulls its items and product rows directly from the database, and renders a deterministically-built markdown block as a synthetic assistant message. Because the content comes straight from `trade_products`, the "zero hallucination on metrics" mandate is honoured by construction.

Missing fields render literally as `Data not found in database.` per the copilot mandate; nothing is inferred or rounded.

## Command surface

- `/spec-schedule` — export the current active tearsheet (most-recently-updated non-converted board for the user).
- `/spec-schedule Dining Room A` — same, with a caller-supplied zone label in the header.
- `/spec-schedule board:<partial title or id>` — target a specific board by title match or UUID prefix.
- `/help` — list available slash commands (spec-schedule for now; room to add more).

Anything not matching the registry is passed through to the concierge as normal chat.

## User flow

1. User types `/spec-schedule Salon` and hits send.
2. Composer intercepts, does NOT stream to the concierge.
3. Client fetches:
   - active `client_boards` row (scoped to `auth.uid()`),
   - `client_board_items` for that board,
   - matching `trade_products` rows (title, category, designer, brand, dimensions, seat/arm heights, lead-time min/max, `is_contract_grade`, materials, `available_finishes`, image, sku, cad asset link).
4. Client builds the markdown block from a pure function and appends it as an assistant message (rendered with existing ReactMarkdown).
5. The block gets Copy-to-clipboard and Download-as-`.md` buttons; nothing is persisted server-side.

## Output format (markdown, per item)

```text
### SPECIFICATION SCHEDULE: <zone or board title>

**01 | <Product title>**
- **Designer / Brand:** <designer> | <brand>
- **Category / Typology:** <category>
- **Dimensions:** W: <width>mm x D: <depth>mm x H: <height>mm (Seat: <seat>mm / Arm: <arm>mm)
- **Material & Finish Catalogue:** <materials, available_finishes>
- **Technical & Logistics:** Lead Time: <min>-<max> weeks | Contract Grade: Yes/No
- **Project Documentation Assets:** [Image](<url>) | [CAD](<url>)
```

Any field whose source column is null/empty renders as `Data not found in database.` on that line. No fabricated values, no unit conversion beyond mm (already the storage unit).

## Files

- **New:** `src/lib/conciergeSlashCommands.ts` — parser + registry (`{ name, aliases, handler }`).
- **New:** `src/lib/specScheduleBuilder.ts` — pure function `buildSpecSchedule(zone, items[]) -> string`, easy to unit-test.
- **New:** `src/lib/specScheduleBuilder.test.ts` — fixtures covering (a) full data, (b) all-null fields render `Data not found in database.`, (c) partial data.
- **New:** `src/components/trade/concierge/SpecScheduleBlock.tsx` — renders the markdown with Copy + Download .md actions.
- **Edit:** `src/components/trade/AIConcierge.tsx` — in the composer submit path, run the slash parser first; on a match, resolve the active board via Supabase, hydrate items, append a synthetic assistant message rendered by `SpecScheduleBlock`. On failure (no active board, no items, RLS error), append an assistant message stating the specific reason — never fall through silently to the LLM.
- **Edit:** `supabase/functions/trade-concierge/index.ts` — add one short sentence to the system prompt clarifying that `/spec-schedule` is a client-side command and the model must NEVER emit a markdown SPECIFICATION SCHEDULE itself, even if the user asks — the client renders it. Reinforces existing prohibition.

## What does NOT change

- The default tearsheet-card output contract stays intact.
- No changes to `propose_tearsheet` / `add_to_tearsheet` tools.
- No changes to the eval battery (`evalBattery_test.ts`, `specSheetBlock_test.ts`, `no_strict_typology_reply_test.ts`).
- No new edge function, no new table, no new RLS policy — the command uses the existing `client_boards` / `client_board_items` / `trade_products` reads that already work for the user.

## Verification steps (after implementation)

1. `bunx vitest run src/lib/specScheduleBuilder.test.ts` — pure-function snapshots pass, including the all-null "Data not found in database." case.
2. Manual: log in, open an existing tearsheet with 3+ items, type `/spec-schedule` in the concierge, confirm block renders with real DB values and no fabricated fields.
3. Manual: empty account with zero boards, type `/spec-schedule`, confirm the assistant message says "No active tearsheet found" rather than calling the LLM.
4. Manual: type `/spec-scheduleXYZ` (unknown), confirm the message goes to the concierge normally.
5. Re-run the concierge eval battery to confirm no regression in the default card contract.

## Open question

Should `/spec-schedule` (a) render inline as an assistant message with copy/download (recommended, matches how tearsheet cards live inline), or (b) open the block in a side panel like `TearsheetInsightsSidebar`? I will default to (a) unless you say otherwise.
