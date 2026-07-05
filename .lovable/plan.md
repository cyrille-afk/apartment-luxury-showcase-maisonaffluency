
## Goal

Every "Price on Request" submission and every qualified Concierge lead lands in a new **/admin/inquiries** inbox. From there the admin generates a **draft quote** (public client-facing or internal trade), reviews the pre-filled line items and pricing, then marks it **Ready to send** — no automated email goes to the visitor.

---

## 1. Data model changes (one migration)

### `public.inquiries` — extend

Add columns:
- `source` (text) — `public_product` · `concierge_lead` · `contact_form`
- `product_id` (uuid, nullable) — matched `trade_products.id`
- `product_slug`, `product_name`, `designer_name` (text, nullable) — snapshot in case product is later renamed
- `concierge_lead_id` (uuid, nullable, FK `concierge_leads.id`)
- `status` (text, default `new`) — `new` · `in_review` · `quote_drafted` · `ready_to_send` · `sent` · `closed` · `rejected`
- `linked_quote_id` (uuid, nullable, FK `trade_quotes.id`)
- `assigned_admin_id` (uuid, nullable)
- `admin_notes` (text)

Index on `(status, created_at DESC)`.

### `public.concierge_leads` → inquiries bridge

Trigger `AFTER INSERT` on `concierge_leads` (when a lead has `email` + `intent = 'quote'` or an equivalent qualifying flag) inserts a matching row into `inquiries` with `source = 'concierge_lead'`.

### RLS

- Insert: `service_role` only (edge functions).
- Select/Update/Delete: `has_role(auth.uid(), 'admin')`.

---

## 2. Capture path A — Public "Price on Request"

`ProductPage.tsx` / `PublicProductPage.tsx` already call `send-inquiry`. Extend the payload with:

```
{ product_id, product_slug, product_name, designer_name, source: 'public_product' }
```

`send-inquiry` edge function persists these fields into `inquiries` (currently only writes contact info + message).

## 3. Capture path B — Concierge leads

The `concierge_leads` insert trigger writes an inquiry with the lead's captured `name/email/phone/company/message`, `source = 'concierge_lead'`, and product context if the lead's `qualifier` JSON contains a resolved product/designer.

---

## 4. Admin inbox — `/admin/inquiries`

New route gated by admin role.

Layout:
```text
┌──────────────────────────────────────────────────────────┐
│ Filters: status ▾  source ▾  search                       │
├────────────┬─────────────────────────────────────────────┤
│ Inquiry    │ Detail panel                                 │
│ list       │  visitor · message · product card            │
│ (compact   │  status pill · admin notes                   │
│ rows)      │  ┌───────── Draft quote ───────────┐        │
│            │  │ Type: (•) Public   ( ) Trade    │        │
│            │  │ Line: Socle Table Lamp — Felix… │        │
│            │  │ Price: [ Price on Request ] ▾   │        │
│            │  │ [ Generate draft quote ]        │        │
│            │  └─────────────────────────────────┘        │
│            │  [ Mark ready to send ]  [ Reject ]          │
└────────────┴─────────────────────────────────────────────┘
```

Actions:
- **Generate draft quote** — creates a `trade_quotes` row with `status = 'draft'`, `internal_only = true`, one `trade_quote_items` row derived from `product_id` (auto-pulls MSRP + trade price). Public vs trade toggle controls the `quote_kind` and pricing shown.
- **Mark ready to send** — sets inquiry `status = 'ready_to_send'` and enqueues an admin notification email with a deep link to the quote page. No email to visitor.
- **Reject** — sets `status = 'rejected'` with the reason stored in `admin_notes`.

Links:
- Existing header/admin nav gets an **Inquiries** entry with an unread-count badge (`status = 'new'`).

---

## 5. Draft quote generation

Reuse existing `trade_quotes` + `trade_quote_items` tables. New helper edge function `draft-quote-from-inquiry`:

Inputs: `inquiry_id`, `quote_kind: 'public' | 'trade'`.

Behavior:
1. Load inquiry and matched product.
2. Insert a `trade_quotes` row: `status = 'draft'`, `visitor_name`, `visitor_email`, `visitor_phone`, `internal_only = true`, `owner_admin_id = auth.uid()`, `source_inquiry_id = inquiry.id`.
3. Insert one `trade_quote_items` row: product snapshot (name, designer, MSRP, trade_price, image).
4. Update inquiry: `linked_quote_id`, `status = 'quote_drafted'`.
5. Return the quote id so the admin UI can navigate to `/trade/quote/:id?draftFrom=<inquiry_id>` for line-item edits.

Trade quotes already support tier pricing; adding two new columns (`quote_kind` default `trade`, `source_inquiry_id` nullable) keeps public drafts distinct without a schema fork.

---

## 6. Admin notification on "Ready to send"

New app email template `inquiry-quote-ready.tsx` (React Email, existing infra). Sent to `concierge@myaffluency.com`:
- Visitor name/email
- Product line
- Direct link to `/trade/quote/:id`
- Notes

No email to the visitor at any step.

---

## 7. Files to add / edit

**Migration**
- extend `public.inquiries`, add trigger on `concierge_leads`, add `quote_kind` + `source_inquiry_id` on `trade_quotes`.

**Edge functions**
- `send-inquiry/index.ts` — accept + persist product context.
- `draft-quote-from-inquiry/index.ts` — new.
- `_shared/transactional-email-templates/inquiry-quote-ready.tsx` — new + register.

**Frontend**
- `src/pages/admin/InquiriesInbox.tsx` — new (list + detail).
- `src/components/admin/InquiryRow.tsx`, `InquiryDetail.tsx`, `DraftQuotePanel.tsx` — new.
- `src/pages/ProductPage.tsx` + `PublicProductPage.tsx` — pass product context to `send-inquiry`.
- Admin nav — add "Inquiries" with unread badge.
- Route registration in `App.tsx` under `/admin/inquiries`, guarded by `has_role('admin')`.

---

## 8. Out of scope (confirm if desired later)

- Auto-emailing the visitor when the quote is sent.
- PDF quote generation from an inquiry (existing quote PDF flow already covers this once the draft is opened).
- Matching products by fuzzy name when the inquiry has no `product_id` (contact form path) — for now those inquiries land in the inbox without a pre-filled line item; admin adds items manually.

---

## Technical notes

- `has_role(auth.uid(), 'admin')` gates every read/write and the `/admin/inquiries` route.
- Edge functions use `service_role` for inserts (RLS blocks `authenticated`/`anon` writes).
- The `concierge_leads → inquiries` trigger is idempotent via `ON CONFLICT (concierge_lead_id) DO NOTHING`.
- `linked_quote_id` uses `ON DELETE SET NULL` so purging a draft quote doesn't orphan the inquiry.
- No changes to the existing visitor-facing confirmation email; that still fires.
