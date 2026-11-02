# Roadmap

## Quote and guest-payment link analytics
- [ ] Track successful link copies and existing email sends without recipient data or link tokens.
- [ ] Verify both link types' native visit analytics, event schemas and success/failure behavior; identify any missing send flow.

## Product sidebar cleanup
- [x] Keep one price/quantity/checkout area after configuration and specifications; group utilities at its base.
- [x] Signed-in Jules & Jim verified one price stack, no sidebar-local toggles, quantity round-trip, Light Solid Oak sample selection and global Studio → Client → Studio. Client removes the transaction sidebar and net prices; 16 regressions pass, preview build OK. GitHub sync required.

## Approved studio password setup
- [x] Approved studios show Resend password-setup email and stored setup/link status; Juliana’s review composer verified without sending or changing her approval.
- [x] 24 regression tests pass and preview build OK. Disposable email verification → password setup → automatic approved-account link confirmed in saved records and signed-in Studio Settings; test account removed. Juliana remains unlinked until she activates; her email was not resent during testing.

## Inquiry reply button
- [x] Both Reply actions open an in-app composer; signed-in cancel/reopen restores the draft and saved history shows the exact reply and Sent status.
- [x] Existing admin-checked branded sender derives recipients from saved inquiries; real test reply and both staff copies have sent records. Invalid authentication rejected, 12 tests pass, startup/live checks pass, preview build OK; removed only the test inquiry.

## Google-access inquiry alerts
- [x] Add distinct Twilio WhatsApp notifications using existing staff recipients without creating applications or granting access.
- [x] Six tests pass; deployed service starts and a real authenticated request saves successfully. Three Twilio sends were accepted then rejected with 63016 (outside the reply window); per-recipient callbacks recorded failures.
- [ ] WhatsApp must approve the submitted Google-access utility template before out-of-window delivery works; approval is pending. No automatic replay of failed sends.

## Trade card baseline
- [x] Suppress repeated studio credits for studio filters/searches, lock names and prices beneath images, and reserve hover metadata below.
- [x] Signed-in Jules & Jim verified: no repeated studio label, recorded specs fade in, identical baseline positions before/after hover in three/four columns; phone has no page overflow. Five rule tests pass, preview build OK. Narrow cards truncate long names/prices to retain the requested single-line baseline.

## Directory analytics
- [x] Compare named designers' conversion and selection share for all/refined searched openings; 10 counting tests pass. Signed-in saved preview activity verifies Amélie Vermersch 2/2 all searches and 1/1 refined; period/device filters and published empty state checked, no browser errors.
- [x] Added Search refinements view with named selections, expandable sequences, catalogue matches and filters; real seven-edit search → Amélie Vermersch → signed-in dashboard verified 1/1 (100%), recorder responses successful and no browser errors; 13 counting/filter tests pass. Published tracking awaits publication; prior refinements remain unknown.
- [x] Catalogue-only search matches, refinement categories and selected designer events added; ten unit tests and eleven schemas pass. Python browser verifies seven refinements → Amélie Vermersch profile with no raw text. Project browser suite blocked by missing Chromium; dashboard breakdown unchanged, published collection awaits publication.
- [x] Search-to-profile conversion, daily outcomes and named destinations verified through real Amelie search → Amélie Vermersch profile → dashboard (1/1, 100% preview); four counting tests pass, build OK. Historical links remain unknown; live tracking requires publication.
- [x] Named designer ranking, last-viewed time and selectable daily trends verified signed-in against stored Michel Amar Studio views (2 published / 4 preview); period/device filters work and three counting tests pass, preview build OK.
- [x] Signed-in Directory Activity verified: real search/initial/dismiss/profile activity reads back, 2/2 matched openings show 100%, filters work; five tests pass, anonymous reads/aggregate execution revoked, nine existing event schemas valid. Published tracking requires publication; new operational feed preserves injected events and separates preview.
- [x] Track search edits, A–Z choices and dismissal reasons without search text; designer profile views use existing page-view analytics (verified published data), not duplicate click-based views.
- [x] Three new event schemas registered (nine total), compatibility validation passes; real desktop flow asserts result counts, A/C, all three dismissal reasons, no duplicate dismissal and no raw text. Browser regression and three filter tests pass; preview build OK. Published collection awaits publication.

## Visual directory overlay
- [x] Filter the four-column matrix live, make the full A–Z ribbon select initial-only results with an underline, and dismiss instantly outside or on Escape.
- [x] Signed-in loaded directory verified: Amelie returns one card; A/C return only matching initials, letters remain usable after no results, and Escape/outside clicks unmount instantly. Three unit tests pass; preview build OK. GitHub sync required.

## Minimal gallery utility capsules
- [x] Share pure black/white capsule styling, spacious icon padding and a centered flex row without an enclosing grid frame.
- [x] Public and signed-in Trade Presentation verified open → closed: both capsules 36px with 8px/16px padding and 15px icons; all centerlines 528.5px, left panel/trigger 307px, right grid/capsule 1639px. Three regression tests pass; preview build OK. GitHub sync required.

## Profile grid alignment and capsule symmetry
- [x] Biography image, closed product grid and open filter panel share the same measured left edge (307px on the reference desktop).
- [x] Browser verified closed → open → closed: both capsules 36px high, open padding 8px and type 11px identical, heading/control centerlines identical; three layout tests pass and preview build OK. Signed-in Trade shared header checked.

## Catalogue listing footnote
- [x] Remove the full disclaimer above public and Trade grids; add a condensed guest-only bottom footnote and tighten filter spacing.
- [x] Guest Seating desktop/phone and public designers verified: bottom-only note, uniform 8px toolbar-to-grid gap. Signed-in category and loaded Trade directory omit the note; two visibility tests pass, preview build OK.

## Installed-app opening
- [x] Remove unnecessary no-token sign-in wait and initial homepage hydration mismatch; keep genuine QR sign-in protected. 29 startup regressions pass; preview build OK.
- [x] Verify unchanged headline position before/after startup on installed-style phone, browser phone and desktop; Collection opens and repeated launch has no sign-in splash.
- [ ] Live response latency remains 4–7 seconds before the document arrives; hosting diagnostics are unavailable. Findings sent to the platform team. Preview corrections require publication and GitHub sync; actual installed iOS launch remains unverified.

## Collection title alignment
- [x] FILTERS aligns to the collection grid's left edge; the independent Curators' Picks title is centered between edge controls. Browser measurements verified identical control/title centerlines closed → open → closed, unchanged 3 → 4 → 3 density; three regression tests pass, preview build OK.

## Filter grid transformation
- [x] Keep the FILTERS trigger aligned with density controls; animate four columns open / three closed on designer and collection grids.
- [x] Michel Amar and Living verified 3 → 4 → 3; trigger/control heights and top positions match exactly, cards/images retain identity, mobile sheet works without overflow; eight tests pass and preview build OK.

## Trade folder quick save
- [x] Simplify the popover to three recent boards and project actions; preserve full names and add the advanced right drawer.
- [x] Signed-in Jules & Jim saved to an existing board and read membership back on reopen; View All opens the full-height drawer, search filters boards and New Project Folder opens creation. Recent-board regression passes; preview build OK.

## Product navigation scroll
- [x] Remove premature router-resolution/global resets; signed-in Puzzle picture click keeps every gallery frame at 855px, product opens at top, and Back restores 855px; ten navigation regressions pass, preview build OK.

## GitHub Actions failures
- [x] Trace activation/checkout startup crashes and six unit failures from actual GitHub job logs.
- [x] Explicitly enable runtime compatibility; the exact pinned-date/node:fs runtime probe passed. Full application startup awaits the new GitHub run.
- [x] Update stale test mocks/hydration waits; all 2,132 unit tests pass (nine existing skips), preview build OK.
- [ ] Confirm activation/checkout checks after corrected code reaches GitHub; current runs still use the prior Helios commit, so repository sync is required.

## Stripe signature alerts
- [x] Exclude cryptographically proven deliberately corrupted daily smoke notices from existing alerts, retaining audit records.
- [x] Alert on unexpected signature rejections through the existing watchdog; 14 tests and both startup checks pass. Live known-test rejection produced no alert; unexpected rejection sent email; repeat invocation was throttled.

## Active quote hand-off
- [x] Pass the active saved quote ID to Open Quote Builder and distinguish line items from unit quantities without changing saved quantities.
- [x] Signed-in verification: QU-E3CCD6 contains one Saint Honoré Sofa line with quantity seven; its drawer link opens that exact saved quote, with quantity unchanged. Three drawer regressions pass; build OK.

## Order drawer finish pictures
- [x] Show the same selected cropped finish samples as Co-Pilot; signed-in Saint Honoré verified loaded Teddy Mohair/Solid Oak samples in single-item and multi-item drawers, with 29 checkout/pricing/persistence regressions passing.

## Drawer monitoring findings
- [x] Prevent order-drawer checkout from adding an already configured cart line again; signed-in quantity 1 → 3 stayed 3 after checkout hand-off.
- [x] Restore authoritative retail for saved configured quote lines; saved Saint Honoré 280 showed €22,600 in Presentation without net rows. Legacy ambiguous size labels remain Price upon Request rather than guessing.
- [x] Verify signed-in drawer flows and 34 passing regressions; resolve both confirmed monitoring findings.

## Presentation price protection
- [x] Align Presentation retail labels and typography across product prices and drawer summaries; signed-in ON/OFF verified four synchronized blocks with matching computed type/color, phone fit, unchanged URL, and 15 passing regressions.
- [x] Persist mode across product pages, drawer remounts and app reloads/resume; signed-in browser verified ON/OFF across two products and reloads, with drawer remount/resume covered by tests (13 regressions pass).
- [x] Add synchronized Presentation Mode controls beside product prices and at drawer headers.
- [x] Show retail-only client prices and omit trade values from presentation tearsheets and copied previews; unknown quote retail is Price upon Request, never relabelled net.
- [x] Verify live toggle round-trip and actual presentation print/PDF, including a presentation link opened with shared mode off; 20 regression tests pass.

## Trade order workspace
- [x] Align both restored drawers with active finishes and retail/net breakdown; signed-in Saint Honoré verified Teddy Mohair/Solid Oak, €20,500 retail/€18,450 net, and ON/OFF removes/restores net without closing or redirecting; 24 tests pass.
- [x] Handle unavailable-purchase 409 inline without throwing, preserve selections and offer an enquiry; exact response verified in signed-in checkout with no blank screen or provider-update errors.
- [x] Restore product-page order/workspace drawers without role selection or cart redirection; both Saint Honoré buttons verified signed in, with unchanged product URL and active details; 18 regression tests pass.
- [x] Bypass public onboarding for authenticated Trade Studio orders using the professional session and existing checkout flow.
- [x] Verify signed-in Saint Honoré order opens its configured basket with professional identity, no onboarding or browser errors; 11 tests cover Trade mobile/desktop and retained Public/Presentation intake.

## Admin price history
- [x] Persist editor save attempts in admin-only database records; verified failed/confirmed writes across independent sessions, atomic saved status and nine access checks without changing prices.
- [x] Add saved price history from the existing admin-only audit log, including variant changes.
- [x] Show current-session pending, failed and unconfirmed editor saves separately from confirmed history.
- [x] Verify price differences, admin access and the history view with real saved records.

## Technical SEO findings
- [x] Bound product titles and descriptions consistently in server and client metadata.
- [x] Add 44 canonical category/subcategory pages and public sign-in to the sitemap; preserve record-specific lastmod and abort incomplete reads.
- [x] Verify www domains, social previews, crawler rules, single static-page titles, product pages and metadata; 20 regression tests pass.
- [x] Leave the collectible-design article suggestion unchanged (technical SEO only).
- [ ] Sitemap scanner verdict: remaining requests to index password recovery and retired registration are intentionally not implemented; recovery is noindex, registration redirects to the application page.

## Rename Pouenat -> Maison Pouenat (everywhere the brand is shown)

- [x] Database: guarded rename across designer profiles, parent-house labels, product
      listings, material library, downloadable catalogues, concierge designer list,
      product photo records, journal articles (founder "Henri Pouenat", web addresses,
      image filenames and page addresses untouched)
- [x] Static brand lists in `src/data/brandCategories.json`
- [x] Hardcoded homepage/atelier copy in `BrandsAteliers.tsx`, `FeaturedDesigners.tsx`
- [x] `DesignersHoverHero.tsx` founder-suffix suppression set
- [x] Admin/placeholder examples: `TradeDocumentsAdmin.tsx`, `TradeAdminSuppliers.tsx`,
      `StudioMemoryCard.tsx`
- [x] Assistant/tool descriptions: `src/lib/mcp/index.ts`, `src/lib/mcp/tools/search-curator-picks.ts`
- [x] `src/lib/brandNormalization.ts`: legacy "Pouenat" -> "Maison Pouenat" alias
- [x] Unit-test fixtures (`designerHierarchy`, `editionLabel`, `comparatorEditionLabel`)
- [x] Regenerate build outputs from the database: designers index, featured designers,
      catalogue manifest (the link-preview generator would also create 256 unrelated
      pages, so the 12 Pouenat link-previews were edited in place instead)
- [x] Hand-edited link-preview pages: `public/ateliers/pouenat-og*.html`,
      `public/journal/pouenat-ad-collector-ad100-design-2025-og.html`,
      `public/share/og/pouenat-*-og.html`
- [x] Concierge roster files + redeploy the concierge and MCP functions (4 deployed,
      178/178 functions reported started; the pre-deploy boot check fails sandbox-wide
      on a missing package cache, for ~60 functions I never touched)
- [x] Verify: designer directory, product page credit, comparator grouping, trade filter
      chips, search facets, link-preview titles, unit tests, build

## Waiting on the user

- [ ] Publish the preview so the renamed listings, directory and catalogue files go live
      (designer profile pages already read the database live).
- [ ] Sync the project to GitHub — the rename is not in the repository yet.
- [ ] Publish the technical SEO corrections; the live website still serves the previous page tags and sitemap.
