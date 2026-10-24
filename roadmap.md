# Roadmap — Automatic Visual Search Indexing

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
