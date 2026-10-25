# Page rules
- Room layout canvases render on demand while idle and continuously during playback or dragging; pending generation/curation stays visible in the room area and locks competing actions to prevent duplicate work.

- Sales Funnel delete controls pass the explicit source and UUID to the admin-authorized deletion RPC only after confirmation; real payment-linked records are protected and failed deletes remain open for retry — prevents deleting the wrong source or financial history.

- Admin inquiry inbox search (`src/pages/TradeAdminInquiries.tsx`) applies each typed term as a server-side or-group built by `src/lib/inquirySearch.ts`, so a match older than the newest fetched page stays findable; the same predicate filters client-side as a final guard so the list and the match count can't disagree.
