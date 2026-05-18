# User Dashboard + Favorite Folders + Paid FF&E Tool

## 1. New `/trade/me` user dashboard

Single landing for trade users with three primary widgets:

- **Favorites preview** — last ~8 favorites with quick "add to folder" affordance, link to full Favorites page.
- **Favorite folders** — grid of user's folders + "New folder" tile. Click → folder detail page.
- **Studios grid** — reuse existing Studios component (the same one used elsewhere) embedded here.
- **Floor Plan → FF&E tile** — locked card showing progress: "X / 6 favorites" then "Unlock $100 (credited to next quote)" once threshold met.

Add a "My Dashboard" sidebar entry between Dashboard and Showroom in `TradeSidebar` + `TradeMobileMenu`.

## 2. Favorite folders (new concept, separate from project boards)

New tables:

- `favorite_folders` — `id`, `user_id`, `studio_id` (nullable, follows existing pattern), `name`, `cover_image_url`, `created_at`, `updated_at`.
- `favorite_folder_items` — `id`, `folder_id`, `favorite_id` (FK → `trade_favorites.id`), `sort_order`, `created_at`. Unique on `(folder_id, favorite_id)`.

RLS: owner-only (read/write where `user_id = auth.uid()`); folder_items inherit via `folder_id` join.

UI:

- Folder grid on dashboard + dedicated `/trade/favorites/folders/:id` detail page.
- "Add to folder" menu on every favorited product card (existing Favorites page + new dashboard preview).
- Reuse existing favorite card visuals.

## 3. FF&E unlock + Stripe $100 payment

### Gating logic

- Count user's `trade_favorites`. If < 6 → tile shows progress bar, disabled CTA.
- If ≥ 6 and no active FF&E entitlement → CTA "Unlock for $100 — fully credited to your next quote".
- If ≥ 6 and entitlement active → CTA "Open Floor Plan → FF&E".

### Tables

- `ffe_entitlements` — `id`, `user_id`, `stripe_session_id`, `amount_cents` (10000), `currency` ('usd'), `status` ('pending' | 'paid' | 'consumed' | 'refunded'), `paid_at`, `created_at`. RLS: owner read; service role write.
- `trade_credits` — `id`, `user_id`, `source` ('ffe_unlock'), `source_ref` (entitlement id), `amount_cents`, `currency`, `status` ('available' | 'applied' | 'expired'), `applied_to_quote_id` (nullable), `created_at`, `applied_at`. RLS: owner read; service role write; admin read all.

### Edge functions

- `create-ffe-checkout` — verifies user has ≥ 6 favorites; creates Stripe Checkout (`mode: payment`, $100 USD); inserts pending `ffe_entitlements`; returns session URL.
- `ffe-stripe-webhook` — handles `checkout.session.completed`; flips entitlement to `paid`; inserts matching `trade_credits` row (`status: 'available'`).
- Reuse existing `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (already in secrets).

### Auto-apply credit to next quote

- On `trade_quotes` status transition to `submitted`/`confirmed` (we'll add this in the existing quote submit flow, not a DB trigger to keep currency-handling explicit):
  - Find user's oldest `available` credit in same/convertible currency.
  - Mark it `applied`, set `applied_to_quote_id`.
  - Add a `quote_credit_cents` field on `trade_quotes` (display only — actual price math stays in the existing quote totals; we render the credit as a line discount in the quote summary/PDF).

### FF&E tool itself

Out of scope for this pass — we'll wire the unlock to the existing `/trade/floor-plan` (or create a placeholder route `/trade/tools/ffe` that says "Coming soon — your unlock is active"). The user can confirm which existing tool to point this at next.

## 4. Files to touch

**New:**
- `src/pages/TradeMyDashboard.tsx` (the `/trade/me` page)
- `src/pages/TradeFavoriteFolderDetail.tsx`
- `src/components/trade/FavoriteFoldersGrid.tsx`
- `src/components/trade/AddToFolderMenu.tsx`
- `src/components/trade/FfeUnlockTile.tsx`
- `src/hooks/useFavoriteFolders.ts`
- `src/hooks/useFfeEntitlement.ts`
- `src/hooks/useTradeCredits.ts`
- `supabase/functions/create-ffe-checkout/index.ts`
- `supabase/functions/ffe-stripe-webhook/index.ts`

**Edited:**
- `src/components/trade/TradeSidebar.tsx`, `TradeMobileMenu.tsx` — add "My Dashboard" entry
- `src/App.tsx` (or wherever trade routes are mounted) — register new routes
- existing Favorites page — add "Add to folder" affordance
- existing quote submission code — auto-consume an available credit

## 5. Order of operations

1. Run DB migration (tables + RLS).
2. Build dashboard page + folders UI (works without payment).
3. Deploy Stripe edge functions + webhook.
4. Wire FfeUnlockTile to checkout.
5. Wire credit auto-apply into quote submission.

## Open question (non-blocking, can confirm during build)

Which existing route is the actual "Floor Plan → FF&E tool" that should open once unlocked? If unsure I'll stub `/trade/tools/ffe` and you can point it later.
