# Roadmap — Automatic Visual Search Indexing

## Quote review before client sending
- [ ] Add a selected-piece, quantity and trade-price review step using the editor's existing calculations and client-send checks.
- [ ] Verify the review on a saved quote and run focused tests.

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
