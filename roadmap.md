# Roadmap

## Move saved Studio pieces
- [x] Add Move on canvas and Specsheet with explicit saved-row/source choice when a piece belongs to multiple folders, destination selection and named confirmation; update the original row without changing configuration or quote-linked pieces.
- [x] Eleven regressions pass. Signed-in temporary piece moves source → target → source on desktop/phone; original ID, finish and notes retained, source empties, canvas/Specsheet labels refresh, target matrix and reload readback verified. Temporary records removed; no customer selections changed, page errors absent and build OK.

## Curation destination folder choice
- [x] Replace automatic + ADD with an active-project sub-folder picker and inline creation; save only after explicit destination choice, retain created folder on retry and confirm the exact folder name.
- [x] Twenty-four regressions pass. Signed-in desktop/phone show all three real project folders; opening/cancelling makes no writes and keeps Visual Studio open. Create & save verified named toast, refreshed canvas/specsheet and exact-folder matrix readback. Temporary folder/item removed, no page errors and build OK.

## Favorite Visual Studio pairings
- [x] Add private account-saved pairings per active piece, saved-only browsing and removal with existing category/finish filters; saved candidates remain available beyond the initial ranking cap without stored prices.
- [x] Eighteen regressions pass; signed-in Frenchmen → Aragon save, reload readback, other-piece isolation, saved-only revisit and removal persistence verified at 1955px/390px. Temporary favorite removed; no project pieces changed, page errors absent and build OK.

## Visual Studio curation filters
- [x] Add category and recorded-finish selectors over the ranked stream, combined filtering, result counts and clear/reset states. Fourteen regressions pass; signed-in Gingko category + brass narrows 8 to 1, clearing restores 8, switching to Madison resets filters, and phone brass returns 4 of 8 without customer writes or page errors.

## Visual Studio editorial curation
- [x] Remove thumbnail overlays and native description tooltips; replace visible percentages with editorial tags and descriptions based on typology, material relationships and unambiguous saved finishes. Eight finish/exclusion regressions pass; signed-in Frenchmen/Madison streams, pointer hover and Close verified without customer writes or browser errors. Build OK.

## Visual Studio recommendation accuracy
- [x] Deduplicate canonical product identities, exclude composed pieces, score complementary roles and recorded materials per active reference. Signed-in Frenchmen shows unique table/lighting pairings at 92–94%; switching to Madison changes to stone/brass seating, lighting and mirrors at 90–96%. Close returns to canvas; no browser errors or customer writes. Six scoring regressions pass; build OK.

## Project Studio sliding panels
- [x] Replaced AI sidebar with an accessible blurred product-preview/curation lightbox and large suggestion rows. Signed-in desktop/390px checks confirm loaded selected images, live eight-result curation, source changes updating preview, close/Escape returning to four columns, no dialog overflow or page errors; build OK. Existing add/view actions preserved; no project pieces added during verification.
- [x] Specsheet moved left, canvas right, AI drawer right with original widths; controls align exactly above the left close control. Signed-in 1955px and 390px checks confirm independent slides, three/four-column density, fixed right canvas edge on Specsheet collapse, all eight pieces retained, and no page errors; build OK.
- [x] Separate AI Co-Designer and Specsheet into independent sliding drawers with black close controls and persistent reopen actions; released space expands the canvas.
- [x] Signed-in real project verified: both drawers open independently, close/reopen preserves Frenchmen context, closing Specsheet expands canvas from 1019px to 1699px, and 390px controls fit with one drawer at a time; no browser errors and build OK.

## Shared procurement status and quote archive
- [x] Share persisted issuance state across Quote Builder, folder header and folder dashboard badges; keep the builder open after finalization.
- [x] Finalize atomically into procurement review and freeze line items, client identity and addresses, including administrator edits. Corrected pre-existing trigger ordering that blocked non-admin finalization without weakening caller-price checks.
- [x] Sixteen regressions pass; authenticated disposable finalization confirms identical saved quote/folder issuance and rejects client-name/address edits, quantity changes, line insertion and deletion. Temporary records removed, no customer document issued; build OK.
- [ ] Full live builder → parent dashboard interaction blocked: the requesting account renders “No studio yet”; shared-hook remount and saved backend readback verified instead.

## Quote sheet studio identity
- [x] Connect the exact quote folder's Client Portal Branding to the upper-right document identity, with studio-profile fallback and immediate branding-change events.
- [x] Add the no-logo Hide platform branding checkbox and editable company header with user+quote-scoped device persistence and fixed header tracks. Ten regressions pass; signed-in real quote verified with read-only simulated no-logo/custom SVG branding, instant toggle, unchanged dimensions, reload readback and 390px identity rendering; build OK. No customer records changed; generated PDFs/exports remain unchanged.

## Consistent product attribution
- [x] Unify catalogue, product pages, secure shared links and PDF credits using separate product/designer/house/edition presentation; preserve identities, links and prices.
- [x] Frenchmen and Madison public headings and edition badges verified visually; 34 attribution, retail-only sharing, feedback and PDF checks pass; build OK. No customer quotes or invitations created.
- [ ] Live authenticated folder/quote readback blocked: the requesting account opens “No studio yet”; public/shared snapshot and generated PDF regressions verified instead.

## Matrix finish requests and approved draft
- [x] Sync latest saved client finish requests into matrix descriptors and linked swatches, with a client-request marker; focus, saved-feedback events and visible-folder refresh keep history and rows together.
- [x] Compile approved items with exact configuration, source-line quantity and verified tier pricing into a review-only invoice outline; exclude pending/rejected items, wait for authoritative price/status reads and never auto-order. Explicit draft saving retains separate configured lines.
- [x] Eleven regressions pass and build OK. Signed-in Madison shows Onice Velluto Marble / Aged Brass with both real photos after reload; draft contains the two approved client-requested pieces, quantities 1 each and client subtotal €7,676 on desktop/390px. No client selections, notes, quotes or invoices created during verification; explicit draft-saving action was not exercised against customer data.

## Matrix feedback panel
- [x] Replace wide feedback cells with a highlighted message icon and full-height right Sheet; chronological client history includes reaction events and historical invitation senders, with private notes in a shaded bottom zone. Client View unmounts the private panel.
- [x] Signed-in real Madison history and sender verified; existing private note saved unchanged and read back on reopening, close/reopen and 390px full-height layout pass. Two submission regressions pass; build OK.

## Client-board feedback retention
- [x] Display saved recipient/role/board-scoped comment history and approval status; reload comments after sending and fix finish-request prefix parsing. Renewed invitations recover the same recipient's comments without restoring revoked access.
- [x] Real client board shows Madison's existing comment, finish proposal and Approved status, plus the earlier Frenchmen comment; reopening and 390px card verified. Three regressions pass, build OK; no selections changed and temporary verification session removed. Existing SSR document-is-not-defined warnings fall back to client rendering.

## Shared board invitation email
- [x] Add the saved folder's curated-piece count, client Review & Approve CTA, copyable full-link fallback and higher-contrast expiration notice; preserve view-only access wording.
- [x] Desktop/mobile render verified without overflow, expiration contrast 6.66:1; three invitation resend regressions and all three sender/preview boot/live checks pass. Deployed without sending invitations.

## Shared portfolio picture interaction
- [x] Shared-grid product pictures use the same selected-item panel action as 3D View, preserving token-scoped configuration and existing view-only restrictions.
- [x] Real guest portfolio: Frenchmen image and 3D View produce identical populated panels (Opera Delft / Nude Oak, €5,016, 10–16 weeks); Madison image opens its own details (€2,600). Finish regression passes and build OK; temporary invitation removed, no emails sent.

## Collaborator invitation email status
- [x] Show invitation-scoped latest email status beside each unique collaborator; preserve joined/viewed independently and refresh while the folder is open.
- [x] Real signed-in folder shows one joined collaborator badge with the latest Email sent status after reopening; wrong-folder read returns 403 and anonymous read 401. Sixteen regressions pass; no emails or invitations created.
- [ ] Confirmed delivered status awaits successful per-message delivery events, which the current email service does not expose; sent is never presented as delivered.

## Quote-linked project folder
- [x] Drawer client invitations transactionally link the saved quote to the selected project folder; exact configured products use unique source-line identities and later additions sync through database triggers, without copying quote prices or notes.
- [x] Current QU-46C952 linked to Man of Parts — curated edit: seven items appear immediately and survive reload; both original quote prices preserved. Disposable signed-in regression verifies two selections, retry safety, later additions and wrong-project rejection; 22 unit regressions pass. No invitation emails sent.

## Quote quantities and configured totals
- [x] Add saved drawer quantity controls; keep totals in sync and report failed saves. Signed-in disposable chair quantity 1→2→1 verified, with reload persistence; 34 regressions pass and build OK.
- [x] Persist the renderer's numeric configured net price and priced variant. Real Yoma €100,563.30 remains included after adding a chair and reload; verified current quote's missing Yoma price restored, total €110,595 with its two chairs unchanged.

## Preserve configured quote finishes
- [x] Save each product's selector-derived finish configuration on its own quote line, rather than only the active drawer preview.
- [x] Signed-in disposable real quote: Yoma's three finish names and crops survive adding Frenchmen Street Lounge Chair and a full reload; exact chair colourways no longer expand to sibling fabrics. Eleven regressions pass, build OK. Temporary quotes removed; the customer's previously blank Yoma line remains unchanged because its original selection was never saved.

## Quote drawer project label and unlinked finish crops
- [x] Name the default invitation project under Add Client to Project (or say none is linked); recover finish crops for lines saved against unlinked catalogue copies via a single exact-title match, showing the saved fabric family only.
- [x] Signed-in QU-B1F0A6 drawer shows "No project linked…" (and "Project: Singapore GCB workflow" when working in that project, with the modal preselected) plus the four Opera crops for Frenchmen Street Lounge Chair. 21 regressions pass. No invitations sent or records changed.

## Quote invitation project choices
- [x] Offer the same studio-scoped project choices as the Trade selector, retaining saved-quote/active-workspace precedence; project-scoped invitation folder reads include accessible studio folders instead of only personally owned boards.
- [x] Signed-in shared invitation verified with real Singapore/Hamptons choices, Singapore selected on the product page, Man of Parts selected inside its folder, and old folder cleared on project change. Twenty-one regressions pass; drawer click covered by provider tests, live shared modal opened through provider (saved drawer restoration could not be exercised). No invitations sent or records changed.

## Active-folder invitation default
- [x] Default the collaborator folder selection from the current workspace context; keep the placeholder without an active folder and preserve manual selection.
- [x] Seventeen invitation/workspace regressions pass, including delayed folder loading, no-context fallback, cross-project isolation and reopening. Live signed-in verification is blocked: the requesting account redirects to studio setup and cannot open the existing Singapore folder. No invitations sent or account data changed.

## Immediate invited-client folder state
- [x] Selected-folder and project primaryContact/collaborators update immediately on validated client submission; failed creation rolls back its own attempt, email delivery failures retain created invitations, and headers consume shared session state without reload. CRM contacts and authorization remain unchanged.
- [x] Twelve regressions pass; signed-in Singapore folder header visibly updates after shared-modal submission with simulated invitation/email responses (no records or emails created). Shared modal opened directly through its provider for this check; drawer click path remains covered by existing tests. Build OK.

## Contextual client workspace invitation
- [x] Drawer opens the Trade-owned shared collaborator modal, resolves the saved quote project (active workspace fallback), and preselects an unambiguous project folder with fixed Client read-only/comment/approve access; view-only tearsheet sharing is unchanged.
- [x] Signed-in Singapore GCB workflow drawer verified; 14 regressions pass and build OK. Temporary live invitation confirms client role with comments/approvals enabled, wrong-project rejection and no contractor editing; temporary folder/invite removed, no emails sent.

## Active quote workspace invitation
- [x] Replaced drawer-only recipient/share/revoke controls with a bordered Add Client to Project button and reused the collaborator dialog with saved project context and explicit project-board selection; full quote-editor sharing remains unchanged.
- [x] Signed-in real drawer opens Invite Collaborator; selecting an existing project board enables Send Invite. Unassigned quotes show a project-assignment blocker; no invitations sent or records changed. Six regressions pass; build OK.

## Trade Gallery direct product navigation
- [x] Removed the configuration popup; signed-in image, card-title and Configure & Quote clicks all open the same full product route with real finish selectors and no dialog. Navigation regression passes; build OK.

## Product card button cursors
- [x] Added cursor-pointer only to both card actions; signed-in browser verified pointer on each, with layout, styling and borders unchanged. Build OK.

## Product card split actions
- [x] Replaced gallery hover actions with Configure & Quote and Add to Moodboard; latest request replaces the embedded configuration modal with dedicated product-page navigation.
- [x] Verified configuration and saved-board readback; desktop/mobile checks passed. Product-navigation verification recorded above.

## Trade-wide navigation scrolling
- [x] Replace the remaining shared smooth reset on all Trade arrivals/departures; retain same-page position and Back restoration.
- [x] Signed-in Comparator → Tools → Quotes → Settings → Projects → Favorites → Tools checks show no animated resets; quote filter stays at its position. Forty-two scroll/history regressions pass; build OK. No customer records changed.

## Bulk-upload automatic dimensions
- [x] Restore automatic drop measurements with one remembered, explicit batch source unit, retain per-file overrides and filename/manual labels.
- [x] Signed-in real glTF fixtures verify existing/future multi-file sizing, remembered selection, per-file overrides and protected filename/manual labels on desktop/mobile; 29 regressions pass including converted OBJ upload-label checks. Build OK, no page errors; no customer model records changed.

## Independent product publishing
- [x] Each curator pick's Public / Trade Only control is authoritative even when its maker profile remains Trade Only; safe maker credits expose no private profile, and previously hidden products under Trade Only makers remain hidden.
- [x] New products default to Trade Only and the editor shows an explicit status. Nine visibility/cache regressions pass; signed-in Cloud Filigrane toggled Trade Only → public 404 → Public → restored product (HTTP 200 saves), with public category, safe metadata, live one-minute catalogue refresh and build verified.

## Bulk-upload dimension integrity
- [x] Confirm the live overwrite and remove source-unit inference; protect filename/manual labels and retain measured height.
- [x] Signed-in bulk-upload checks preserve filename W/D/H, retain unknown-unit Default, convert a 300 mm box to 30 cm with height, and protect manual labels through source/display changes. Thirty regressions pass, including the actual upload-handler label boundary without writing customer models.

## Admin option scrolling
- [x] Audit admin pages and shared editors: remaining glide comes from the shared PUSH/REPLACE navigation reset; admin option/filter changes already retain position.
- [x] Admin destinations and departures now land instantly; public navigation/history unchanged. Signed-in live checks clicked all 50 dashboard cards and six additional Admin Tools links: no smooth calls or intermediate glide frames. Designer/product/inquiry/finish filters and two view-tab switches stayed stationary; no records changed. Eighteen scroll regressions pass; build OK.

## Directory scroll line
- [x] Restore the desktop line below the live search/caption dock with light frost unchanged and section-aware white-to-black ink.
- [x] Live desktop checks confirm a 12px dock clearance, white-to-black transition at the section edge during scrolling, search/menu suppression and reduced-motion handling; 1024/768/390px visibility checked, twelve directory regressions pass, no page errors and build OK.

## Current GitHub mobile check failures
- [x] Read actual GitHub logs: six quote tests have a missing mock export, one dimensions test uses a retired comment, and phone navigation renders the desktop stack with undersized controls.
- [x] Complete unit suite: 2,278 passed, nine existing skips. All 20 PWA/accessibility checks pass locally; phone screenshot confirms only the mobile header renders. Visibility checks exclude hidden/offscreen controls; minimum target size and performance budgets remain unchanged. Build OK.
- [x] Inspect the saved production Lighthouse report: startup scripting dominates CPU; its largest task is 2,569ms attributed to removable, with 4,250ms script evaluation attributed to client. No unsupported image-preload diagnosis or speculative homepage rewrite.
- [ ] Confirm GitHub's next production run after these corrections; Lighthouse performance remains unresolved (latest prior run LCP 5926ms, TBT 5602ms, score 43/100). Production audit verification awaits the next GitHub build.

## Deployment pairing
- [x] Isolate generated assets by release, enforce non-cacheable HTML at the server, remove immutable caching for gallery page addresses, and stop mismatched client hydration with manual recovery.
- [x] Fifteen regressions pass; browser simulations verify matching startup, blocked mismatched hydration at 1946/390px, missing startup-file recovery, and successful manual reopening. HTML response no-store/CDN no-store headers verified; build OK. Published release paths await publishing.

## Stylesheet recovery
- [x] Add a pre-hydration failure/stall guard and an independent revisioned backup stylesheet sourced from the existing design tokens, without reload loops or normal-load backup requests.
- [x] Blocked primary CSS recovers on Home and Dining Room at 1946px and mobile at 390px; recovered Home→Search stays visible, normal loads request no backup asset. Ten regressions pass and build OK. Mobile has the same overlapping header in normal and recovery states (pre-existing, outside this styling-delivery task).

## Navigation backdrop
- [x] Share a full-viewport darkened blur beneath every active main dropdown, including New In, above floating page panels; clicking it dismisses all dropdown states and pending timers.
- [x] Verified all nine dropdowns on Home, Gallery and Designers at 1946/1024/1280px: exact full-viewport 12px blur/20% darkening, sharp clickable panels above the backdrop, outside-click dismissal, no page errors; ten navigation tests pass and build OK.

## Shared category source
- [x] Individual menus and All Categories share the exact sorted NAVIGATION_DATA arrays, including Bar Stools in Seating and Bedside Tables in Tables; complete seven-department coverage retained.
- [x] Eighteen regressions pass; browser confirms all six product lists match the directory, aligned image frames, Bedside Tables count 10 and loaded destination, preserved Bar Stools routing, image-free directory at 1946px/1024px with no overflow or page errors. Build OK.

## All Categories directory
- [x] Replace the room-preview state with a full-width white, four-column taxonomy directory, sorted subcategories and shared live counts; retain other menus.
- [x] Twelve focused tests pass; 1946px and 1024px browser checks confirm all seven departments, 37 sorted subcategory links/counts, no images or overflow, white/sans-serif contrast on Home and Designers, Bedside Tables navigation and unchanged By Rooms/Seating; final run has no page errors and build OK.

## Navigation warm-up
- [x] Menu catalogue/counts start on header mount; count menus share one cached pool, all product pools are memoized, and prepared room scenes warm their photos and alternatives before mounting.
- [x] Featured responsive assets preload before hover; selected cards render synchronously in 220px-aligned frames. Desktop and 1024px browser checks show all featured images already loaded and zero menu-time data requests; rotation, eleven unit tests and Seating analytics pass without page errors. Build OK.

## Complete catalogue menu rotation
- [x] Removed curated overrides and the 12-photo cap; full public subcategory pools use header-owned shuffle bags, exhausted before reshuffling without immediate repeats. Direct public reads paginate instead of truncating.
- [x] Nine tests pass, including 45-product coverage, deduplication, pool expansion and empty pools. Live 16 Sofa openings showed 16 unique photos; all six menus changed images at 1946px/1024px, kept 190px alignment and loaded photos. Collection navigation and Seating analytics (index 33) pass without runtime errors; build OK.

## Shared product navigation grids
- [x] Extracted productNavigation schema and ProductCategoryDropdown for Seating, Tables, Lighting, Rugs, Storage and Decor; By Rooms and All Categories retain their existing layouts.
- [x] Public subcategory image pools rotate per opening with responsive lazy loading; all six grids match the sidebar at 190px at 1946px/1024px. Images load, Coffee Tables navigation and Seating analytics pass; five unit tests pass and build OK. Hand-Woven Rugs, Bars, Cushions & Throws and Candle Holders retain their links/counts but have no matching public image cards; no substitutes invented.

## Seating analytics
- [x] Three registered events track actual opens (no already-open duplicates), sidebar clicks and featured-card hovers/clicks with subcategory/image index only. Browser regression confirms exact payloads, navigation and safe missing-runtime behavior; two rotation tests pass, 17 schemas validate and build OK. Published receipt awaits publication and real visitor interaction.

## Seating dropdown refinement
- [x] Sidebar and image grid both measure 190px; oversized panel reduced to 248px, verified at 1946px and 1280px without overflow.
- [x] All six curated images change across three openings, photographs load, Sofas opens its collection; two rotation tests pass, no browser errors and build OK.

## Directory viewport and search shield
- [x] Restored a 37.8px desktop bottom preview at 1946×1181 and 1280×1800; search/caption share a dark shield and the cue stays below it. Live Amelie search returns one result and Escape dismisses; mobile remains full-height, 20 directory tests pass and build OK.

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
