# Restore admin pricing and quote revisions

## Confirmed issue
The live database has both reported locks. The admin pricing screen ignores rejected price and status writes before sending a notification and showing success. Both reopen actions also ignore rejected writes. Existing permissions do not bypass these locks.

The project deliberately preserves issued documents, including against administrator edits. Restoring unrestricted editing would undo that protection, so this repair needs coordinated changes rather than simply removing the locks.

## Proposed repair
1. Save administrator pricing in one checked, atomic operation: line prices, landed-cost settings, notes, and priced status either all succeed or none do. Permit only pricing-related changes; keep submitted product selections, quantities, configurations, client identity and addresses protected.
2. Send the pricing notification only after the save succeeds. Show a failure in place of success if saving fails; distinguish notification failure from a successful pricing save.
3. Replace reopening an issued document in place with an editable draft revision. Preserve the original issued document and its issuance marker. Carry over the correct owner, project, folder, selections and configuration; record the revision relationship and reason. Both admin screens use the same action and open the new draft after confirmed creation.
4. Retain existing reopen behavior for genuinely unissued drafts, with checked results. Do not change client permissions or grant clients an archive-edit bypass.

## Technical approach
- Add narrowly scoped, database-admin-checked transactional operations with row locks and explicit field allowlists. Existing access checks remain authoritative; no broad administrator or service-role bypass in browser code.
- Coordinate draft revision references and board reservations so the new draft can be edited without rewriting the original archive or silently duplicating sourced pieces.
- Update both `TradeQuotesAdmin` and `QuoteDetail` to check results before success feedback, navigation or email dispatch.
- Use an additive migration; leave previous migrations and existing customer documents unchanged.

## Verification
- Add regression tests for atomic pricing, rollback on invalid lines, administrator-only access, retained archive protections, revision ownership/configuration and failure feedback.
- Exercise pricing and draft-revision flows using disposable quotes under an authenticated admin session. Read saved results back through the UI; avoid sending customer notifications or modifying real quotes.
- Check preview errors and mark the Project monitoring finding fixed only after the repair is verified.