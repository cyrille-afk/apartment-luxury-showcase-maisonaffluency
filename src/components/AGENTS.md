- OOL 77 Mini bar shows exactly two finish dropdowns (Frame: Cement Stuc/Glossy Lacquer; Drawer: Wood species + Suede Leather). The single-value Shelf axis ("Wood") is auto-committed in FinishSelector without a third accordion, and the shelf swatch must never emit onWoodFinishPricingChange (it would hijack the "Frame:" price caption). Regression test: src/components/FinishSelector.ool-minibar.test.tsx.
- OOL 77 Mini bar has no curated preset chips (removed at user request); its Frame/Drawer dropdowns mirror the finishes linked to the photo on screen from first load until the user picks one.
- OOL 77 Mini bar sharing uses a readable public product address with frame/drawer finish-name slugs; the selector restores those names and legacy `?c=` links so existing shares survive catalogue reordering.

- Finish accordions: when every linked swatch maps to a Base/Top matrix value (name, "Family - colour" prefix, generic "Wood" = wood species, accent-insensitive), `FinishSelector` renders one accordion per axis and emits the matrix value — prevents duplicate/mislabelled finish dropdowns without per-product IDs.
- When Base and Top explicitly name distinct materials, `FinishSelector` groups linked swatches by library category before falling back to variant-name matching — prevents a differently named metal patina from appearing under a glass diffuser.
- Single-axis products whose linked finishes span exactly two stored categories render one FinishSelector dropdown per category (labelled like the Pictured Finishes strip), and a slide counts as non-specific only when more than two finishes map to every photo — keeps dropdowns and strip in agreement.


# Gallery (Gallery.tsx / InteractiveGalleryLookbook.tsx)

- Mobile homepage and /gallery use `Gallery`; desktop uses `InteractiveGalleryLookbook`.
- Derive desktop side picks from photo hotspot coordinates against the public catalog, with image fallback; never expose trade-only picks.
- Desktop gallery chevrons cross four photos, then wrap through seven rooms; leave mobile accordion untouched.
- Hide desktop side picks only on first Living photo; keep all other one-column picks and curated order; preserve pins.
- Desktop-only hotspot or side-pick exclusions must stay in `InteractiveGalleryLookbook`; never delete shared `gallery_hotspots` rows because the original mobile `Gallery` consumes them.
- Gallery hotspot and finish dialogs use body portals to avoid clipping.
- Fetch the two approved MicMac pins and side photos via scoped public RPC; never widen trade-only designer access.
- Reveal gallery photo with pins/catalog only when ready. Board guests use hashed-token RPCs; invites rebuild URLs server-side.
- Room menu previews use room-specific percent pins and alternatives.
