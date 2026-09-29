- Mobile homepage and /gallery use the original `Gallery`; desktop uses `InteractiveGalleryLookbook`.
- Derive desktop lookbook side picks from each photo's `gallery_hotspots` coordinates and resolve details against the public catalog with image-only fallback; this keeps slide picks synchronized with their visible objects without exposing trade-only catalog entries.
- Desktop gallery chevrons traverse all four photos before moving to the next/previous room, wrapping across the seven rooms; this provides uninterrupted photo navigation while leaving the mobile accordion untouched.
- Only the first Living Room photo hides desktop side product picks; all other photos keep vertical one-column picks, with explicitly curated first-scene order preserved, so the gallery entrance stays clean without changing hotspot pins.
- Desktop-only hotspot or side-pick exclusions must stay in `InteractiveGalleryLookbook`; never delete shared `gallery_hotspots` rows because the original mobile `Gallery` consumes them.
- Gallery hotspot details use centered `PublicProductLightbox` in a body portal, including over expanded photos, to prevent clipping.
- Fetch the two approved MicMac pins and side photos via scoped public RPC; never widen trade-only designer access.
- Reveal gallery photo with pins/catalog only when ready. Board guests use hashed-token RPCs; invites rebuild URLs server-side.
- Project shortcuts fall back to latest RLS-visible board/hub; Trade layout owns breadcrumbs.
- Felix tour spotlights await target sizes; keep prior rect while transitioning.
- Felix + Trade Program Benefits: shared navbar rhythm container max-w-[1500px] px-6, edges flush with Navigation; Felix = Controls left + Results right (col-span-2), one useMoodboardSourcing; Benefits 50/50 split, left-aligned text, gap-8/lg:gap-12.
<!-- LOVABLE:BEGIN -->
- Public moodboard previews use published catalog and public RRP only; email unlock stays local so no account or trade entitlement is implied.
<!-- LOVABLE:END -->
12. Felix sourcing matching/ranking runs only in the `felix-sourcing` edge function; the client receives final results only — keeps the matching rules out of the browser bundle.
13. No standalone Collectibles page: collectible designers/pieces live only in the unified designers directory and shared product templates; /collectibles redirects to /designers — one catalogue, one layout.
14. Resolve finish-specific trade RRPs via approved-member pricing, never the price-stripped public pick view, to preserve price visibility.
