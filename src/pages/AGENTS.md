# Page rules

- Admin inquiry inbox search (`src/pages/TradeAdminInquiries.tsx`) applies each typed term as a server-side or-group built by `src/lib/inquirySearch.ts`, so a match older than the newest fetched page stays findable; the same predicate filters client-side as a final guard so the list and the match count can't disagree.
