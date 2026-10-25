## Specification differences
- [x] Added subtle neutral tints on differing populated specification cells; empty slots, matching categories and equivalent material lists stay plain, pricing unchanged. Four live products verified (16 differing cells, zero matching-category/price differences), no browser errors, 21 tests pass and preview clean.

## Reopen saved comparisons
- [x] Added searchable Saved comparisons chooser across owner projects; Restore reopens the saved project/name/ordered selections and can explicitly reset local edits. Signed-in temporary Singapore two-piece comparison saved, restored after leaving, re-restored after removal and deleted; no browser errors, 17 tests pass, preview clean.

## Comparator table presentation
- [x] Extracted the comparison table with large 4:5 neutral image blocks, centered above-card remove controls, bold muted left-aligned labels, stacked materials and tinted bold Trade Price. Four live pieces verified at 1946px and mobile with all images loaded, no page overflow/errors, refresh/removal preserved; 15 regressions pass, preview clean. Not published; GitHub sync needed.

## Comparator refresh persistence
- [x] Preserve selected pieces and in-progress comparator controls across refresh with account-scoped price-free local drafts; live refresh retained Dais, Favorites and the unfinished name on Cyrille's account, removal stayed removed after a second refresh. No cloud shortlist created; 15 tests passed and preview build clean.

## Product comparator feedback
- [x] Include recorded parent houses alongside child designers; Ecart and CC-Tapis verified. Favorites now load saved product records directly; both of Cyrille's two Favorites shown.
- [x] Assign/save under accessible projects and reopen from project Boards; live Singapore project save and saved two-piece reload verified, temporary shortlist removed.
- [x] Export pictures and recorded variant materials/deduplicated metric+imperial sizes; inspected two-picture PDF and full material/size text, 10 tests passed, clean preview; not published, GitHub sync needed.

## Expired tearsheet invitations
- [x] Add per-board expired-invitation resend in status cards and sharing controls; live-tested on Cyrille's Singapore board, restored view-only access for 30 days and refreshed viewer count, email queued (delivery not confirmed). Revoked/current/wrong-project/signed-out attempts denied, 12 focused tests passed, test invitations removed; not published.

## Tearsheet invitation status
- [x] Show invited viewers, permissions, expiry and last-viewed status for every project board; signed-in Singapore project verified against saved invitations (one unique current viewer, revoked history, two uninvited boards), refresh and sharing controls checked with no browser errors; 14 focused tests pass.

## Project tearsheet sharing
- [x] Add project-scoped board invitations for architects and interior designers; live-verified invitation creation on Cyrille's account, guest board rendering without approval controls, denied feedback/cross-project requests, revoked-link rejection and test cleanup; three focused tests pass.

## Project-first tearsheets
- [x] Require choosing or creating a project before working on tearsheets; boards persist under that project, unrelated boards excluded. Verified project creation, Ondas board save, persisted project/item read-back and test cleanup on Cyrille's account; two rule tests pass, preview build clean.

## Curated Room Layout loading and freeze report
- [x] Add page/catalogue/generation/curation loading states and coordinate competing actions; signed-in catalogue and generation indicators captured, five placement tests pass.
- [x] Stop idle canvas rendering while retaining continuous rendering during walkthrough playback and dragging.
- [ ] Resolve post-generation stall: twice reproduced screenshot timeouts after real room generation, including a 90-second timeout; complete room rendering and walkthrough remain unverified. Further model/render profiling is needed, not user input.

## Brief submission and stalled concierge replies
- [x] Keep missing-detail errors visible beside Submit Brief; validate live fields and stop blank lines consuming following labels. Signed-in incomplete submission verified after 5.5 seconds with no page errors.
- [x] Re-arm inactivity protection on transport heartbeats; failed/aborted brief streams cannot mark onboarding complete. Recovery copy now describes an incomplete answer rather than invented spatial work.
- [ ] Verify the user’s complete original brief and refinement end-to-end; original brief/thread not supplied. Backend logs available only for latest test request, so exact screenshot failure remains unconfirmed.

# Roadmap — Automatic Visual Search Indexing

## Concierge pending reply
- [x] Show “Working on your question…” with a quiet spinner while awaiting text, including empty assistant placeholders, in embedded and floating conversations. Signed-in real question verified: waiting message visible, removed on reply, no page errors; build clean.

## Sign-in modal feedback and password reveal
- [x] Added modal password reveal, inline pending/error/success states and Google-password guidance. Twelve focused tests pass; live eye toggle, pending lock and real credential rejection verified with no page errors. Build clean; no password changed.

## Sign-in feedback
- [x] Add inline credential loading, confirmed-success and actionable errors; coordinate disabled sign-in controls and match Google feedback to the same restrained styling.
- [x] Live verified delayed real credential request, disabled competing controls, actionable rejection, retained input and retry with no page errors; eight focused tests pass, including confirmed-success locking. Successful credential login was not exercised; no account password changed. Build clean.

## Homepage logo return
- [x] Limit the hidden homepage guard to initial loading and reconcile already-loaded styles on client-side return.
- [x] Verify sign-in logo and close return, direct homepage and repeated visits on desktop/mobile; stylesheet handoff regressions pass. Confirm only one headline remains after hydration.

## Sign-in return address stacking
- [x] Stop the outgoing Trade layout from redirecting the incoming sign-in page, normalize query separators and repair existing nested return links.
- [x] Live verified six direct/protected/nested/truncated/trailing-slash/filter cases, all stable after reload with the sign-in form visible and no page errors; focused return-address/navigation/password regressions pass and build clean.

## Website SMS alerts
- [x] Verify Twilio sender and deliver one test SMS to the requested recipient.
- [x] Add private unique outage/recovery events and single-use callback tokens alongside existing emails; six focused tests pass, missing/invalid tokens return 401, build clean. Twilio test confirmed delivered. Dispatch configured; pending events wait for published callback.
- [ ] Activate published callback and verify an automatic alert; requires publishing the new route.

## Public website status
- [x] Add public availability and observed interruption history from the existing independent monitor, with stale/failed-read states and private diagnostics excluded.
- [x] Verified signed-out /status, all four live readings, refresh, mobile layout, anonymous safe reads/private empty reads and three availability tests; build clean. History starts 25 October; no fabricated outage or live monitoring failure was introduced. Publish remains user-controlled.

## Trade Program sign-in password reveal
- [x] Add a show/hide toggle to the Trade Program sign-in password field so the member can check what they typed before submitting; the field still starts empty and hidden.
- [x] Live verified on /trade/login: field starts type=password and empty, revealing shows the exact characters (type=text) and hiding restores the mask with the value intact, the toggle never submits the form and tab still moves straight to Sign In; three component tests pass and the build is clean.

## Sign-in modal premium redesign
- [x] Put the credential form first, a plain "or" separator below it, Google last as an alternative, the muted internal-staff helper line under Google and one footer application link; remove Google's raw error wording everywhere.
- [x] Live verified on /spec-sheets/joseph-dirand: order email → password → Sign In → or → Google → helper → footer, 448px card, wrong password shows "We couldn’t sign you in…" with no raw auth message; /trade/login carries the same copy with one application link; five component tests pass and the build is clean.

## Sign-in lightbox rewrite
- [x] Put email and password first with padded bordered fields, move Google below an "Or sign in with" rule, and replace the dense Google disclaimer with the approved one-line note.
- [x] Live verified: field order (email 748px, password 843px, Google 1003px), 16px/12px input padding, one Trade application link, no request-access accordion in the lightbox, wrong password keeps the dialog open and shows "Login Failed — Invalid login credentials".


## Repeated redirect blank page
- [x] Reproduced an empty /public-piece page on immediate repeat navigation in a real TanStack router test before fixing the guard.
- [x] Scope deduplication to router/resolved visit and release settled attempts; all five redirect tests pass. Signed-in Ondas public-to-Trade visits both render, second in 0.78 seconds with no browser errors; current app build is clean.

## Reviewed quote client PDF export
- [x] Add a client-ready PDF download to quote review using the shared branded document and existing checks; export does not publish, email or change status.
- [x] Passed snapshot preparation, check-blocking and stale-document tests; downloaded QU-9F86D9 on Cyrille's Trade account (120,250 bytes, 3 A4 pages). Inspected all pages and confirmed SGD 13,314.93 subtotal / SGD 16,444.35 total match review, existing Draft marking preserved and no browser errors.

## Favorites product opening and registration password
- [x] Replace Favorites' legacy product overlay with the shared full product destination; live verified Ondas then Dais in Presentation, Ondas in Studio, Technical List navigation and browser Back, with no page errors.
- [ ] Identify the password-change screen referred to as step 6 and verify its save response; activation, reset and settings code all await the auth update and handle errors. Blocked on identifying the user's screen; no password changed.

## Quote review before client sending
- [x] Add a selected-piece, quantity and trade-price review step using the editor's existing calculations and client-send checks.
- [x] Verify review on a saved quote: one table, quantity 1, SGD 13,314.93 unit/subtotal and SGD 16,444.35 total match the editor; unapproved-client continuation stays blocked. All 24 focused tests passed; no client email sent.

## Studio creation access failure
- [x] Reproduce Gregoire's non-admin INSERT RETURNING failure; add creator-only studio read policy and verify creation plus automatic owner membership.

## Google Trade access requests
- [x] Add name/email submission through the existing validated inquiry handler, admin-visible storage and staff notifications; no account or approval changes.
- [x] Verify signed-in real submission, admin read-back, sent notification logs and six validation/recovery tests; remove test inquiry.
- [ ] Verify an unsigned visitor completes Turnstile and submits: the sandbox security widget did not provide a token. Guest submission stays disabled without verification.

- [x] Add minimum visual-match and maximum result controls; verified default 8, expanded 12, 100% empty state and 74% filtered results against a real uploaded room photo; five tests pass.

- [x] Existing real Visual Search, catalogue backfill and distinct-room checks completed.
- [x] Add durable image-change queue, secure event wake, leases and bounded retry recovery.
- [x] Share the image embedding request between search and automatic processing; expose paused status and explicit recovery.
- [x] Verify replacement enqueue, persisted vectors, private callback rejection, queue drain and 15 failure/duplicate tests. Restore the test photo; all 764 images remain indexed.
- [ ] Publish the new server route to activate unattended production callbacks; the database currently queues safely, but published callback delivery cannot be verified before publishing.

## Extension page download prompt
- [x] Complete Bangkok Option 3 schedule/quote verification: reference-scoped, per-piece matching now returns 6 pieces (2 bar stools, 2 side tables, 2 lounge chairs from Collection Particulière and Alinea) in both the FF&E schedule and quote preview, €40,459 RRP / €37,222 after 8%; live-verified in the preview, nothing approved.
- [x] Remove the plugin package download button from the ChatGPT Extension Integration page and drop the matching tour wording; verified signed-in as cyrille@maisonaffluency.com that the page now shows no download control.
- [ ] Decide whether the package file itself should stop being reachable at its web address (it still sits in the site's public files).

## Cyrille feedback doc (25 Oct)
- [ ] Quotes & Proformas: "operator does not exist: trade_tier = text" — not reproducible; awaiting account/site.
- [ ] Designers & Ateliers: another presentation style (awaiting direction).
- [x] Resources: alphabetical search.
- [x] Resources: price lists admin-only (database rule) + view-only viewer.
- [ ] Material Library: click image for higher-res view.
- [x] Mood Board Builder: save to project, PDF export, Client View.
- [ ] Mark-up & annotations: save, share, assign to project; Studio/Presentation View.

## Price list audit admin link
- [x] Add a "Price List Audit" link to the sidebar Admin group so the audit opens without typing its address.
- [x] Live verified signed-in as cyrille@maisonaffluency.com: link present with the correct address, click lands on /trade/admin/price-list-audit and the report renders (57/57 secured, 5 needing securing) with no page errors.

## Price-list content audit
- [x] Inventory all public objects regardless of names and inspect document/image contents with saved revision-keyed results; flag covers with possible prices, keep incomplete coverage explicit.
- [x] Verified signed-in Parsa cover (no prices detected) and unrelated-filename PDF (Mernoe price list detected, eight prices); saved results visible, anonymous inventory refused/results hidden, five focused tests passed. Full public-content scan remains explicitly incomplete and user-controlled.
