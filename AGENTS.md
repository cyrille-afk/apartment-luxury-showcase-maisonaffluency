- Trade owns breadcrumbs; Collection opens top; `/trade/gallery/:slug` shares the public profile header; shortcuts use latest.
- Admin application actions save review metadata before app-email sends; decline-and-delete queues the notice before deleting, with stable per-application/template idempotency keys — failures must not erase the retryable record.
- Approve/decline open a side-effect-free draft review; only confirmation runs actions; one shared plain-text copy/parser feeds preview and escaped templates — edits keep branding, no HTML.
- Felix advances before gallery load; greeting tracks tour state. Share regional tiers; eligibility stays EUR-ledger based.
- Felix/Benefits: max-w-[1500px] px-6; Felix left, results right, one useMoodboardSourcing; Benefits 50/50, left text.
<!-- LOVABLE:BEGIN -->
- Public moodboard previews use published catalog and public RRP only; email unlock stays local so no account or trade entitlement is implied.
<!-- LOVABLE:END -->
12. Felix sourcing matching/ranking runs only in the `felix-sourcing` edge function; the client receives final results only — keeps the matching rules out of the browser bundle.
13. No standalone Collectibles page: collectible designers/pieces live only in the unified designers directory and shared product templates; /collectibles redirects to /designers — one catalogue, one layout.
14. Resolve finish-specific trade RRPs via approved-member pricing, never the price-stripped public pick view, to preserve price visibility.
- OOL 77 Mini bar finish rules live in src/components/AGENTS.md.
- Admin/role gates must wait for `useAuth().rolesLoaded` before redirecting, and auth redirects to /trade/login must carry `?next=`; a failed or pending role lookup is not "not admin", and spurious SIGNED_OUT (re-checked against getSession) must not demote a valid session.
- Never register a blocking beforeunload prompt (preventDefault/returnValue) for admin editor drafts; persist drafts to storage instead — the prompt freezes the embedded preview on every code-update reload.
- Designer Editor restore uses a once-per-load sessionStorage guard (ma-designer-editor-restore-guard-v1): if the last load wasn't responsive for 5s, open collapsed — stops restore re-freeze loops.
- Curator Notes: product pages = full-width list; lightbox = three columns.
- Supplier PDFs stay labelled Fabric & Finishes, separate from spec sheets, so they never replace the generated swatch-selection PDF.
- Match each slash-separated explicit product category/subcategory placement independently in catalogue filters; dual-purpose pieces belong in both departments without allowing generic tags to override primary categories.
- Room facets include own designer, parent house and exact published subtitle credit — credited makers stay filterable.
- Render edition labels via `editionLabel` and dedupe Ecart badges. Chips are page-scoped: child pages "REEDITION", house page "Ecart REEDITION"; embedded sections pass `pageDesignerName`.
- Curatorial Guide: 800ms classifier budget, FRONTIER on timeout/failure; tiers vary reasoning effort, not model; turns are persisted only by `curatorial-guide-stream` after an ownership check — accuracy first, no client-forged history.
- Trade Concierge Felix workspace threads live in concierge_threads (workspace=true, project_id) and restore per user+project via localStorage keys; the floating Felix lists only workspace=false — keeps each project's curation separate.
- Client View has one synchronous external-store state and a document-root CSS guard for marked trade-only elements, including exit animations and portalled drawers, so route remounts cannot briefly reveal internal figures; it is not an authorization boundary.
- Client prices use clientUnitCents: no markup shows RRP, never net trade, so Client View can't leak wholesale prices.
- Static hardcoded trade cards must be filtered by DB is_hidden keys (curator picks + trade_products) in useTradeProducts — otherwise hidden products resurface from the static arrays.
- The Extension Integration sandbox embeds the trade sidebar through its same-origin route; parent-page sync notices must verify the saved project and board item before confirming success.
- Top-down proforma ledgers inherit project defaults unless a quote explicitly selects itemized or target-ceiling mode; all ceiling arithmetic lives in `calculateCeilingBudget` so screen and PDF figures cannot drift.
- All trade PDFs use `pdfFormatting` for fixed two-decimal money and locale-preset dates; quotes may override their studio default so previews and downloads cannot drift.
- Maker-name variants (accents, casing, house/founder suffixes) map to the published profile name in src/lib/brandNormalization.ts via accent-folded keys — one maker, one filter entry and card label.
- Edge-function deploy checks, MCP OAuth and extension folder rules live in supabase/functions/AGENTS.md.
- `product_fabric_swatches_public` refreshes only affected picks (transition-table triggers); never TRUNCATE-rebuild — its lock timed out admin saves.
- AI layout rules: src/components/trade/visualiser/AGENTS.md; presets share safety checks and export look-at samples so preview/render agree.
