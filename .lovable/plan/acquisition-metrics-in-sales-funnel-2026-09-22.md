# Acquisition metrics in Sales Funnel

## Goal
Bring live email and Instagram acquisition performance into the first Sales Funnel column, and automatically surface studios whose portal key was activated.

## Build
1. **Persist Instagram outreach centrally**
   - Replace the browser-only `DM_Sent` flag with live acquisition fields for Instagram outreach status and launch timestamp.
   - Keep the existing behavior: the DM is counted when “Launch Instagram Profile” is clicked.
   - Preserve email campaign status independently so Instagram tracking cannot overwrite reply or activation states.

2. **Add live acquisition metrics to the funnel data**
   - Read acquisition records alongside the existing funnel sources and refresh through the shared realtime connection.
   - Count emails at `OUTBOUND_SENT`, `REPLIED_INTERESTED`, or `PORTAL_ACTIVATED`.
   - Count Instagram launches marked `DM_SENT`.
   - Calculate Email Response as interested replies or portal activations divided by emails sent.
   - Calculate DM Hook Rate as Instagram-launched accounts that later reach `REPLIED_INTERESTED` or `PORTAL_ACTIVATED`, divided by DMs sent.
   - Return `0%` when a denominator is zero and round displayed rates consistently.

3. **Expand the first-column heading**
   - Keep the title “LEADS CAPTURED”.
   - Add compact Email and Instagram metric chips beneath it.
   - Add the muted conversion line: `Email Response: …% | DM Hook Rate: …%`.
   - Keep the current four-column proportions and visual language.

4. **Feed activated acquisition studios into Leads Captured**
   - Add a bottom group for portal-activated studios, using the live acquisition row as a concise reference card linked back to Acquisitions.
   - Show studio, contact/email, activation time, and an activation state without commerce payment/reminder controls.
   - Newly activated records appear through the existing single realtime channel.

5. **Verify**
   - Confirm Instagram launch state persists across refreshes and is shared between administrators.
   - Check metric counts/rates against live database aggregates.
   - Verify a portal-activated acquisition appears in the first column and the four-column layout remains intact.

## Technical details
- Add acquisition-specific timestamp/status columns through one database migration with existing table grants and RLS retained.
- Do not overload `campaign_status` with `DM_SENT`; email lifecycle and Instagram lifecycle remain independently queryable.
- Extend `useSalesFunnel` with a typed acquisition summary and an acquisition-specific card mode.
