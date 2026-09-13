# Sticky mobile checkout summary

## What will change
- Add a mobile-only summary bar directly below the navigation, showing **Show Summary** and the live order total.
- Make the row toggle a smoothly opening overlay containing the existing itemized order summary, including product imagery, delivery, tax, and total.
- Keep the current desktop order-summary sidebar unchanged and hide it on mobile to prevent duplicate content at the bottom.
- Keep checkout forms and payment options in their current natural scrolling order beneath the sticky bar.

## Technical details
- Reuse the existing `CheckoutSummary` and line-item values; no payment, Stripe, tax, currency, or submission logic changes.
- Use `--header-h` for the sticky offset, semantic theme colors, an accessible disclosure button, and a height-limited scrollable overlay.
- Verify on a mobile viewport that the total remains visible, the sheet opens/closes, and the desktop two-column layout is unchanged.
