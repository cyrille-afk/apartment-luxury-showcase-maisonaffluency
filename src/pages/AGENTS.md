# Page rules
- Comparator unfinished selections and controls persist in account/saved-shortlist-scoped local drafts; hydrate before writes and never reopen the cloud snapshot over a restored edit — refresh must preserve work without creating a cloud shortlist.
- Comparator shortlists use owner-private records with a project-edit-checked association; project Boards links reopen the saved comparison, and client snapshots remain price-free — project assignment must never broaden sharing access.
- Tearsheets require an accessible selected project, scope board reads and recheck board ownership before item writes; board creation persists project_id and retains successful board identity on retries — prevents standalone and cross-project saves.
- Tearsheet sharing reuses email-verified board invitations with a database-enforced view_only flag and project-scoped creation; revocation invalidates guest sessions through their parent invitation — collaborators cannot edit or approve selections.
- Room layout canvases render on demand while idle and continuously during playback or dragging; pending generation/curation stays visible in the room area and locks competing actions to prevent duplicate work.

- Sales Funnel delete controls pass the explicit source and UUID to the admin-authorized deletion RPC only after confirmation; real payment-linked records are protected and failed deletes remain open for retry — prevents deleting the wrong source or financial history.

- Admin inquiry inbox search (`src/pages/TradeAdminInquiries.tsx`) applies each typed term as a server-side or-group built by `src/lib/inquirySearch.ts`, so a match older than the newest fetched page stays findable; the same predicate filters client-side as a final guard so the list and the match count can't disagree.
