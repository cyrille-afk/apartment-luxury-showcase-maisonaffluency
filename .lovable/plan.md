# AI Concierge Demo Tour

Interactive, click-through walkthrough of the full trade workflow, launched from a prominent CTA on `/trade`. Sandbox mode — no rows written to real production tables; a scratch project/quote lives only in `sessionStorage` and is torn down when the tour exits.

Scenario constants baked into the tour:
- City: **Singapore**
- Client: **Affluency ETC Pte Ltd**
- Project: **Chatsworth Road GCB**
- Focus: Man of Parts sofas, armchairs, coffee table
- Room: 6×5 m living/dining

## The 8 steps

1. **City & typology intro** — Concierge panel opens with a scripted assistant greeting mentioning Singapore GCB market.
2. **Free-text intent** — Prefills the composer with "I'm currently working on furnishing a GCB living and dining room" and auto-sends via the existing `concierge:stage` event with `autoSend:true`.
3. **Pasted brief** — Prefills the full brief ("6×5 m GBC living room… sofas, armchairs, coffee table from Man of Parts") and auto-sends. AI returns the curated tearsheet as normal.
4. **3D configuration + lock finishes** — Tour advances to `/trade/products/:slug` for each of 3 Man of Parts picks (sofa, armchair, coffee table). Spotlight highlights the 3D viewer + finish selectors; a "Lock finish" affordance calls the existing selection state and stamps `variant_label` into the sandbox draft.
5. **Add to project** — Spotlights the "Add to Project" control; picks the sandbox project "Chatsworth Road GCB" (auto-created client-side, not persisted).
6. **Tearsheet reveal** — Navigates to `/trade/tearsheets/:sandboxId` and highlights the key fields (image, designer, finishes, dimensions, RRP, trade price).
7. **Quote creation** — Navigates to `/trade/quotes/:sandboxId` (QuoteDetail rendered with the sandbox draft). Highlights: selected finishes visible on each line, prices, subtotals.
8. **PDF download** — Triggers the existing `quotePdf.ts` builder against the sandbox quote, with client name "Affluency ETC Pte Ltd" and project "Chatsworth Road GCB" stamped on the cover. File downloads locally.

Each step: a floating narration card (bottom-right) with title, one-sentence explanation, "Back / Next / Exit demo" controls. A translucent spotlight ring points to the relevant UI element. Exiting the tour clears `sessionStorage` and returns to `/trade`.

## Technical

**Entry point** — `TradeLanding.tsx`: add a "See it in action" CTA button in the hero section that navigates to `/trade/demo` (or sets `?demo=1` and starts the tour immediately from any page).

**Tour engine** — new `src/components/demo/DemoTourProvider.tsx`:
- Context exposes `{ step, next, prev, exit, isActive }`.
- Step registry: `steps: DemoStep[]` where each step declares `{ id, route, narration, target, onEnter, onExit }`.
- `onEnter` for step 2/3 dispatches `window.dispatchEvent(new CustomEvent("concierge:stage", { detail: { openPanel: true, prefill, autoSend: true } }))` — the existing handler in `AIConcierge.tsx` (already wired at line 995–1058) accepts this shape.
- Navigation between steps uses `useNavigate` for cross-page hops.

**Sandbox data layer** — new `src/lib/demoSandbox.ts`:
- `SANDBOX_QUOTE_KEY`, `SANDBOX_PROJECT_KEY` in `sessionStorage`.
- Shape mirrors `trade_quotes` + `trade_quote_items` + `trade_products` columns already consumed by `QuoteDetail.tsx`.
- Seeded with 3 real Man of Parts pick IDs (queried once from `designer_curator_picks` at tour start) so images and dimensions load through existing fallbacks.
- `QuoteDetail.tsx` and `TradeTearsheets.tsx` receive a small hook `useSandboxOverride(id)` — when the URL id starts with `demo-`, they read from sessionStorage instead of Supabase. Zero changes to production code paths outside that guarded branch.

**Spotlight/narration UI** — new `src/components/demo/DemoOverlay.tsx`:
- Fixed positioned card, framer-motion fade.
- Uses `data-tour-id="..."` attributes on target elements to compute a bounding-box highlight (`getBoundingClientRect` + a portal-rendered outline div). Adds `data-tour-id` to the concierge composer, product page 3D viewer, finish selector, "Add to Project" button, tearsheet header, quote line row, and PDF download button.

**PDF client + project stamping** — `quotePdf.ts` already accepts client/project info; the sandbox quote object supplies `client_name = "Affluency ETC Pte Ltd"` and `project_name = "Chatsworth Road GCB"`. Verify these render on the cover page; if the current PDF omits either, add a small header block.

**Routing** — new route `/trade/demo` in `App.tsx` that renders `TradeLanding` with `?demo=1` OR a dedicated `<DemoLauncher/>` that immediately activates the tour.

**Cleanup** — On `exit()` or when navigating away from `/trade/*`: clear sandbox keys, close concierge panel, remove `data-tour-id` listeners.

## Files to add
- `src/components/demo/DemoTourProvider.tsx`
- `src/components/demo/DemoOverlay.tsx`
- `src/components/demo/steps.ts` (step definitions + narration copy)
- `src/lib/demoSandbox.ts`
- `src/pages/TradeDemoLauncher.tsx`

## Files to edit (minimal, guarded)
- `src/App.tsx` — mount `DemoTourProvider` under trade routes; add `/trade/demo` route.
- `src/pages/TradeLanding.tsx` — hero CTA "See it in action".
- `src/components/trade/QuoteDetail.tsx` — `useSandboxOverride` branch (behind `id.startsWith("demo-")`).
- `src/pages/TradeTearsheets.tsx` — same guarded branch.
- `src/pages/TradeProductPage.tsx` — add `data-tour-id` attrs; no behavior change.
- `src/lib/quotePdf.ts` — verify/ensure client + project render on cover (small change if missing).

## Out of scope
- No new Supabase tables, migrations, or edge functions.
- No changes to real concierge streaming, product data, or PDF business logic beyond client/project header verification.
- No mobile-specific tour choreography in v1 (desktop-first; tour disables on <lg breakpoint with a "best viewed on desktop" toast).
