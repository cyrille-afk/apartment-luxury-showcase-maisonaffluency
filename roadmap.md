# Roadmap — Automatic Visual Search Indexing

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
