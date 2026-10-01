- Mobile homepage and /gallery use the original `Gallery`; desktop uses `InteractiveGalleryLookbook`.
- Derive desktop lookbook side picks from each photo's `gallery_hotspots` coordinates and resolve details against the public catalog with image-only fallback; this keeps slide picks synchronized with their visible objects without exposing trade-only catalog entries.
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
- OOL 77 Mini bar shows exactly two finish dropdowns (Frame: Cement Stuc/Glossy Lacquer; Drawer: Wood species + Suede Leather). The single-value Shelf axis ("Wood") is auto-committed in FinishSelector without a third accordion, and the shelf swatch must never emit onWoodFinishPricingChange (it would hijack the "Frame:" price caption). Regression test: src/components/FinishSelector.ool-minibar.test.tsx.
- OOL 77 Mini bar has no curated preset chips (removed at user request); its Frame/Drawer dropdowns mirror the finishes linked to the photo on screen from first load until the user picks one.
- Admin/role gates must wait for `useAuth().rolesLoaded` before redirecting, and auth redirects to /trade/login must carry `?next=`; a failed or pending role lookup is not "not admin", and spurious SIGNED_OUT (re-checked against getSession) must not demote a valid session.
- OOL 77 Mini bar share links carry `?c=` (base64url "frame|drawer" swatch names, not indices) and its OG bridge forwards `c`; names survive catalogue reordering.
