# Server-side FX authority

Move exchange-rate authority off the browser and into the database, so every quote is priced from one validated, timestamped rate set.

## 1. Rate cache table

New `currency_rates` table:
- `base_currency`, `target_currency` (unique together)
- `rate` (numeric, must be > 0)
- `source` (which provider supplied it)
- `rate_date` (the provider's quoted day)
- `last_updated_at`

Readable by everyone (rates are public data), writable only by the scheduled sync job. Seeded immediately with the 10 currencies already in use (EUR, USD, SGD, GBP, CHF, AED, HKD, AUD, JPY, CAD) — all 90 pairs, derived from one EUR base fetch so cross-rates stay internally consistent.

## 2. Scheduled sync function

New `sync-currency-rates` function:
- Fetches the full EUR-based rate table from Frankfurter, falls back to open.er-api.
- Validates the payload before writing: every currency present, every rate a positive finite number, and no pair moving more than 10% versus the stored value (a wild move aborts the run and alerts rather than corrupting pricing).
- Writes all pairs in one transaction-style upsert, stamping `last_updated_at`.
- Scheduled twice daily (06:00 and 18:00 UTC) via the database scheduler; also callable on demand by an admin from Payment Settings.

## 3. Locked rate on the quote

- Add `exchange_rate_at_creation` and `exchange_rate_locked_at` to the quote row (nullable; existing quotes untouched).
- A database function `get_currency_rate(base, target)` returns the cached rate, reading only from `currency_rates`.
- When a quote is created, or its currency is changed before sending, the rate is read from the database and stamped onto the quote. Once stamped, every later view, PDF, and email reads that stored rate — the price a client sees can no longer drift between the quote page and the document.
- Quotes already sent keep whatever they were priced at; the lock only applies going forward.

## 4. Client cleanup

- `src/lib/fxRates.ts` keeps its exact public shape (`getFxRate`, `getFxRates`, `convertCentsWithFallback`, the source badges) so no calling screen needs rewriting, but its internals change to: locked quote rate → `currency_rates` from the database → bundled offline table. The direct browser calls to frankfurter.app and open.er-api.com are removed.
- The FX source badge gains a "Database rates" state showing when the rates were last synced, so the desk can see rate age at a glance.
- Rates are fetched once per session and shared, replacing the current per-pair 10-minute caches.

## Technical notes

- Migration adds `currency_rates` (with grants + RLS), the `get_currency_rate` helper, and the two quote columns; no destructive changes.
- Edge functions that convert money (`create-cart-checkout/fxConvert.ts`, `trade-concierge-commit`, `send-commission-statement`) switch to the same table so server and client agree.
- Existing `fx_rate` / `fx_source` columns on quote line items stay as-is and continue recording the per-line applied rate.
- Verification: unit tests on the validation guard and conversion fallback chain, plus a live check that the Agni HKD quote still totals HKD 308,435.61 across page 1 and page 3 of the PDF.
