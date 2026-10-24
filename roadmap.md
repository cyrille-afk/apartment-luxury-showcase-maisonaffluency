# Roadmap — Automatic Visual Search Indexing

- [x] Add minimum visual-match and maximum result controls; verified default 8, expanded 12, 100% empty state and 74% filtered results against a real uploaded room photo; five tests pass.

- [x] Existing real Visual Search, catalogue backfill and distinct-room checks completed.
- [x] Add durable image-change queue, secure event wake, leases and bounded retry recovery.
- [x] Share the image embedding request between search and automatic processing; expose paused status and explicit recovery.
- [x] Verify replacement enqueue, persisted vectors, private callback rejection, queue drain and 15 failure/duplicate tests. Restore the test photo; all 764 images remain indexed.
- [ ] Publish the new server route to activate unattended production callbacks; the database currently queues safely, but published callback delivery cannot be verified before publishing.
