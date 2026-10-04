- Mobile homepage and /gallery use `Gallery`; desktop uses `InteractiveGalleryLookbook`.
- Derive desktop side picks from photo hotspot coordinates against the public catalog, with image fallback; never expose trade-only picks.
- Desktop gallery chevrons cross four photos, then wrap through seven rooms; leave mobile accordion untouched.
- Hide desktop side picks only on first Living photo; keep all other one-column picks and curated order; preserve pins.
- Desktop-only hotspot or side-pick exclusions must stay in `InteractiveGalleryLookbook`; never delete shared `gallery_hotspots` rows because the original mobile `Gallery` consumes them.
- Gallery hotspot and product finish dialogs use body portals above image galleries to avoid clipping and stacking traps.
- Fetch the two approved MicMac pins and side photos via scoped public RPC; never widen trade-only designer access.
- Reveal gallery photo with pins/catalog only when ready. Board guests use hashed-token RPCs; invites rebuild URLs server-side.
- Project shortcuts fall back to latest RLS-visible board/hub; Trade layout owns breadcrumbs.
- Felix tour spotlights await target sizes; keep prior rect while transitioning.
- Felix/Benefits: max-w-[1500px] px-6; Felix controls left, results right, one useMoodboardSourcing; Benefits 50/50, left text.
- Room menu previews use room-specific percent pins and alternatives.
<!-- LOVABLE:BEGIN -->
- Public moodboard previews use published catalog and public RRP only; email unlock stays local so no account or trade entitlement is implied.
<!-- LOVABLE:END -->
12. Felix sourcing matching/ranking runs only in the `felix-sourcing` edge function; the client receives final results only — keeps the matching rules out of the browser bundle.
13. No standalone Collectibles page: collectible designers/pieces live only in the unified designers directory and shared product templates; /collectibles redirects to /designers — one catalogue, one layout.
14. Resolve finish-specific trade RRPs via approved-member pricing, never the price-stripped public pick view, to preserve price visibility.
- Finish accordions: when every linked swatch maps to a Base/Top matrix value (name, "Family - colour" prefix, generic "Wood" = wood species, accent-insensitive), `FinishSelector` renders one accordion per axis and emits the matrix value — prevents duplicate/mislabelled finish dropdowns without per-product IDs.
- OOL 77 Mini bar finish rules live in src/components/AGENTS.md.
- Admin/role gates must wait for `useAuth().rolesLoaded` before redirecting, and auth redirects to /trade/login must carry `?next=`; a failed or pending role lookup is not "not admin", and spurious SIGNED_OUT (re-checked against getSession) must not demote a valid session.
- Single-axis products whose linked finishes span exactly two stored categories render one FinishSelector dropdown per category (labelled like the Pictured Finishes strip), and a slide counts as non-specific only when more than two finishes map to every photo — keeps dropdowns and strip in agreement.
- Never register a blocking beforeunload prompt (preventDefault/returnValue) for admin editor drafts; persist drafts to storage instead — the prompt freezes the embedded preview on every code-update reload.
- Designer Editor restore uses a once-per-load sessionStorage guard (ma-designer-editor-restore-guard-v1): if the previous load never stayed responsive for 5s, open with nothing expanded — prevents a hung restore from re-freezing on every reload.
- Curator Notes: product pages use a full-width vertical list (lead note tinted panel); the lightbox uses three columns (lead header tinted) — distinct contexts.
- Keep supplier PDFs labelled Fabric & Finishes in the finish-document menu, separate from general spec sheets, so adding a source PDF does not replace the generated swatch-selection PDF or mislabel it in the Trade workspace.
- Match each slash-separated explicit product category/subcategory placement independently in catalogue filters; dual-purpose pieces belong in both departments without allowing generic tags to override primary categories.
- Room facets include own designer, parent house and exact published subtitle credit — credited makers stay filterable.
- Render edition labels via `editionLabel` and dedupe Ecart badges. Chips are page-scoped: child pages "REEDITION", house page "Ecart REEDITION"; embedded sections pass `pageDesignerName`.
- Curatorial Guide: 800ms classifier budget, FRONTIER on timeout/failure; tiers vary reasoning effort, not model; turns are persisted only by `curatorial-guide-stream` after an ownership check — accuracy first, no client-forged history.
- Trade Concierge Felix workspace threads live in concierge_threads (workspace=true, project_id) and restore per user+project via localStorage keys; the floating Felix lists only workspace=false — keeps each project's curation separate.
- Client View has one synchronous external-store state and a document-root CSS guard for marked trade-only elements, including exit animations and portalled drawers, so route remounts cannot briefly reveal internal figures; it is not an authorization boundary.
- Client prices use clientUnitCents: no markup shows RRP, never net trade, so Client View can't leak wholesale prices.
