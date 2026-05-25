# Quote Flow — End-to-End Build

A lot already exists (`QuoteDetail.tsx` ~2.2k lines, `TradeQuotesAdmin.tsx` ~800 lines, status lifecycle, order timeline, email log). My job is to **walk the flow as a user**, fix every dead-end, fill every gap, and make every status transition complete with notification + audit trail. Shipped in 4 passes — you review each before I move on.

## Pass 1 — Concierge → Draft (intake polish)

Goal: every concierge-drafted quote lands attached to a real client + project, never floats in limbo.

- `QuoteProposalCard`: add `ClientPicker` + `ProjectPicker` chips at the top (pre-filled from active project if any). Required before Approve when none on file.
- Currency selector chip in the card (defaults to studio/profile default per memory).
- After commit: keep the chat open, replace the card with a "Quote QU-XXXX created — Open quote" inline confirmation **plus** a sonner toast. No auto-navigate (current 700ms `navigate()` is jarring).
- `trade-concierge-commit`: persist `client_id`, `client_name` (denormalized per memory), `project_id`, `currency` on the new quote. Audit row in `concierge_commits`.
- Stream type extension: `DraftQuoteProposal.args` gains optional `client_id`, `client_name`.

## Pass 2 — Quote Detail (draft state UX)

Goal: a freshly-drafted quote opens to a screen with zero dead-ends — every visible button works, every empty state has a CTA.

- Audit the `draft` view of `QuoteDetail`: header (number, status pill, project chip, client chip, currency, totals), line table, add-line CTA, notes field, submit/cancel buttons.
- Make sure: editing qty, removing a line, changing variant, applying credit, toggling insurance all persist & re-total live.
- Wire **Submit for pricing** → status `submitted`, sets `submitted_at`, fires `quote-submitted` app email to admin (`cyrille@maisonaffluency.com` + studio admins), plus in-app notification.
- Wire **Discard draft** with confirm modal → soft-delete (status `cancelled`) instead of hard-delete unless empty.
- Empty-state CTAs: "Add from Showroom", "Add from Favorites", "Ask Concierge" (opens the concierge with project pre-bound).

## Pass 3 — Admin Pricing → Client Review → Confirm

Goal: every status transition past `submitted` is wired with action, notification, audit.

- **Admin pricing screen** (`TradeQuotesAdmin`): for each `submitted` quote, allow per-line unit price entry (or override of the catalog RRP), confirm currency, add admin note, set status → `priced`. Fires `quote-priced` app email to the requesting user + studio admins.
- **Client-side priced view**: read-only line table with prices, prominent **Accept & Confirm** + **Request changes** (free-text → re-opens to `draft` with admin note attached). Accept → status `confirmed`, sets `confirmed_at`, fires `quote-confirmed` email + admin notification, initializes `order_timeline` row.
- **Cancel from any non-terminal state** with reason field, recorded in `admin_notes`.
- Status badges + timestamps surfaced on the detail header throughout.

## Pass 4 — Payment + Fulfillment closeout

Goal: `confirmed → deposit_paid → paid` is real.

- Add **Generate deposit invoice** + **Generate final invoice** actions in the confirmed view (50/30/20 split per memory `trade-quote-system-logic`). Each generates a PDF via existing presentation/ukDdpPdf pipeline, stamps `quote_email_log`, emails the client (if `client_id` has primary contact) and the user.
- Add manual **Mark deposit paid** / **Mark fully paid** admin-only actions → status transitions, timestamps, notifications.
- Order timeline updates on each transition (already has lifecycle hooks per memory `trade-order-timeline`).
- `paid` view: read-only archive with download links to all invoices + spec sheets, "Reorder" CTA (existing `TradeReorder` page).

## Technical notes

- All new edge functions: `supabase.auth.getClaims(token)` (Core rule).
- All commit writes: validate studio ownership via `can_view_studio` / `can_edit_studio`.
- New `concierge_commits` audit table from the plan if not present yet.
- Email templates use existing `_shared/transactional-email-templates/` (jade theme per memory `branded-email-design`). Five new templates: `quote-submitted-admin`, `quote-priced-user`, `quote-confirmed-admin`, `quote-deposit-invoice`, `quote-final-invoice`.
- No new tables beyond `concierge_commits` and possibly `quote_invoices` (id, quote_id, kind: deposit|final, pdf_url, sent_at, amount_cents).
- Legacy `studio_id IS NULL` rows respected throughout (memory rule).
- Client always captured via `ClientPicker`, both `client_id` and `client_name` written (memory rule).

## Pass order

I'll do Pass 1, ping you, you click around, then I do Pass 2, etc. Each pass leaves the app in a shippable state — nothing half-wired.
