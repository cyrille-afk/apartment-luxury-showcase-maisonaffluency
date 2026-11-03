# Roadmap

## Directory viewport and search shield
- [ ] Restore the desktop bottom preview and shield the search/caption from the animated line; verify viewport geometry and live search without changing mobile/standalone sizing.

## Helios Coffee Table finishes
- [x] Uploaded all five supplied originals to Cloudinary and updated Helios’s existing samples without changing prices; isolated shared stone links so other products remain unchanged. Public sample readback and signed-in product chooser verified all five images loaded and opened; build OK.

## Global header navigation
- [x] Account-only absolute anchor verified on Home, Designers and Gallery at 1946px: right edges match exactly, gap is 4px, no category overlap or native tooltip; sans text, menu travel, Escape and Log In dialog work; build OK.
- [x] Browser verified full-strength white dark-header rows, logo and icons at rest/hover, exact 14px italic sentence-case Trade prompt without PRO, readable Trade menu and unchanged light Gallery header; build OK. GitHub sync required.
- [x] Designer landing uses dark glass (20/20/20 at 70%, 12px blur), including hover/menu states; Gallery stays light. Browser verified readable dropdowns and exact 14px italic natural-case prompt without PRO; build OK.
- [x] Fixed Trade entry at 14px; browser verified its menu directly beneath the top-row trigger with an exact 8px gap at 800/1280/1946px, hover travel, Join destination, and build OK.
- [x] Restored exact natural-case Trade prompts; homepage browser confirms italic header with text-transform none, natural-case banner, preserved pill/action, and build OK.
- [x] Search/Cart now use real destination links; Search has a working catalogue field. Browser verified Jules results, empty Cart signed-in/out, editorial destinations, six collection menus, Living/Floor Lights destinations, Account login and Trade application. Saved JS browser regressions could not launch (missing bundled Chromium); Python Chromium checks passed. Nonempty basket checkout unchanged, not exercised.
- [x] Verified solid white/dark-ink headers on Gallery, Designers and Journal; homepage retains frosted overlay. Gallery secondary menu starts 98px below the main header; preview build OK.
- [x] Replace shared public site header variants with one three-row overlay; Trade Client Editorial Presentation reuses it while Studio workspace controls stay intact. Preserve Trade, account, search, cart and collection menus.
- [x] Verified home, Designers/profile, Gallery, Journal and Trade Program rows and Trade/Living menus; Account and Search navigation, directory dialog and signed-in Studio → Presentation → Studio pass. 320/390/768px fit/menu checks pass; three navigation regressions pass, preview build OK. Sync and publication required.

## Expired activation links
- [x] Show expired/used/missing activation links with the user-confirmed 24-hour validity and a fresh password-setup request; activation session expiry uses the same screen.
- [x] Reuse existing approval delivery/token replacement after same-host Turnstile verification; 17 regressions pass, preview build OK. Browser verified rejected and missing links, 24-hour explanation and security-proof submission guard. New request emails highlight 24 hours.
- [ ] Verify complete real recipient request → email → activation after publication: production bot proof cannot be minted on localhost; no customer email was sent during verification.

## Homepage overlay header
- [x] Apply the homepage-only two-row frosted overlay; retain shared menu handlers and Trade PRO, move Gallery left and add Search right.
- [x] Desktop glass/solid hover, Living menu and Search verified; fresh phone visit opens menu without overflow. Two navigation tests pass; build OK. GitHub sync and publication required for live visual update.

## SEO failing findings review
- [x] Fresh foundations scan: all eight checks pass, including sitemap; verified published www host, 44 category pages, sign-in entry and page-specific lastmod sources. Four sitemap tests pass; no code correction needed.
- [x] Saved “Collectible Design: A Guide to Informed Collecting” through the journal editor as an unpublished draft: 956 words, Getty/e15/Christie's/RICS citations, authentic Alexander Lamont cover and internal links; US keyword/SERP research completed. Admin preview verified desktop/phone, no overflow; anonymous access remains hidden. Content finding stays open until publication.

## Inline quote recipient
- [x] Add a saved recipient email beside quote sharing; Share saves it first, invalid or failed saves block sharing, and unrelated billing details and address-book contacts are preserved.
- [x] 58 regressions pass, preview build OK. Signed-in sharing control verified against a disposable real quote: email saved, billing retained, share recipient and canonical copied link confirmed without navigation; records cleaned up. Actual drawer mount verification unavailable in isolated test context; control desktop/phone rendering checked.

## Quote sharing feedback
- [x] Sharing control tested signed in against the latest saved Angelo quote: server rejects sharing until the client email is saved; inline message remains visible. Nine regressions pass, build OK. Original drawer placement was not reproduced; control verified separately against real data without changing the quote.

## Password-setup resend security
- [x] Fresh setup emails replace native recovery tokens; corrected-recipient issuance and retries also invalidate original signup-address tokens without changing approval or rotating the latest queued link.
- [x] Live disposable verification rejected both older same-address and old-address links and verified the latest link; test records cleaned up. Eight helper and four page regressions pass; deployed services boot/live checks pass. Pola’s previous-address access repaired via the original attempt key without sending another email or replacing her latest link.

## Names-only private quote addresses
- [x] Newly copied quote addresses use persisted maker/product names with readable word suffixes for collisions; clients verify saved email before access. Legacy links preserved; old links do not silently change.
- [x] Added locked recipient-bound OTP/session RPCs and HttpOnly cookies; 25 regressions pass, clean gate rejects unknown recipients, legacy supplied link loads, build OK. Existing private-client email template/delivery reused.
- [ ] Complete real recipient email → code → quote verification: supplied quote has no saved client, billing email or source inquiry; no client code was sent or recipient invented. Save its client email, then create a new share. Publication also required.

## Quote-open engagement dashboard
- [ ] Show private daily aggregate Quote opens without names, quote identifiers or tokens. Blocked: the existing analytics stream has no verified app-readable aggregate connection; temporary agent query credentials cannot be embedded in the app. A dated snapshot is possible but is not live tracking.
- [x] User chose a dated aggregate report: published query for 26 October–2 November records zero Quote opens; report explicitly treats collection as unconfirmed, not zero engagement. Light/dark/mobile checked; standalone HTML delivered without names or tokens.

## Aggregate quote opens
- [x] Count successful client-side shared quote reads as Quote opens with empty event properties; exclude unavailable, failed, abandoned and crawler-only requests.
- [x] Schema validates (14 events); six open/privacy regressions and five link tests pass. Real shared quote browser navigation emitted exactly project.quote_opened with {} and build OK. Published collection requires publication; automatic platform page-view telemetry is unchanged.

## Quote product specifications
- [x] Add compact dimensions, materials, selected finish and finish options from the saved share snapshot, retaining older links and retail-only pricing.
- [x] Snapshot/privacy/analytics tests pass (16); real older Angelo quote renders specifications on desktop/mobile with no overflow or runtime errors and build OK. Old snapshots retain recorded dimensions and show missing new fields as Not specified; newly copied shares include recorded materials and finish options. A new-share end-to-end creation was not exercised.

## Branded client quote pages
- [x] Refine Maison Affluency branding, product imagery, maker credits and configuration details without changing client-safe prices or access.
- [x] Existing shared Angelo quote verified on desktop and mobile: authentic image loads, no overflow/runtime errors, branded unavailable state; six quote privacy/identity tests pass and preview build OK.

## Readable quote links and previews
- [x] Newly copied quote links include recorded maker/product names with unchanged secure tokens; old links remain valid.
- [x] Supplied QU-42891A verified on legacy/named URLs: SSR preview says Angelo M/H High Table by Alinea, client summary loads, invalid token shows unavailable. Authentic letterboxed JPEG is 1200×630 / 20KB; 59 tests pass, build OK. Live addresses/previews await publication.

## Quote and guest-payment link analytics
- [x] Track successful quote/guest-payment copies and confirmed existing guest-payment email sends, without recipients or tokens; failures do not emit.
- [x] Native /quote/ and /pay/ page views count visits without duplicate events; last-seven-day published query currently returns no visits. Two new schemas validate (13 total), 54 tests pass and preview build OK. Quote sharing is copy-only: external WhatsApp/email sends are not observable. Signed-in workspace inspected, but real copy/send end-to-end was not completed (current projectless quote has no Share control; no customer email sent).

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
