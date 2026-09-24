# Consolidate all trade sign-ups into /trade-program

## Current state
- Old system (`trade_applications`): 6 approved members, 3 pending, 1 flagged. It also drives member access, tier discounts, checkout, verification, admin review, backups, GDPR requests and purchase orders (about 27 places in the app).
- New system (`trade_accounts`): 2 pending, used only by the /trade-program form.

## 1. Links
- Every link to `/trade/apply` or `/trade/register` (product pages, spec table, sign-in gates, login page incl. `?type=public`, collector signup, spec sheet, member dashboard, trade layout, landing page) now points to `/trade-program`.
- The old addresses stay alive as permanent redirects to `/trade-program`, keeping any query values, so old emails and bookmarks still work.

## 2. Pre-fill
- `/trade-program` reads `?email=`, `?firm=`, `?name=`, `?source=`, `?intent=` and fills the matching boxes. Source/intent are saved with the application.

## 3. Migrate members
- Add missing columns to `trade_accounts` (user link, role, location, country, tier, trade discount, legacy id) using additive changes only.
- Copy all 10 old rows across, mapping approved → approved, pending/flagged → pending_review. Skip duplicates by email.
- Rewire access, discounts, currency, checkout, dashboard, admin review, registered users, sidebar counts, backups, GDPR, fraud/verification jobs and purchase orders to read `trade_accounts`.
- Verify each of the 6 approved members still has trade access and the correct discount before retiring anything.

## 4. Retire old code
- Delete the old form pages and form component, the application-edit page, and the handlers used only by the old flow (`verify-trade-application`, `trade-application-edit`, `cron-retry-trade-verification`, `purge-rejected-trade-credentials`), plus the old inquiry path in `send-inquiry`.
- Mark the old table as deprecated (read-only), not dropped, so nothing is lost and live copies of the app keep working until you publish.

## 5. Single entry guarantee
- The `/trade-program` handler remains the only way to create an application: Turnstile check, AI radar, WhatsApp/email alert, visual analysis, one row per email (duplicate submissions update the existing pending row).
- Cart/product quote requests keep creating a pending row but go through the same de-duplication.

## Verification
- Click through every former entry point in the preview and confirm it lands on `/trade-program` with pre-fill.
- Submit a test application (server-side, alerts disabled for the test) and confirm: Turnstile rejected without token, one pending row, radar scored, analysis started.
- Sign in as an approved migrated member and confirm access, discount and checkout.

## Risk
This touches member access and checkout. Nothing is published until you publish; the old table stays as a backup.
