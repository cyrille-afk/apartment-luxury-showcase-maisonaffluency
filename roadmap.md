# Roadmap
- [ ] Add product Studio/Presentation modes and verify routes, retail-only localized prices, sidebar and studio EUR.
- [x] Add comparator A–Z designer browsing with curator picks, catalogue search and favourites; seven tests pass, live Ondas/Dais selection shows Silver −10% prices, and Client View removes the net trade row without page errors.
- [x] Add recorded manufacturer names and product-page links to selected room pieces; all three trade sourcing buttons open correct product pages live without page errors; new shared snapshots retain manufacturer and public product links.
- [x] Show selected generated-piece name, RRP and recorded dual-unit dimensions in studio and shared views; live selection verified for all three pieces, direct lamp-model selection and dismissal pass without page errors; sofa/table dimensions are not recorded.
- [x] Add item-name labels above generated room pieces in studio and shared client views; live generation at 1620×1186 shows all three names without overlap or page errors.
- [x] Add full-room and per-piece close-up camera presets; six framing tests pass, browser screenshots verify overview, sofa/table/lamp close-ups and portrait lamp framing; extended return-flow browser checks timed out.
- [x] Add an opened/not-opened portal-email filter to the trade applications queue; eight tests pass, live queue filtered studio 1:10 vs Wecraft correctly, temporary tracking rows removed afterwards.
- [x] Add a plain-text trade portal link beneath the button in the invitation and approval emails; four deployed preview cases render the copyable URL with tracking intact, no emails sent.
- [x] Add a plain-text trade portal link beneath the welcome email button; live deployed preview renders both the button and the copyable URL under it, no emails sent.

- [x] Replace the welcome email's fixed designer total with the live published count; seven tests pass, both deployed services healthy, live preview matches 101 and overrides stale input without sending emails.
- [x] Replace the welcome email's fixed tax/VAT claim with recorded verification; nine tests pass and all six deployed preview cases verified without sending emails.
- [ ] Verify approved-applicant email delivery → password setup → fresh sign-in → Trade portal: activation page published and live browser verified Oct 8; full journey still needs a controlled test recipient. 25 regression tests pass; no applicant emails sent or passwords changed.
- [x] Restore approved-studio activation resend; Studio 1–10 drawer opened and cancelled live, 20 tests pass, no email sent.
- [x] Publish activation before emailing Studio 1–10: published /trade/activate now renders Activate your trade access and Continue activation; verified live Oct 8. No resend sent.
- [x] Add actual camera-route thumbnails and speed-aware estimated durations to the shared-layout path menu; verified all four sample routes, selection, and 2× estimates live without page errors.
- [x] Persist walkthrough camera path, playback speed and repeat settings; 17 tests pass, browser reload restored Slow orbit / 1.5× / repeat on, confirmed in screenshots. Extended navigation checks were limited by preview rendering stalls.
- [x] Blend camera preset changes during playback; 13 tests pass, browser position/rotation continuity, safe bounds, pause/resume, rapid switching, speed and loop verified without page errors.
- [x] Add walkthrough keyboard shortcuts and continuous replay; 11 tests pass, browser pause/resume/restart/speed/typing protection/loop-on/loop-off verified.
- [x] Add slow-orbit and furniture-tour presets; eight tests pass, browser pause/seek/resume/switch verified without page errors, selected paths export correctly.

- [x] Add the eight existing cropped Pendhapa wood finishes to Astra without duplicates; all eight photos verified on public and Trade pages.

- [x] Add all eight existing lacquer swatches to Astra Dining Table without duplicates; all photos verified on public and Trade pages.

- [x] Crop Viola Calacatta marble and add its Pendhapa library entry and Deepah finish link; photo verified on public and Trade pages without runtime errors.

- [x] Crop Natural teak, Dark teak and Black teak; add three Pendhapa library entries and Deepah links without duplicates; verify all photos on public and Trade pages.

- [x] Reused ten existing Pendhapa marble swatches for Deepah without duplicates; all ten photos verified on public and Trade pages without runtime errors.

- [x] Crop the 16 supplied Atelier Pendhapa finishes, add shared library records and Anemos links; all 16 images verified on public, Trade and Material Library pages without runtime errors.

- [x] Default Full Catalogue to closed filters and four columns; live open/close, density-change recovery, refresh, aligned edges and no overflow verified.

- [x] Replace legacy communication addresses with live concierge/trade addresses; seven email services deployed and checked, seven tests pass, displayed links verified without sending test emails; account identities unchanged.
- [x] Automatically copy concierge/trade app emails to Cyrille and Gregoire; nine tests passed, recipient suppression and stable retry keys verified, shared queue worker deployed and live-checked without test sends.

- [x] Restore the Full Catalogue collapsible filter drawer with five groups; live selection/clearing and three/four-column hide/show verified, six loading regressions pass.

- [x] Add 24-piece catalogue batches and decoded alternate-image hover swaps; six regression tests passed, full live scroll reached 589 current pieces, hover made no image request, filter reset and broken-image fallback verified.

- [x] Add editable approval/decline email draft review; 12 tests, clean compilation, rendered email checks and admin drawer interactions verified without real sends; publish requested.

- [x] Route trade approvals to the branded template, send refined declines before deletion; seven action tests, email rendering, clean compilation and deployed-service checks passed.

- [x] Embed the AI Extension catalogue in a fixed 360px sandbox drawer and verify staged project records before confirming sync on the parent page.

- [x] Label localized starter projects as samples and let members turn them into real projects without losing their folders or boards.

- [x] Seed an empty first-time project workspace with a regional sample folder and synchronize Felix Step 4 with its title.

- [x] Lock Step 5 and tracker to fixed annual EUR/USD/SGD milestones and regional examples.

- [x] Localize Felix Step 5 and the dashboard tier tracker to US fixed USD, EUR, and SGD baselines with consistent examples and verification.

- [x] Refine the global Client View control and Step 6 spotlight; verify immediate retail presentation on toggle and Next.
- [x] Keep Felix mounted through Client View, advance Step 6 on switch or Next, and anchor Step 7 to the Collection heading.

- [x] Align Felix Steps 2–3 with Interactive Sourcing and Transparent Project Margins; preserve Back and make Pause hide the tour frame until Resume.

- [x] Replace Felix Step 2's pin with a radar dot and advance before gallery navigation resolves.

- [x] Add a centered pulse to Felix Step 2's showroom image, clarify its click prompt, and advance to Step 3 on gallery navigation.

- [x] Show first-time welcome on the dashboard until Felix is completed or skipped, and align Step 2 copy.

- [x] Anchor Felix Step 2 to the dashboard Curated Showroom card; require a card click and keep Interactive Galleries visible before continuing.

- [x] Give studio headers and specification PDFs a serif text-logo fallback, label unpriced pieces Price upon Request, and strip generator metadata from schedule downloads.

- [x] Add automated Client View checks for markup math, document masking, generic attribution, and exported PDF text; run in the existing unit-test CI job.

- [ ] Add studio branding profile, persistent Client View masking and project markup, and white-label client specification export.
- [x] Prevent marked trade-only content flashing during Client View navigation, loading, and animated transitions; verify rapid switching and reload on the board and project studio.

- [x] Unblock Welcome Tour Step 8: stop the second automatic scroll and provide a direct Client View action; verify the tour advances and the board remains usable.

- [x] Correct Living gallery alternatives for Stéphane CG wall art, low stools, and floor lamps; verify in the live preview.

- [x] Publish only Solare Side Table and Griffe Stool / Side Table prices for Amélie Vermersch; list Griffe in both stool and side-table subcategories.

- [x] Apply the pictured-finish strip and photo-led selection to all products with mapped finish photos on public and Trade pages; preserve explicit choices and leave unlinked photos unselected.

- [x] Replace the OOL 77 Mini bar's technical bridge URL and opaque finish code in new shares with a readable public product address and finish names; retain legacy link support.

- [x] Restore room collection sidebar filters and a fixed three-column desktop catalog without changing room dropdown previews.
- [x] Match the reference material categories to public room pieces and mark categories with no matching pieces.

- [x] Preserve the full portrait room image and reveal compact horizontal alternatives in a bottom overlay when its hotspot is selected.

- [x] Show uncropped alternatives, anchor the Bedroom hotspot on the left lamp base, and rotate three distinct public catalog pieces per room mount.

- [x] Replace Office dropdown alternatives with Solare, Kalb B, and Arbor desks; restore its exact justified tagline without changing other rooms.

- [x] Match Shop by Room collection card image canvases and caption grids to the designer collection styling.

- [x] Balance the room subtitle above its label and reduce the image-to-collection gap so the product breakdown is immediately visible.

- [x] Match the Dining dropdown's three curated dining tables to published catalog photos, and restore the exact crimson-black tagline beneath the cards.

- [x] Align Living coffee-table and Office desk preview pins with their furniture and highlight room-matched alternatives.

- [x] Put room choices first in desktop menus, send room clicks to their product grid, and make preview hotspots reveal and highlight alternatives.

- [x] Consolidate Living, Dining, and Bedroom dropdown destinations on the left and show a framed Alternative Universes visual preview on the right.

- [x] Add branded app recovery for blank pages after edge failures, with a visitor-controlled retry that preserves the current address.

- [x] Add live catalogue-backed material suggestions to Felix's strict-match empty state and make suggestions searchable with one click.

- [x] Add Emmanuel Levet Stenne's Dress Up Stone Collection 1 as six catalog pages with two stone finishes, cropped photos, supplied RRP, and French origin; leave lead time blank unless documented.

- [x] Move the sourcing preview from the homepage and public gallery into the Trade Program Felix section, retaining the advisor and metrics.
- [x] Add a public sourcing preview with catalog matches and a verified trade gate that forwards lead emails directly to the Trade Program form.
- [ ] Source and verify the requested Monarch, Roku, and 交叉 ash chairs before featuring them; their stated designer/material combinations are not in the published catalog.

- [x] Restore the Monster Gold-Tone Incense Burner pin and right-side pick on desktop Living Room photo 4/4; order left picks Japanese Cranes Wallcover, Vallauris Floor Lamp, AB Chair without changing mobile or shared records.
- [x] Show the approved MicMac Chandelier photo in the Master Suite side picks on photos 1/4 and 3/4, without exposing its trade-only catalogue entry.
- [x] Place the Office desk side pick on the left in photos 1/4 and 2/4.
- [x] Reveal gallery photos and their hotspots together after both are ready, on desktop and mobile.
- [x] Show only the two MicMac Chandelier gallery pins on Master Suite photos 1/4 and 3/4 while preserving Hervé van der Straeten's trade-only catalogue status.
- [x] Hide the tour video's initial native loading indicator and reset to its opening image after exit or completion.
- [x] Restore natural desktop product-lightbox height so dimensions, actions, notes, and related images do not overlap or leave a blank lower panel.
- [x] Make every room photo expandable in a centered lightbox with correctly positioned hotspots on desktop and mobile.
- [x] Restore the Vintage Lounge Chair hotspot on mobile while hiding it only from the matching desktop scene.
- [x] Top-align Living Room photos 2–4 on desktop.
- [x] Replace room product-grid landing with editorial lookbook.
- [x] Add the nine-room navigation ribbon.
- [x] Add room-specific imagery, arrows, counters, and keyboard navigation.
- [x] Route existing Shop By Room destinations into the lookbook.
- [x] Verify all room destinations on desktop and mobile.
- [x] Restore interactive gallery hotspots and product lightboxes.
- [x] Add Tour Our Gallery and The Curators to the gallery ribbon.
- [x] Verify room, video, curator, carousel, and product-detail states.
- [x] Transform gallery scene products into a centered, free-floating editorial grid.
- [x] Repair the Interactive Gallery canvas, hotspot scaling, and room ribbon on mobile.
- [x] Make Tour Our Gallery the default and first ribbon destination.
- [x] Replace the gallery product grid and modal overlay with a pinned hotspot preview panel.
- [x] Center the gallery tour with equal spacing and user-directed sound controls.
- [x] Restore the gallery tour's 16:9 frame and native fullscreen controls.
- [x] Restore the room canvas width, flush preview alignment, and compact gallery spacing.
- [x] Launch the gallery tour fullscreen with sound and pause it on fullscreen exit.
- [x] Add the in-image scene timeline and counter, fully open the hotspot preview, and compress gallery header spacing.
- [x] Restore four single-photo room slides with centered, uncropped portrait presentation and independent hotspots.
- [x] Compress the gallery header and align the timeline, image canvas, and footer to one 1280px grid.
- [x] Replace the Tour video text overlay with a solid geometric play icon while preserving fullscreen sound playback.
- [x] Elevate room titles, frame the gallery timeline, and consolidate slide controls beneath the canvas.
- [x] Lock gallery header geometry across every state, move controls above the canvas, and ground portrait scenes.
- [x] Replace the homepage legacy gallery stack with the interactive lookbook and lock the global desktop header height.
- [x] Make the homepage lookbook open on the hotspot canvas with its controls below and drawer toggle over the image.
- [x] Match the gallery utility ribbon to the photo width with microtype, counter-first ordering, and no chevrons.
- [x] Float the privacy notice as muted text and place the Tour introduction above the video.
- [x] Rebuild The Curators as two balanced editorial founder profiles with French identity markers.
- [x] Increase the gallery utility ribbon typography and rebalance its vertical spacing.
- [x] Replace portrait gallery side fills with a seamless architectural ruled canvas while preserving hotspot coordinates.
- [x] Restore the original mobile gallery experience with its scene accordion, swipeable images, and product hotspots on the homepage and gallery page; keep desktop on the new lookbook.
- [x] Point both Singapore Gallery Preview buttons to the gallery page instead of retired landing-page sections.
- [x] Add Cloud Filigrane and Volume 3 Blue curator picks beside the Dining Room gallery image on desktop only.
- [x] Add Astra Dining Table and PéPé Dining Chair curator picks to the left of the Dining Room gallery image on desktop only.
- [x] Add Autumn Chandelier (Custom Saint-Just Glass) and Gold & Silver Snake Vessel picks beside the Boudoir gallery image on desktop only.
- [x] Add Lyric Desk Walnut (Atelier BdM) and PéPé Dining Chair (Hamrei) curator picks to the left of the Boudoir gallery image on desktop only.
- [x] Add Master Suite featured curator picks (Villa Pedestal, Brunelleschi, Bud Table Lamp) beside the gallery image, desktop only.
- [x] Remove Roman Frankel from the Made in Kira name in the Designer Editor.
- [x] Show each desktop gallery photo's hotspot product images as clickable picks on the matching side; preserve mobile gallery and existing curated selections.
- [x] Add black rectangular midpoint chevrons beside desktop gallery photos to move through photos and adjacent rooms.
- [x] Hide side product photos on the first gallery photo only and restore vertical side stacks across rooms.
- [x] Add vertical breathing room between gallery side photos and keep both columns inset between their boundary lines.

- [x] Collaborative Procurement Board: studio matrix/client editorial toggle, invites with email, guest feedback, contractor sign-up referral.
- [x] Expand project navigation into boards, folders, tearsheets, and Project Studio; show linked project breadcrumbs at the top of the workspace; open the latest linked board from project cards and names.

## Move built-in catalogue to database (approved: lists + tier fallback)
- [x] Tier percentages load only from the database (no bundled 10/15/20% fallback)
- [x] Collectibles (collectibleGate, useCollectibleOverrides, CollectiblesHoverHero, PublicCollectibles, TradeCollectiblesAdmin) → designers/designer_curator_picks
- [ ] ProductGrid, tradeProducts, curatorPicksCatalog, designerProfiles → database catalogue
- [ ] BrandsAteliers atelierOnlyPicks → database
- [ ] Delete bundled arrays in FeaturedDesigners / Collectibles / BrandsAteliers (~500 KB) after page-by-page live checks
- [x] Show OOL Shelf suede leather samples under Drawer Finish on desktop and mobile, without changing their shared material category.
- [x] Separate OOL 77 Mini bar finishes into frame (Cement Stuc/Glossy Lacquer), shelf (Wood), and drawer (Wood/Suède leather) across public and trade views.
- [x] Group product finishes by variant matrix values (name, colourway prefix, generic "Wood"): OOL Night table shows only Frame + Drawer Finish on public and trade.
- [x] OOL 77 Mini bar: curated preset combinations (4 one-tap chips) + reduced to Frame + Drawer dropdowns only (Shelf auto-committed); regression test added (FinishSelector.ool-minibar.test.tsx).

- [x] Felix tour Steps 4–5: Client Project Folders (Projects & Interventions sidebar, Singapore GCB copy) and Real-Time Tier Tracking (new dashboard Tier Volume Tracker widget); Back/NEXT verified live.
- [x] Add walkthrough pause/resume, timeline seeking, speed selection; browser pause/seek/resume/replay/stop verified, six tests pass.
- [x] Camera-path sync history filters: All / Failed / Successful toggle with per-filter counts; active filter marked aria-pressed; verified live (2 failed, 4 successful).

- [x] Add side-by-side shared camera route comparison; four diagrams and durations, explicit selection, Escape dismissal, screenshot and clean build verified live.

- [x] Implement approved-applicant one-time activation links, secure password setup, profile reuse, and retry states; 27 tests and live invalid-link checks pass.
- [ ] Verify a real applicant email-to-password-to-sign-in journey; activation page publication verified, but still needs a controlled recipient and activation email (none sent during testing).
- [x] Room piece side-by-side comparison (LayoutPieceCompare): compare checkboxes on curated pieces, Compare selected button, manufacturer/dimensions/RRP/tier trade price; verified live (Silver -10%: €7,443.00 / €7,649.10), no page errors.
