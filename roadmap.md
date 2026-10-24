# Roadmap — Automatic Visual Search Indexing

- [x] Existing real Visual Search, catalogue backfill and distinct-room checks completed.
- [ ] Add durable image-change queue, secure event wake, leases and bounded retry recovery.
- [ ] Share the image embedding request between search and automatic processing; expose paused status and explicit recovery.
- [ ] Verify new/replaced imagery, duplicate work and failure safeguards with tests and live requests.
- [ ] Production callbacks require publishing the new server route.
